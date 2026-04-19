import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type DelvePlugin from '../../main';
import type { Concept } from '../interfaces';
import type { SourceMode } from '../services/context';
import { CONCEPTS_VIEW_TYPE } from '../constants';
import { runStage1 } from '../stages/stage1-concepts';

export interface ConceptsViewState {
  courseId: string;
  seedTopic: string;
  concepts: Concept[];
  sourceMode: SourceMode;
  fileCount: number;
}

export class ConceptsView extends ItemView {
  private state: ConceptsViewState = {
    courseId: '',
    seedTopic: '',
    concepts: [],
    sourceMode: 'knowledge-only',
    fileCount: 0,
  };
  private regenerating = false;

  constructor(leaf: WorkspaceLeaf, private plugin: DelvePlugin) {
    super(leaf);
  }

  getViewType(): string { return CONCEPTS_VIEW_TYPE; }
  getDisplayText(): string {
    return this.state.seedTopic ? `Concepts: ${this.state.seedTopic}` : 'Delve: Concepts';
  }
  getIcon(): string { return 'list'; }

  async setState(
    state: ConceptsViewState,
    _result: Record<string, unknown>
  ): Promise<void> {
    this.state = state;
    this.regenerating = false;
    await this.render();
  }

  getState(): ConceptsViewState { return this.state; }

  async onOpen(): Promise<void> {
    if (this.state.concepts.length > 0) await this.render();
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-concepts');

    // Header
    const header = contentEl.createDiv('delve-concepts__header');
    header.createEl('h2', { text: `Concepts: ${this.state.seedTopic}` });

    const meta = header.createDiv('delve-concepts__meta');
    const modeText: Record<SourceMode, string> = {
      'knowledge-only': 'Knowledge-only',
      'grounded': `Grounded — ${this.state.fileCount} source file${this.state.fileCount !== 1 ? 's' : ''}`,
      'augmented': `Augmented — ${this.state.fileCount} source file${this.state.fileCount !== 1 ? 's' : ''}`,
    };
    meta.createEl('span', {
      text: modeText[this.state.sourceMode],
      cls: `delve-concepts__mode delve-concepts__mode--${this.state.sourceMode}`,
    });
    meta.createEl('span', {
      text: `${this.state.concepts.length} concepts extracted`,
      cls: 'delve-concepts__count',
    });

    // Concept list
    const list = contentEl.createDiv('delve-concepts__list');
    this.state.concepts.forEach((concept, i) => {
      this.renderConcept(list, concept, i + 1);
    });

    // Footer
    const footer = contentEl.createDiv('delve-concepts__footer');

    if (this.regenerating) {
      footer.createDiv('delve-concepts__regen-loading').textContent = 'Regenerating concepts…';
    } else {
      const regenBtn = footer.createEl('button', {
        text: 'Regenerate',
        cls: 'delve-taxonomy__action-btn',
        title: 'Re-run concept extraction for this scope',
      });
      regenBtn.addEventListener('click', () => void this.handleRegenerate());
    }

    const proceedBtn = footer.createEl('button', {
      text: 'Start Self-Assessment →',
      cls: 'mod-cta delve-btn-primary delve-concepts__proceed',
    });
    proceedBtn.addEventListener('click', () => void this.handleProceed());
  }

  private renderConcept(
    parent: HTMLElement,
    concept: Concept,
    index: number
  ): void {
    const card = parent.createDiv('delve-concepts__card');

    const titleRow = card.createDiv('delve-concepts__card-header');
    titleRow.createEl('span', {
      text: String(index),
      cls: 'delve-concepts__card-index',
    });
    titleRow.createEl('h3', {
      text: concept.title,
      cls: 'delve-concepts__card-title',
    });

    card.createEl('p', {
      text: concept.description,
      cls: 'delve-concepts__card-desc',
    });

    if (concept.sourceRefs?.length) {
      const refs = card.createDiv('delve-concepts__card-refs');
      refs.createEl('span', { text: 'Sources: ', cls: 'delve-concepts__card-refs-label' });
      refs.createEl('span', {
        text: concept.sourceRefs.join(', '),
        cls: 'delve-concepts__card-refs-list',
      });
    }
  }

  private async handleRegenerate(): Promise<void> {
    this.regenerating = true;
    await this.render();
    try {
      await runStage1(this.plugin, this.state.courseId);
    } catch {
      this.regenerating = false;
      await this.render();
    }
  }

  private async handleProceed(): Promise<void> {
    new Notice('Stage 2 (Self-Assessment) is coming in the next release.');
  }
}
