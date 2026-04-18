import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { TaxonomyNode } from '../interfaces';
import { applyResponsiveClass } from './responsive';

export const TAXONOMY_VIEW_TYPE = 'delve-taxonomy';

export interface TaxonomyViewState {
  courseId: string;
  taxonomy: TaxonomyNode[];
  onConfirm: (selectedIds: string[], scopeSummary: string) => Promise<void>;
}

export class TaxonomyView extends ItemView {
  private state: TaxonomyViewState | null = null;
  private selected = new Set<string>();
  private expanded = new Set<string>();

  getViewType(): string {
    return TAXONOMY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Delve: Select scope';
  }

  getIcon(): string {
    return 'book-open';
  }

  async setState(
    state: TaxonomyViewState,
    result: { history: boolean },
  ): Promise<void> {
    this.state = state;
    this.selected.clear();
    this.expanded.clear();
    // Expand top-level nodes by default
    for (const node of state.taxonomy) {
      this.expanded.add(node.id);
    }
    this.render();
    return super.setState(state, result);
  }

  getState(): TaxonomyViewState | null {
    return this.state;
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {}

  // ─── Rendering ───────────────────────────────────────────────────────────

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-taxonomy-view');
    applyResponsiveClass(contentEl);

    if (!this.state) {
      contentEl.createEl('p', { text: 'Loading\u2026' });
      return;
    }

    const { taxonomy, courseId } = this.state;

    // Header
    const header = contentEl.createDiv('delve-taxonomy-header');
    header.createEl('h2', { text: courseId.split('-').slice(0, -1).join(' ') || courseId });
    header.createEl('p', {
      text: 'Select the topics you want to cover. Selecting a parent includes all its children.',
      cls: 'delve-taxonomy-description',
    });

    // Tree
    const treeEl = contentEl.createDiv('delve-taxonomy-tree');
    for (const node of taxonomy) {
      this.renderNode(treeEl, node, 0);
    }

    // Footer
    const footer = contentEl.createDiv('delve-taxonomy-footer');

    const confirmBtn = footer.createEl('button', {
      text: `Confirm scope (${this.selected.size} selected)`,
      cls: 'delve-confirm-btn mod-cta',
    });
    confirmBtn.disabled = this.selected.size === 0;
    confirmBtn.addEventListener('click', () => void this.handleConfirm());

    const selectAllBtn = footer.createEl('button', {
      text: 'Select all',
      cls: 'delve-select-all-btn',
    });
    selectAllBtn.addEventListener('click', () => {
      if (this.state) this.selectAll(this.state.taxonomy);
      this.render();
    });

    const clearBtn = footer.createEl('button', {
      text: 'Clear',
      cls: 'delve-clear-btn',
    });
    clearBtn.addEventListener('click', () => {
      this.selected.clear();
      this.render();
    });
  }

  private renderNode(container: HTMLElement, node: TaxonomyNode, depth: number): void {
    const nodeEl = container.createDiv('delve-taxonomy-node');
    nodeEl.style.paddingLeft = `${depth * 20}px`;

    const rowEl = nodeEl.createDiv('delve-taxonomy-row');
    const hasChildren = Boolean(node.children?.length);

    // Expand / collapse toggle
    const toggleEl = rowEl.createSpan('delve-taxonomy-toggle');
    if (hasChildren) {
      toggleEl.setText(this.expanded.has(node.id) ? '\u25be' : '\u25b8');
      toggleEl.addEventListener('click', e => {
        e.stopPropagation();
        if (this.expanded.has(node.id)) {
          this.expanded.delete(node.id);
        } else {
          this.expanded.add(node.id);
        }
        this.render();
      });
    } else {
      toggleEl.setText('\u00b7');
    }

    // Checkbox
    const check = rowEl.createEl('input') as HTMLInputElement;
    check.type = 'checkbox';
    check.className = 'delve-taxonomy-check';
    check.checked = this.selected.has(node.id);
    check.addEventListener('change', () => {
      if (check.checked) {
        this.selectNode(node);
      } else {
        this.deselectNode(node);
      }
      this.render();
    });

    // Label (also acts as click target)
    const labelEl = rowEl.createSpan('delve-taxonomy-label');
    labelEl.setText(node.title);
    labelEl.addEventListener('click', () => {
      if (this.selected.has(node.id)) {
        this.deselectNode(node);
      } else {
        this.selectNode(node);
      }
      this.render();
    });

    // Description (hidden on narrow screens via CSS)
    if (node.description) {
      nodeEl.createDiv({ text: node.description, cls: 'delve-taxonomy-desc' });
    }

    // Children
    if (hasChildren && this.expanded.has(node.id)) {
      const childrenEl = nodeEl.createDiv('delve-taxonomy-children');
      for (const child of node.children!) {
        this.renderNode(childrenEl, child, depth + 1);
      }
    }
  }

  // ─── Selection helpers ──────────────────────────────────────────────────

  private selectNode(node: TaxonomyNode): void {
    this.selected.add(node.id);
    if (node.children) {
      for (const child of node.children) this.selectNode(child);
    }
  }

  private deselectNode(node: TaxonomyNode): void {
    this.selected.delete(node.id);
    if (node.children) {
      for (const child of node.children) this.deselectNode(child);
    }
  }

  private selectAll(nodes: TaxonomyNode[]): void {
    for (const node of nodes) {
      this.selected.add(node.id);
      if (node.children) this.selectAll(node.children);
    }
  }

  private buildScopeSummary(): string {
    if (!this.state) return '';
    const titles: string[] = [];
    this.collectTitles(this.state.taxonomy, titles);
    return titles.join(', ');
  }

  private collectTitles(nodes: TaxonomyNode[], out: string[]): void {
    for (const node of nodes) {
      if (this.selected.has(node.id)) out.push(node.title);
      if (node.children) this.collectTitles(node.children, out);
    }
  }

  // ─── Confirm ─────────────────────────────────────────────────────────────

  private async handleConfirm(): Promise<void> {
    if (!this.state || this.selected.size === 0) return;
    const selectedIds = Array.from(this.selected);
    const scopeSummary = this.buildScopeSummary();
    await this.state.onConfirm(selectedIds, scopeSummary);
    await this.leaf.detach();
  }
}
