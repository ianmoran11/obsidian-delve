import { ItemView, WorkspaceLeaf } from 'obsidian';
import type DelvePlugin from '../../main';
import type { TaxonomyNode } from '../interfaces';
import { TAXONOMY_VIEW_TYPE } from '../constants';
import { confirmScope } from '../stages/stage0-topic';

export interface TaxonomyViewState {
  courseId: string;
  seedTopic: string;
  taxonomy: TaxonomyNode[];
}

export class TaxonomyView extends ItemView {
  private state: TaxonomyViewState = {
    courseId: '',
    seedTopic: '',
    taxonomy: [],
  };
  private selected = new Set<string>();

  constructor(leaf: WorkspaceLeaf, private plugin: DelvePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return TAXONOMY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.state.seedTopic ? `Scope: ${this.state.seedTopic}` : 'Delve: Scope';
  }

  getIcon(): string {
    return 'map';
  }

  async setState(state: TaxonomyViewState, _result: Record<string, unknown>): Promise<void> {
    this.state = state;
    await this.render();
  }

  getState(): TaxonomyViewState {
    return this.state;
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
      text: 'Select the areas you want to cover. Tap a parent to include all its subtopics.',
      cls: 'delve-taxonomy__hint',
    });

    const tree = contentEl.createDiv('delve-taxonomy__tree');
    for (const node of this.state.taxonomy) {
      this.renderNode(tree, node, 0);
    }

    const footer = contentEl.createDiv('delve-taxonomy__footer');
    const confirmBtn = footer.createEl('button', {
      text: 'Select topics to continue',
      cls: 'mod-cta delve-btn-primary delve-taxonomy__confirm',
    }) as HTMLButtonElement;
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => void this.handleConfirm());
  }

  private renderNode(
    parent: HTMLElement,
    node: TaxonomyNode,
    depth: number
  ): void {
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
      label.createEl('span', {
        text: node.description,
        cls: 'delve-taxonomy__desc',
      });
    }

    checkbox.addEventListener('change', () => {
      this.toggleNode(node, checkbox.checked);
      this.syncCheckboxes();
      this.syncConfirmButton();
    });

    if (node.children?.length) {
      const children = item.createDiv('delve-taxonomy__children');
      for (const child of node.children) {
        this.renderNode(children, child, depth + 1);
      }
    }
  }

  private toggleNode(node: TaxonomyNode, checked: boolean): void {
    if (checked) {
      this.selected.add(node.id);
    } else {
      this.selected.delete(node.id);
    }
    for (const child of node.children ?? []) {
      this.toggleNode(child, checked);
    }
  }

  private syncCheckboxes(): void {
    for (const node of flattenNodes(this.state.taxonomy)) {
      const cb = this.contentEl.querySelector(
        `#delve-node-${node.id}`
      ) as HTMLInputElement | null;
      if (cb) cb.checked = this.selected.has(node.id);
    }
  }

  private syncConfirmButton(): void {
    const btn = this.contentEl.querySelector(
      '.delve-taxonomy__confirm'
    ) as HTMLButtonElement | null;
    if (!btn) return;
    const count = this.selected.size;
    btn.disabled = count === 0;
    btn.textContent =
      count > 0 ? `Confirm Scope (${count} selected)` : 'Select topics to continue';
  }

  private async handleConfirm(): Promise<void> {
    const scope = Array.from(this.selected);
    await confirmScope(
      this.plugin,
      this.state.courseId,
      this.state.seedTopic,
      this.state.taxonomy,
      scope
    );
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
