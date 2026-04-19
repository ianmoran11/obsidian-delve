import { ItemView, WorkspaceLeaf } from 'obsidian';
import type DelvePlugin from '../../main';
import type { Concept, LikertScore } from '../interfaces';
import { DIAGNOSTIC_VIEW_TYPE } from '../constants';
import { confirmDiagnostic } from '../stages/stage2-diagnostic';

export interface DiagnosticViewState {
  courseId: string;
  seedTopic: string;
  concepts: Concept[];
}

const LIKERT_LABELS: Record<LikertScore, string> = {
  1: 'New',
  2: 'Heard of it',
  3: 'Familiar',
  4: 'Confident',
  5: 'Expert',
};

const LIKERT_SCORES = [1, 2, 3, 4, 5] as const;

export class DiagnosticView extends ItemView {
  private state: DiagnosticViewState = { courseId: '', seedTopic: '', concepts: [] };
  private ratings = new Map<string, LikertScore>();
  private submitting = false;

  constructor(leaf: WorkspaceLeaf, private plugin: DelvePlugin) {
    super(leaf);
  }

  getViewType(): string { return DIAGNOSTIC_VIEW_TYPE; }
  getDisplayText(): string {
    return this.state.seedTopic ? `Assess: ${this.state.seedTopic}` : 'Delve: Self-Assessment';
  }
  getIcon(): string { return 'gauge'; }

  async setState(
    state: DiagnosticViewState,
    _result: Record<string, unknown>
  ): Promise<void> {
    this.state = state;
    this.ratings = new Map();
    this.submitting = false;
    await this.render();
  }

  getState(): DiagnosticViewState { return this.state; }

  async onOpen(): Promise<void> {
    if (this.state.concepts.length > 0) await this.render();
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-diagnostic');

    const rated = this.ratings.size;
    const total = this.state.concepts.length;

    const header = contentEl.createDiv('delve-diagnostic__header');
    header.createEl('h2', { text: `Self-Assessment: ${this.state.seedTopic}` });
    header.createEl('p', {
      text: 'Rate your familiarity with each concept. Be honest — there are no wrong answers.',
      cls: 'delve-diagnostic__hint',
    });
    const progress = header.createDiv('delve-diagnostic__progress');
    progress.createEl('span', {
      text: `${rated} of ${total} rated`,
      cls: rated === total && total > 0
        ? 'delve-diagnostic__progress--complete'
        : 'delve-diagnostic__progress--partial',
    });

    const list = contentEl.createDiv('delve-diagnostic__list');
    for (const concept of this.state.concepts) {
      this.renderConceptCard(list, concept);
    }

    const footer = contentEl.createDiv('delve-diagnostic__footer');
    if (this.submitting) {
      footer.createDiv('delve-diagnostic__submitting').textContent = 'Saving assessment…';
    } else {
      const remaining = total - rated;
      const confirmBtn = footer.createEl('button', {
        text: remaining === 0
          ? 'Build my curriculum →'
          : `Rate all concepts to continue (${remaining} remaining)`,
        cls: 'mod-cta delve-btn-primary delve-diagnostic__confirm',
      }) as HTMLButtonElement;
      confirmBtn.disabled = remaining > 0;
      confirmBtn.addEventListener('click', () => void this.handleConfirm());
    }
  }

  private renderConceptCard(parent: HTMLElement, concept: Concept): void {
    const card = parent.createDiv('delve-diagnostic__card');
    const current = this.ratings.get(concept.id);

    card.createEl('h3', { text: concept.title, cls: 'delve-diagnostic__card-title' });
    card.createEl('p', { text: concept.description, cls: 'delve-diagnostic__card-desc' });

    const scale = card.createDiv('delve-diagnostic__scale');
    for (const score of LIKERT_SCORES) {
      const btn = scale.createEl('button', {
        cls: 'delve-diagnostic__likert-btn' +
          (current === score ? ' delve-diagnostic__likert-btn--selected' : ''),
        title: LIKERT_LABELS[score],
      });
      btn.createEl('span', { text: String(score), cls: 'delve-diagnostic__likert-num' });
      btn.createEl('span', { text: LIKERT_LABELS[score], cls: 'delve-diagnostic__likert-label' });
      btn.addEventListener('click', () => {
        this.ratings.set(concept.id, score);
        this.syncCard(card, score);
        this.syncFooter();
        this.syncProgress();
      });
    }
  }

  private syncCard(card: HTMLElement, selected: LikertScore): void {
    card.querySelectorAll('.delve-diagnostic__likert-btn').forEach((btn, i) => {
      btn.classList.toggle(
        'delve-diagnostic__likert-btn--selected',
        (i + 1) as LikertScore === selected
      );
    });
  }

  private syncFooter(): void {
    const remaining = this.state.concepts.length - this.ratings.size;
    const btn = this.contentEl.querySelector(
      '.delve-diagnostic__confirm'
    ) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = remaining > 0;
    btn.textContent = remaining === 0
      ? 'Build my curriculum →'
      : `Rate all concepts to continue (${remaining} remaining)`;
  }

  private syncProgress(): void {
    const rated = this.ratings.size;
    const total = this.state.concepts.length;
    const el = this.contentEl.querySelector(
      '.delve-diagnostic__progress span'
    ) as HTMLElement | null;
    if (!el) return;
    el.textContent = `${rated} of ${total} rated`;
    el.className = rated === total
      ? 'delve-diagnostic__progress--complete'
      : 'delve-diagnostic__progress--partial';
  }

  private async handleConfirm(): Promise<void> {
    if (this.ratings.size < this.state.concepts.length) return;
    this.submitting = true;
    await this.render();
    try {
      const map = Object.fromEntries(this.ratings) as Record<string, LikertScore>;
      await confirmDiagnostic(this.plugin, this.state.courseId, map);
    } catch {
      this.submitting = false;
      await this.render();
    }
  }
}
