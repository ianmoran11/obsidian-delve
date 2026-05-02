import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type { ViewStateResult } from 'obsidian';
import type DelvePlugin from '../../main';
import type { Curriculum, Stage0Cache, Stage3Cache, Stage4Cache } from '../interfaces';
import type { SourceMode } from '../services/context';
import { SYLLABUS_VIEW_TYPE } from '../constants';
import { runStage3 } from '../stages/stage3-curriculum';
import { createSkeletonNotes, runStage4 } from '../stages/stage4-generate';

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
  private creatingSkeletons = false;
  private selectedLessonIds = new Set<string>();

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
    this.state = this.normalizeState(state as SyllabusEditorViewState);
    this.saving = false;
    this.dirty = false;
    this.generatingLessons = false;
    this.creatingSkeletons = false;
    this.selectedLessonIds = new Set<string>();
    await this.render();
  }

  getState(): Record<string, unknown> { return this.state; }

  async onOpen(): Promise<void> {
    this.state = this.normalizeState(this.state);
    if (this.getCourseId()) await this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-syllabus');
    const courseId = this.getCourseId();
    const stage4 = courseId
      ? (await this.plugin.cacheService.readStage(courseId, 4)) as Stage4Cache | undefined
      : undefined;
    const lessonCount = countLessons(this.state.curriculum);
    const completedLessons = stage4?.progress.completedLessons ?? 0;
    const remainingLessons = Math.max(lessonCount - completedLessons, 0);
    const generationComplete = stage4?.status === 'complete' && lessonCount > 0;
    const completedLessonIds = new Set(stage4?.completedLessonIds ?? []);
    this.syncSelectedLessonIds(completedLessonIds);
    const selectedPendingLessonCount = this.getSelectedPendingLessonCount(completedLessonIds);

    const header = contentEl.createDiv('delve-syllabus__header');
    header.createEl('h2', { text: `Curriculum Draft: ${this.state.seedTopic}` });
    header.createEl('p', {
      text: 'Review and edit the draft syllabus, then choose the lessons you want to generate in this session.',
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
      text: `${lessonCount} lessons`,
      cls: 'delve-syllabus__count',
    });
    if (lessonCount > 0) {
      meta.createEl('span', {
        text: generationComplete
          ? 'All lessons generated'
          : `${completedLessons}/${lessonCount} generated`,
        cls: 'delve-syllabus__count',
      });
    }

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
        const lessonHeader = lessonCard.createDiv('delve-syllabus__lesson-header');
        lessonHeader.createEl('div', {
          text: `Lesson ${lessonIndex + 1}`,
          cls: 'delve-syllabus__lesson-index',
        });
        const lessonControls = lessonHeader.createDiv('delve-syllabus__lesson-controls');
        const isCompleted = completedLessonIds.has(lesson.lessonId);
        if (isCompleted) {
          lessonControls.createEl('span', {
            text: 'Generated',
            cls: 'delve-syllabus__lesson-badge',
          });
        } else {
          const checkboxLabel = lessonControls.createEl('label', {
            cls: 'delve-syllabus__checkbox',
          });
          const checkbox = checkboxLabel.createEl('input', {
            type: 'checkbox',
          }) as HTMLInputElement;
          checkbox.checked = this.selectedLessonIds.has(lesson.lessonId);
          checkbox.addEventListener('change', async () => {
            if (checkbox.checked) this.selectedLessonIds.add(lesson.lessonId);
            else this.selectedLessonIds.delete(lesson.lessonId);
            await this.render();
          });
          checkboxLabel.createSpan({ text: 'Generate' });
        }

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
    } else if (this.creatingSkeletons) {
      status.textContent = 'Creating skeleton notes…';
    } else if (this.generatingLessons) {
      status.textContent = remainingLessons > 0
        ? `Generating lesson ${completedLessons + 1} of ${lessonCount}…`
        : 'Wrapping up lesson generation…';
    } else if (this.dirty) {
      status.textContent = 'You have unsaved curriculum edits.';
    } else if (generationComplete) {
      status.textContent = 'All lessons have been generated into the vault.';
    } else if (completedLessons > 0) {
      status.textContent = `${completedLessons} lesson${completedLessons === 1 ? '' : 's'} generated. You can keep going whenever you’re ready.`;
    } else {
      status.textContent = 'Draft saved locally in plugin data.';
    }

    const actions = footer.createDiv('delve-syllabus__actions');
    const selectAllBtn = actions.createEl('button', {
      text: 'Select all',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    selectAllBtn.disabled = this.saving || this.generatingLessons || this.creatingSkeletons || remainingLessons === 0;
    selectAllBtn.addEventListener('click', async () => {
      this.selectAllRemainingLessons(completedLessonIds);
      await this.render();
    });

    const selectNoneBtn = actions.createEl('button', {
      text: 'Select none',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    selectNoneBtn.disabled = this.saving || this.generatingLessons || this.creatingSkeletons || selectedPendingLessonCount === 0;
    selectNoneBtn.addEventListener('click', async () => {
      this.selectedLessonIds.clear();
      await this.render();
    });

    const regenerateBtn = actions.createEl('button', {
      text: 'Regenerate draft',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    regenerateBtn.disabled = this.saving || this.generatingLessons || this.creatingSkeletons;
    regenerateBtn.addEventListener('click', () => void this.handleRegenerate());

    const saveBtn = actions.createEl('button', {
      text: this.saving ? 'Saving…' : 'Save draft',
      cls: 'delve-taxonomy__action-btn delve-syllabus__save',
    }) as HTMLButtonElement;
    saveBtn.disabled = this.saving || this.generatingLessons || this.creatingSkeletons || !this.dirty;
    saveBtn.addEventListener('click', () => void this.handleSaveDraft());

    const skeletonBtn = actions.createEl('button', {
      text: this.creatingSkeletons ? 'Creating skeletons…' : 'Create skeleton notes',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    skeletonBtn.disabled = this.saving || this.generatingLessons || this.creatingSkeletons || Boolean(this.state.loading) || lessonCount === 0;
    skeletonBtn.addEventListener('click', () => void this.handleCreateSkeletonNotes());

    const finalizeBtn = actions.createEl('button', {
      text: getGenerateButtonLabel(
        this.generatingLessons,
        generationComplete,
        completedLessons,
        selectedPendingLessonCount
      ),
      cls: 'mod-cta delve-btn-primary delve-syllabus__finalize',
    }) as HTMLButtonElement;
    finalizeBtn.disabled = this.saving || this.generatingLessons || this.creatingSkeletons || Boolean(this.state.loading) || generationComplete;
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
    const courseId = await this.ensureCourseId();
    if (!courseId) {
      new Notice('This curriculum tab is missing its course id. Reopen it from the assessment view.');
      return;
    }
    this.saving = true;
    await this.render();
    try {
      await this.writeCurrentStage3(courseId);
      this.dirty = false;
      new Notice('Curriculum draft saved.');
    } finally {
      this.saving = false;
      await this.render();
    }
  }

  private async handleRegenerate(): Promise<void> {
    const courseId = this.getCourseId();
    if (!courseId) {
      new Notice('This curriculum tab is missing its course id. Reopen it from the assessment view.');
      return;
    }
    try {
      await runStage3(this.plugin, courseId);
    } catch (e) {
      new Notice(`Could not regenerate curriculum: ${(e as Error).message}`);
    }
  }

  private async handleGenerateLessons(): Promise<void> {
    const courseId = await this.ensureCourseId();
    if (!courseId) {
      new Notice('This curriculum tab is missing its course id. Reopen it from the assessment view.');
      return;
    }
    if (this.generatingLessons) return;
    if (this.selectedLessonIds.size === 0) {
      new Notice('Select at least one lesson to generate.');
      return;
    }
    this.generatingLessons = true;
    await this.render();
    try {
      await this.writeCurrentStage3(courseId);
      await this.ensureStage0SeedTopic(courseId);
      this.dirty = false;
      const selectedLessonIds = [...this.selectedLessonIds];
      await runStage4(this.plugin, courseId, { lessonIds: selectedLessonIds });
      selectedLessonIds.forEach(lessonId => this.selectedLessonIds.delete(lessonId));
    } catch (e) {
      new Notice(`Could not generate lessons: ${(e as Error).message}`);
    } finally {
      this.generatingLessons = false;
      await this.render();
    }
  }

  private async handleCreateSkeletonNotes(): Promise<void> {
    const courseId = await this.ensureCourseId();
    if (!courseId) {
      new Notice('This curriculum tab is missing its course id. Reopen it from the assessment view.');
      return;
    }
    if (this.creatingSkeletons) return;
    this.creatingSkeletons = true;
    await this.render();
    try {
      await this.writeCurrentStage3(courseId);
      this.dirty = false;
      await createSkeletonNotes(this.plugin, courseId);
    } catch (e) {
      new Notice(`Could not create skeleton notes: ${(e as Error).message}`);
    } finally {
      this.creatingSkeletons = false;
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

  private syncSelectedLessonIds(completedLessonIds: Set<string>): void {
    const availableLessonIds = new Set(
      this.state.curriculum.modules.flatMap(module => module.lessons.map(lesson => lesson.lessonId))
    );
    this.selectedLessonIds.forEach(lessonId => {
      if (!availableLessonIds.has(lessonId) || completedLessonIds.has(lessonId)) {
        this.selectedLessonIds.delete(lessonId);
      }
    });
  }

  private getSelectedPendingLessonCount(completedLessonIds: Set<string>): number {
    let total = 0;
    this.selectedLessonIds.forEach(lessonId => {
      if (!completedLessonIds.has(lessonId)) total += 1;
    });
    return total;
  }

  private selectAllRemainingLessons(completedLessonIds: Set<string>): void {
    this.selectedLessonIds.clear();
    this.state.curriculum.modules.forEach(module => {
      module.lessons.forEach(lesson => {
        if (!completedLessonIds.has(lesson.lessonId)) {
          this.selectedLessonIds.add(lesson.lessonId);
        }
      });
    });
  }

  private getCourseId(): string {
    return this.state.courseId || this.state.curriculum.courseId || '';
  }

  private async ensureCourseId(): Promise<string> {
    const existingCourseId = this.getCourseId();
    if (existingCourseId) {
      this.state.courseId = existingCourseId;
      this.state.curriculum.courseId = existingCourseId;
      return existingCourseId;
    }

    const recoveredCourseId = generateRecoveredCourseId(this.state.seedTopic);
    this.state.courseId = recoveredCourseId;
    this.state.curriculum.courseId = recoveredCourseId;
    return recoveredCourseId;
  }

  private async writeCurrentStage3(courseId: string): Promise<void> {
    const existingMeta = (await this.plugin.cacheService.listCourses())
      .find(course => course.courseId === courseId);
    const cache: Stage3Cache = {
      courseId,
      curriculum: {
        ...this.state.curriculum,
        courseId,
      },
      status: 'complete',
      completedAt: new Date().toISOString(),
    };
    await this.plugin.cacheService.writeStage(courseId, 3, cache);
    await this.plugin.cacheService.writeMeta({
      courseId,
      title: this.state.curriculum.title || this.state.seedTopic || existingMeta?.title || courseId,
      createdAt: existingMeta?.createdAt ?? new Date().toISOString(),
    });
  }

  private async ensureStage0SeedTopic(courseId: string): Promise<void> {
    const existingStage0 = await this.plugin.cacheService.readStage(courseId, 0);
    if (existingStage0) return;

    const seedTopic = this.state.seedTopic.trim();
    if (!seedTopic) return;

    const cache: Stage0Cache = {
      courseId,
      seedTopic,
      taxonomy: [],
      selectedScope: [],
      scopeSummary: seedTopic,
      status: 'complete',
      completedAt: new Date().toISOString(),
    };
    await this.plugin.cacheService.writeStage(courseId, 0, cache);
  }

  private normalizeState(state: SyllabusEditorViewState): SyllabusEditorViewState {
    const courseId = state.courseId || state.curriculum?.courseId || '';
    return {
      ...state,
      courseId,
      curriculum: {
        ...state.curriculum,
        courseId,
      },
    };
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

function getGenerateButtonLabel(
  generatingLessons: boolean,
  generationComplete: boolean,
  completedLessons: number,
  selectedLessonCount: number
): string {
  if (generatingLessons) return selectedLessonCount > 1 ? 'Generating selected lessons…' : 'Generating selected lesson…';
  if (generationComplete) return 'All lessons generated';
  if (selectedLessonCount > 1) return `Generate ${selectedLessonCount} lessons`;
  if (selectedLessonCount === 1) return 'Generate selected lesson';
  if (completedLessons > 0) return 'Select lessons to generate';
  return 'Select lessons to begin';
}

function generateRecoveredCourseId(seedTopic: string): string {
  const topicSlug = seedTopic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'course';
  return `recovered-${topicSlug}-${Date.now().toString(36)}`;
}
