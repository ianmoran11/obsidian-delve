import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type { ViewStateResult } from 'obsidian';
import type DelvePlugin from '../../main';
import type { TaxonomyNode } from '../interfaces';
import { TAXONOMY_VIEW_TYPE } from '../constants';
import {
  confirmScope,
  disaggregateNode,
  expandNode,
  suggestRelated,
  replaceNode,
  addChildren,
  appendTopLevel,
} from '../stages/stage0-topic';

export interface TaxonomyViewState extends Record<string, unknown> {
  courseId: string;
  seedTopic: string;
  taxonomy: TaxonomyNode[];
}

export class TaxonomyView extends ItemView {
  private state: TaxonomyViewState = { courseId: '', seedTopic: '', taxonomy: [] };
  private taxonomy: TaxonomyNode[] = [];
  private selected = new Set<string>();
  private loadingNodes = new Set<string>();
  private suggestingRelated = false;
  private confirming = false;

  constructor(leaf: WorkspaceLeaf, private plugin: DelvePlugin) {
    super(leaf);
  }

  getViewType(): string { return TAXONOMY_VIEW_TYPE; }
  getDisplayText(): string {
    return this.state.seedTopic ? `Scope: ${this.state.seedTopic}` : 'Delve: Scope';
  }
  getIcon(): string { return 'map'; }

  async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    const nextState = state as TaxonomyViewState;
    this.state = nextState;
    this.taxonomy = deepClone(nextState.taxonomy);
    await this.render();
  }

  getState(): Record<string, unknown> {
    return { ...this.state, taxonomy: this.taxonomy };
  }

  async onOpen(): Promise<void> {
    if (this.state.taxonomy.length > 0) await this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-taxonomy');

    const header = contentEl.createDiv('delve-taxonomy__header');
    header.createEl('h2', { text: this.state.seedTopic });
    header.createEl('p', {
      text: 'Select areas to cover. Use Split or Expand on any node, or suggest additional topics.',
      cls: 'delve-taxonomy__hint',
    });

    if (this.suggestingRelated) {
      header.createDiv('delve-taxonomy__suggest-loading').textContent =
        'Finding related topics…';
    } else {
      const suggestBtn = header.createEl('button', {
        text: '+ Suggest related topics',
        cls: 'delve-taxonomy__action-btn delve-taxonomy__suggest-btn',
        title: 'Ask the model to suggest additional top-level topics related to this subject',
      });
      suggestBtn.disabled = this.confirming;
      suggestBtn.addEventListener('click', () => void this.handleSuggestRelated());
    }

    const tree = contentEl.createDiv('delve-taxonomy__tree');
    for (const node of this.taxonomy) {
      this.renderNode(tree, node, 0);
    }

    const footer = contentEl.createDiv('delve-taxonomy__footer');
    const confirmBtn = footer.createEl('button', {
      text: 'Select topics to continue',
      cls: 'mod-cta delve-btn-primary delve-taxonomy__confirm',
    }) as HTMLButtonElement;
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => void this.handleConfirm());
    this.syncConfirmButton(confirmBtn);

    if (!this.plugin.settings.openRouterApiKey) {
      footer.createDiv('delve-taxonomy__confirm-loading').textContent =
        'Add your OpenRouter API key in Delve settings before continuing.';
    }

    if (this.confirming) {
      footer.createDiv('delve-taxonomy__confirm-loading').textContent =
        'Saving scope and extracting concepts…';
    }
  }

  private renderNode(parent: HTMLElement, node: TaxonomyNode, depth: number): void {
    const item = parent.createDiv({
      cls: `delve-taxonomy__item delve-taxonomy__item--depth-${depth}`,
    });
    const row = item.createDiv('delve-taxonomy__row');

    const cbId = `delve-node-${node.id}`;
    const checkbox = row.createEl('input') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.className = 'delve-taxonomy__checkbox';
    checkbox.id = cbId;
    checkbox.checked = this.selected.has(node.id);

    const label = row.createEl('label', { cls: 'delve-taxonomy__label' });
    label.htmlFor = cbId;
    label.createEl('span', { text: node.title, cls: 'delve-taxonomy__title' });
    if (node.description) {
      label.createEl('span', { text: node.description, cls: 'delve-taxonomy__desc' });
    }

    checkbox.addEventListener('change', () => {
      this.toggleNode(node, checkbox.checked);
      this.syncCheckboxes();
      const btn = this.contentEl.querySelector(
        '.delve-taxonomy__confirm'
      ) as HTMLButtonElement | null;
      if (btn) this.syncConfirmButton(btn);
    });

    if (this.loadingNodes.has(node.id)) {
      row.createDiv('delve-taxonomy__node-loading').textContent = 'Thinking…';
    } else {
      const actions = row.createDiv('delve-taxonomy__node-actions');

      const splitBtn = actions.createEl('button', {
        text: 'Split',
        cls: 'delve-taxonomy__action-btn',
        title: 'Replace this topic with more specific alternatives at the same level',
      });
      splitBtn.disabled = this.confirming;
      splitBtn.addEventListener('click', e => {
        e.stopPropagation();
        void this.handleDisaggregate(node);
      });

      const expandBtn = actions.createEl('button', {
        text: 'Expand',
        cls: 'delve-taxonomy__action-btn',
        title: 'Add detailed subtopics below this item',
      });
      expandBtn.disabled = this.confirming;
      expandBtn.addEventListener('click', e => {
        e.stopPropagation();
        void this.handleExpand(node);
      });
    }

    if (node.children?.length) {
      const children = item.createDiv('delve-taxonomy__children');
      for (const child of node.children) {
        this.renderNode(children, child, depth + 1);
      }
    }
  }

  private toggleNode(node: TaxonomyNode, checked: boolean): void {
    if (checked) this.selected.add(node.id);
    else this.selected.delete(node.id);
    for (const child of node.children ?? []) this.toggleNode(child, checked);
  }

  private syncCheckboxes(): void {
    for (const node of flattenNodes(this.taxonomy)) {
      const cb = this.contentEl.querySelector(
        `#delve-node-${node.id}`
      ) as HTMLInputElement | null;
      if (cb) cb.checked = this.selected.has(node.id);
    }
  }

  private syncConfirmButton(btn: HTMLButtonElement): void {
    const count = this.selected.size;
    const missingApiKey = !this.plugin.settings.openRouterApiKey;
    btn.disabled = count === 0 || this.confirming || missingApiKey;
    btn.textContent =
      this.confirming
        ? 'Preparing concepts…'
        : missingApiKey
          ? 'Add API key in settings to continue'
        : count > 0
          ? `Confirm Scope (${count} selected)`
          : 'Select topics to continue';
  }

  private async handleDisaggregate(node: TaxonomyNode): Promise<void> {
    this.loadingNodes.add(node.id);
    await this.render();
    try {
      const newNodes = await disaggregateNode(
        this.plugin,
        this.state.seedTopic,
        node,
        Array.from(this.selected)
      );
      this.taxonomy = replaceNode(this.taxonomy, node.id, newNodes);
      this.selected.delete(node.id);
    } catch (e) {
      new Notice(`Split failed: ${(e as Error).message}`);
    } finally {
      this.loadingNodes.delete(node.id);
      await this.render();
    }
  }

  private async handleExpand(node: TaxonomyNode): Promise<void> {
    this.loadingNodes.add(node.id);
    await this.render();
    try {
      const children = await expandNode(this.plugin, this.state.seedTopic, node);
      this.taxonomy = addChildren(this.taxonomy, node.id, children);
    } catch (e) {
      new Notice(`Expand failed: ${(e as Error).message}`);
    } finally {
      this.loadingNodes.delete(node.id);
      await this.render();
    }
  }

  private async handleSuggestRelated(): Promise<void> {
    this.suggestingRelated = true;
    await this.render();
    try {
      const newTopics = await suggestRelated(
        this.plugin,
        this.state.seedTopic,
        this.taxonomy,
        Array.from(this.selected)
      );
      this.taxonomy = appendTopLevel(this.taxonomy, newTopics);
    } catch (e) {
      new Notice(`Suggest failed: ${(e as Error).message}`);
    } finally {
      this.suggestingRelated = false;
      await this.render();
    }
  }

  private async handleConfirm(): Promise<void> {
    if (!this.plugin.settings.openRouterApiKey) {
      new Notice('Add your OpenRouter API key in Delve settings before continuing.');
      return;
    }

    this.confirming = true;
    await this.render();
    try {
      await confirmScope(
        this.plugin,
        this.state.courseId,
        this.state.seedTopic,
        this.taxonomy,
        Array.from(this.selected)
      );
    } catch (e) {
      this.confirming = false;
      await this.render();
      new Notice(`Could not continue to concept extraction: ${(e as Error).message}`);
    }
  }
}

function flattenNodes(nodes: TaxonomyNode[]): TaxonomyNode[] {
  const result: TaxonomyNode[] = [];
  function walk(arr: TaxonomyNode[]): void {
    for (const n of arr) {
      result.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
