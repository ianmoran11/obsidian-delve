import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type { ViewStateResult } from 'obsidian';
import type DelvePlugin from '../../main';
import type { Curriculum } from '../interfaces';
import type { SourceMode } from '../services/context';
import { SYLLABUS_VIEW_TYPE } from '../constants';
import { runStage3 } from '../stages/stage3-curriculum';
import { runStage4 } from '../stages/stage4-generate';

export interface SyllabusEditorViewState extends Record<string, unknown> {
  courseId: string;
  seedTopic: string;
  curriculum: Curriculum;
  sourceMode?: SourceMode;
  fileCount?: number;
  loading?: boolean;
}

export class SyllabusEditorView extends ItemView {
  private state: SyllabusEditorViewState = {
    courseId: '',
    seedTopic: '',
    curriculum: {
      courseId: '',
      title: '',
      modules: [],
    },
    loading: false,
  };
  private saving = false;
  private dirty = false;
  private generatingLessons = false;

  constructor(leaf: WorkspaceLeaf, private plugin: DelvePlugin) {
    super(leaf);
  }

  getViewType(): string { return SYLLABUS_VIEW_TYPE; }

  getDisplayText(): string {
    return this.state.seedTopic
      ? `Curriculum: ${this.state.seedTopic}`
      : 'Delve: Curriculum Draft';
  }

  getIcon(): string { return 'map'; }

  async setState(
    state: unknown,
    _result: ViewStateResult
  ): Promise<void> {
    this.state = state as SyllabusEditorViewState;
    this.saving = false;
    this.dirty = false;
    this.generatingLessons = false;
    await this.render();
  }

  getState(): Record<string, unknown> { return this.state; }

  async onOpen(): Promise<void> {
    if (this.state.courseId) await this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-syllabus');

    const header = contentEl.createDiv('delve-syllabus__header');
    header.createEl('h2', { text: `Curriculum Draft: ${this.state.seedTopic}` });
    header.createEl('p', {
      text: 'Review and edit the draft syllabus before lesson generation. Stage 4 is still coming next.',
      cls: 'delve-syllabus__hint',
    });

    const meta = header.createDiv('delve-syllabus__meta');
    if (this.state.sourceMode) {
      meta.createEl('span', {
        text: describeSourceMode(this.state.sourceMode, this.state.fileCount ?? 0),
        cls: `delve-syllabus__mode delve-syllabus__mode--${this.state.sourceMode}`,
      });
    }
    meta.createEl('span', {
      text: `${this.state.curriculum.modules.length} modules`,
      cls: 'delve-syllabus__count',
    });
    meta.createEl('span', {
      text: `${countLessons(this.state.curriculum)} lessons`,
      cls: 'delve-syllabus__count',
    });

    const body = contentEl.createDiv('delve-syllabus__body');
    if (this.state.loading) {
      body.createDiv('delve-syllabus__loading').textContent = 'Designing your curriculum draft…';
      return;
    }

    const titleField = body.createDiv('delve-syllabus__field');
    titleField.createEl('label', {
      text: 'Course title',
      cls: 'delve-syllabus__label',
    });
    const courseTitleInput = titleField.createEl('input', {
      type: 'text',
      cls: 'delve-syllabus__input',
      value: this.state.curriculum.title,
    }) as HTMLInputElement;
    courseTitleInput.addEventListener('input', () => {
      this.state.curriculum.title = courseTitleInput.value;
      this.markDirty();
    });

    const modules = body.createDiv('delve-syllabus__modules');
    this.state.curriculum.modules.forEach((module, moduleIndex) => {
      const moduleCard = modules.createDiv('delve-syllabus__module');

      const moduleHeader = moduleCard.createDiv('delve-syllabus__module-header');
      moduleHeader.createEl('span', {
        text: `Module ${moduleIndex + 1}`,
        cls: 'delve-syllabus__module-index',
      });

      this.renderField(
        moduleCard,
        'Module title',
        module.title,
        value => {
          this.state.curriculum.modules[moduleIndex].title = value;
          this.markDirty();
        }
      );

      this.renderTextarea(
        moduleCard,
        'Module description',
        module.description,
        value => {
          this.state.curriculum.modules[moduleIndex].description = value;
          this.markDirty();
        }
      );

      const lessons = moduleCard.createDiv('delve-syllabus__lessons');
      module.lessons.forEach((lesson, lessonIndex) => {
        const lessonCard = lessons.createDiv('delve-syllabus__lesson');
        lessonCard.createEl('div', {
          text: `Lesson ${lessonIndex + 1}`,
          cls: 'delve-syllabus__lesson-index',
        });

        this.renderField(
          lessonCard,
          'Lesson title',
          lesson.title,
          value => {
            this.state.curriculum.modules[moduleIndex].lessons[lessonIndex].title = value;
            this.markDirty();
          }
        );

        this.renderTextarea(
          lessonCard,
          'Lesson description',
          lesson.description,
          value => {
            this.state.curriculum.modules[moduleIndex].lessons[lessonIndex].description = value;
            this.markDirty();
          }
        );

        const prereqs = lessonCard.createDiv('delve-syllabus__prereqs');
        prereqs.createEl('span', {
          text: lesson.prerequisites.length
            ? `Prerequisites: ${lesson.prerequisites.join(', ')}`
            : 'Prerequisites: none',
          cls: 'delve-syllabus__prereqs-text',
        });
      });
    });

    const footer = contentEl.createDiv('delve-syllabus__footer');
    const status = footer.createDiv('delve-syllabus__status');
    if (this.saving) {
      status.textContent = 'Saving syllabus draft…';
    } else if (this.dirty) {
      status.textContent = 'You have unsaved curriculum edits.';
    } else {
      status.textContent = 'Draft saved locally in plugin data.';
    }

    const actions = footer.createDiv('delve-syllabus__actions');
    const regenerateBtn = actions.createEl('button', {
      text: 'Regenerate draft',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    regenerateBtn.disabled = this.saving || this.generatingLessons;
    regenerateBtn.addEventListener('click', () => void this.handleRegenerate());

    const saveBtn = actions.createEl('button', {
      text: this.saving ? 'Saving…' : 'Save draft',
      cls: 'delve-taxonomy__action-btn delve-syllabus__save',
    }) as HTMLButtonElement;
    saveBtn.disabled = this.saving || this.generatingLessons || !this.dirty;
    saveBtn.addEventListener('click', () => void this.handleSaveDraft());

    const finalizeBtn = actions.createEl('button', {
      text: this.generatingLessons ? 'Generating lessons…' : 'Generate lessons',
      cls: 'mod-cta delve-btn-primary delve-syllabus__finalize',
    }) as HTMLButtonElement;
    finalizeBtn.disabled = this.saving || this.generatingLessons || Boolean(this.state.loading);
    finalizeBtn.addEventListener('click', () => void this.handleGenerateLessons());
  }

  private renderField(
    parent: HTMLElement,
    label: string,
    value: string,
    onInput: (value: string) => void
  ): void {
    const field = parent.createDiv('delve-syllabus__field');
    field.createEl('label', { text: label, cls: 'delve-syllabus__label' });
    const input = field.createEl('input', {
      type: 'text',
      cls: 'delve-syllabus__input',
      value,
    }) as HTMLInputElement;
    input.addEventListener('input', () => onInput(input.value));
  }

  private renderTextarea(
    parent: HTMLElement,
    label: string,
    value: string,
    onInput: (value: string) => void
  ): void {
    const field = parent.createDiv('delve-syllabus__field');
    field.createEl('label', { text: label, cls: 'delve-syllabus__label' });
    const textarea = field.createEl('textarea', { cls: 'delve-syllabus__textarea' }) as HTMLTextAreaElement;
    textarea.rows = 3;
    textarea.value = value;
    textarea.addEventListener('input', () => onInput(textarea.value));
  }

  private async handleSaveDraft(): Promise<void> {
    this.saving = true;
    await this.render();
    try {
      await this.plugin.cacheService.writeStage(this.state.courseId, 3, {
        courseId: this.state.courseId,
        curriculum: this.state.curriculum,
        status: 'complete',
        completedAt: new Date().toISOString(),
      });
      this.dirty = false;
      new Notice('Curriculum draft saved.');
    } finally {
      this.saving = false;
      await this.render();
    }
  }

  private async handleRegenerate(): Promise<void> {
    try {
      await runStage3(this.plugin, this.state.courseId);
    } catch (e) {
      new Notice(`Could not regenerate curriculum: ${(e as Error).message}`);
    }
  }

  private async handleGenerateLessons(): Promise<void> {
    if (this.generatingLessons) return;
    this.generatingLessons = true;
    await this.render();
    try {
      if (this.dirty) {
        await this.plugin.cacheService.writeStage(this.state.courseId, 3, {
          courseId: this.state.courseId,
          curriculum: this.state.curriculum,
          status: 'complete',
          completedAt: new Date().toISOString(),
        });
        this.dirty = false;
      }
      await runStage4(this.plugin, this.state.courseId);
    } catch (e) {
      new Notice(`Could not generate lessons: ${(e as Error).message}`);
    } finally {
      this.generatingLessons = false;
      await this.render();
    }
  }

  private markDirty(): void {
    this.dirty = true;
    const status = this.contentEl.querySelector('.delve-syllabus__status') as HTMLElement | null;
    if (status && !this.saving) {
      status.textContent = 'You have unsaved curriculum edits.';
    }
    const saveBtn = this.contentEl.querySelector('.delve-syllabus__save') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = false;
  }
}

function countLessons(curriculum: Curriculum): number {
  return curriculum.modules.reduce((total, module) => total + module.lessons.length, 0);
}

function describeSourceMode(mode: SourceMode, fileCount: number): string {
  if (mode === 'knowledge-only') return 'Knowledge-only';
  const label = mode === 'grounded' ? 'Grounded' : 'Augmented';
  return `${label} — ${fileCount} source file${fileCount === 1 ? '' : 's'}`;
}
