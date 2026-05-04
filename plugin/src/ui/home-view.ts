import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type DelvePlugin from '../../main';
import type { CourseSummary } from '../interfaces';
import { HOME_VIEW_TYPE } from '../constants';
import { runStage4 } from '../stages/stage4-generate';
import { resumeStage3 } from '../stages/stage3-curriculum';
import { TopicInputModal } from './topic-input-modal';

export class HomeView extends ItemView {
  private loading = false;

  constructor(leaf: WorkspaceLeaf, private plugin: DelvePlugin) {
    super(leaf);
  }

  getViewType(): string { return HOME_VIEW_TYPE; }

  getDisplayText(): string { return 'Delve'; }

  getIcon(): string { return 'library'; }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('delve-home');

    const header = contentEl.createDiv('delve-home__header');
    const titleBlock = header.createDiv('delve-home__title-block');
    titleBlock.createEl('h2', { text: 'Delve' });
    titleBlock.createEl('p', {
      text: 'Course dashboard',
      cls: 'delve-home__subtitle',
    });

    const actions = header.createDiv('delve-home__header-actions');
    const refreshBtn = actions.createEl('button', {
      text: 'Refresh',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    refreshBtn.disabled = this.loading;
    refreshBtn.addEventListener('click', () => void this.render());

    const newCourseBtn = actions.createEl('button', {
      text: 'Start new course',
      cls: 'mod-cta delve-btn-primary delve-home__new-course',
    }) as HTMLButtonElement;
    newCourseBtn.addEventListener('click', () => new TopicInputModal(this.app, this.plugin).open());

    const body = contentEl.createDiv('delve-home__body');
    this.loading = true;
    let summaries: CourseSummary[] = [];
    try {
      summaries = await this.plugin.cacheService.listCourseSummaries();
    } finally {
      this.loading = false;
    }

    if (summaries.length === 0) {
      const empty = body.createDiv('delve-home__empty');
      empty.createEl('h3', { text: 'No courses yet' });
      empty.createEl('p', { text: 'Start a course to see its curriculum and lesson progress here.' });
      return;
    }

    this.renderProgressOverview(body, summaries);

    const grid = body.createDiv('delve-home__grid');
    summaries.forEach(summary => this.renderCourseTile(grid, summary));
  }

  private renderProgressOverview(parent: HTMLElement, summaries: CourseSummary[]): void {
    const totals = summaries.reduce(
      (acc, summary) => {
        acc.totalNotes += summary.noteProgress.totalNotes;
        acc.readNotes += summary.noteProgress.readNotes;
        acc.flashcardsCreatedNotes += summary.noteProgress.flashcardsCreatedNotes;
        acc.reviewedNotes += summary.noteProgress.reviewedNotes;
        acc.generatedLessons += summary.completedLessons;
        acc.totalLessons += summary.totalLessons;
        return acc;
      },
      {
        totalNotes: 0,
        readNotes: 0,
        flashcardsCreatedNotes: 0,
        reviewedNotes: 0,
        generatedLessons: 0,
        totalLessons: 0,
      }
    );

    const overview = parent.createDiv('delve-home__overview');
    this.renderStat(overview, 'Lessons generated', `${totals.generatedLessons}/${totals.totalLessons}`);
    this.renderStat(overview, 'Read', `${totals.readNotes}/${totals.totalNotes}`);
    this.renderStat(overview, 'Flashcards', `${totals.flashcardsCreatedNotes}/${totals.totalNotes}`);
    this.renderStat(overview, 'Reviewed', `${totals.reviewedNotes}/${totals.totalNotes}`);
  }

  private renderCourseTile(parent: HTMLElement, summary: CourseSummary): void {
    const tile = parent.createDiv('delve-home__tile');

    const heading = tile.createDiv('delve-home__tile-heading');
    heading.createEl('h3', {
      text: summary.title,
      cls: 'delve-home__course-title',
    });
    heading.createEl('span', {
      text: summary.stageStatus === 'complete'
        ? `${summary.stageLabel} complete`
        : `${summary.stageLabel} pending`,
      cls: `delve-home__badge delve-home__badge--${summary.stageStatus}`,
    });

    const meta = tile.createDiv('delve-home__meta');
    meta.createEl('span', { text: `Updated ${formatDate(summary.updatedAt)}` });
    if (summary.outputRootPath) {
      meta.createEl('span', { text: summary.outputRootPath });
    }

    const lessonLabel = summary.totalLessons > 0
      ? `${summary.completedLessons}/${summary.totalLessons} lessons generated`
      : 'No curriculum lessons yet';
    tile.createEl('div', {
      text: lessonLabel,
      cls: 'delve-home__progress-label',
    });

    const progress = tile.createDiv('delve-home__progress');
    const fill = progress.createDiv('delve-home__progress-fill');
    fill.style.width = `${getProgressPercent(summary)}%`;

    const noteProgress = tile.createDiv('delve-home__note-progress');
    this.renderStat(noteProgress, 'Read', `${summary.noteProgress.readNotes}/${summary.noteProgress.totalNotes}`);
    this.renderStat(noteProgress, 'Flashcards', `${summary.noteProgress.flashcardsCreatedNotes}/${summary.noteProgress.totalNotes}`);
    this.renderStat(noteProgress, 'Reviewed', `${summary.noteProgress.reviewedNotes}/${summary.noteProgress.totalNotes}`);

    const tileActions = tile.createDiv('delve-home__tile-actions');
    const resumeBtn = tileActions.createEl('button', {
      text: summary.hasStage3Cache
        ? summary.currentStage >= 3 ? 'Open curriculum' : 'Resume'
        : 'Open index',
      cls: 'mod-cta delve-btn-primary delve-home__tile-primary',
    }) as HTMLButtonElement;
    resumeBtn.addEventListener('click', () => void this.openCourse(summary));

    const nextBtn = tileActions.createEl('button', {
      text: 'Generate next',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    nextBtn.disabled = summary.totalLessons === 0 || summary.completedLessons >= summary.totalLessons;
    nextBtn.addEventListener('click', () => void this.generateLessons(summary, 'next'));

    const remainingBtn = tileActions.createEl('button', {
      text: 'Generate remaining',
      cls: 'delve-taxonomy__action-btn',
    }) as HTMLButtonElement;
    remainingBtn.disabled = summary.remainingLessonIds.length === 0;
    remainingBtn.addEventListener('click', () => void this.generateLessons(summary, 'remaining'));

    if (summary.courseIndexPath && summary.hasStage3Cache) {
      const openIndexBtn = tileActions.createEl('button', {
        text: 'Open index',
        cls: 'delve-taxonomy__action-btn',
      }) as HTMLButtonElement;
      openIndexBtn.addEventListener('click', () => void this.openCourseIndex(summary));
    }
  }

  private async openCourse(summary: CourseSummary): Promise<void> {
    if (summary.hasStage3Cache && summary.currentStage >= 3) {
      await resumeStage3(this.plugin, summary.courseId);
      return;
    }
    if (summary.courseIndexPath) {
      await this.openCourseIndex(summary);
      return;
    }
    new Notice('Resume this course from the command palette once its curriculum has been drafted.');
  }

  private async generateLessons(summary: CourseSummary, mode: 'next' | 'remaining'): Promise<void> {
    try {
      if (mode === 'remaining') {
        await runStage4(this.plugin, summary.courseId, { mode: 'all' });
      } else {
        await runStage4(this.plugin, summary.courseId, { mode: 'next' });
      }
      await this.render();
    } catch (e) {
      new Notice(`Could not generate lessons: ${(e as Error).message}`);
    }
  }

  private renderStat(parent: HTMLElement, label: string, value: string): void {
    const stat = parent.createDiv('delve-home__stat');
    stat.createEl('span', { text: value, cls: 'delve-home__stat-value' });
    stat.createEl('span', { text: label, cls: 'delve-home__stat-label' });
  }

  private async openCourseIndex(summary: CourseSummary): Promise<void> {
    if (!summary.courseIndexPath) return;

    const file = this.app.vault.getAbstractFileByPath(summary.courseIndexPath);
    if (!(file instanceof TFile)) {
      new Notice('The generated course index could not be found.');
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }
}

function getProgressPercent(summary: CourseSummary): number {
  if (summary.totalLessons === 0) return 0;
  return Math.round((summary.completedLessons / summary.totalLessons) * 100);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
