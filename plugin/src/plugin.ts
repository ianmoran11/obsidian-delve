import { Plugin, Notice, WorkspaceLeaf } from 'obsidian';
import { DelveSettings, DelveSettingsTab, DEFAULT_SETTINGS } from './settings';
import { CacheService } from './services/cache';
import { LockService } from './services/lock';
import { OpenRouterService } from './services/openrouter';
import { ContextService } from './services/context';
import { TopicInputModal } from './ui/topic-input-modal';
import { ResumeModal } from './ui/resume-modal';
import { TaxonomyView, TAXONOMY_VIEW_TYPE } from './ui/taxonomy-view';
import { runStage0 } from './stages/stage0-topic';
import type { AllPluginData, CourseId } from './interfaces';

function generateCourseId(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const ts = Date.now().toString(36);
  return `${slug}-${ts}`;
}

export class DelvePlugin extends Plugin {
  settings!: DelveSettings;
  cache!: CacheService;
  lock!: LockService;
  llm!: OpenRouterService;
  context!: ContextService;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async onload(): Promise<void> {
    try {
      await this.loadSettings();

      this.cache = new CacheService(
        () => this.loadAll(),
        d => this.saveAll(d),
      );
      this.lock = new LockService(this.app.vault);
      this.llm = new OpenRouterService(
        this.settings.openrouterApiKey,
        this.settings.defaultModel,
      );
      this.context = new ContextService(this.app.vault);

      this.registerView(
        TAXONOMY_VIEW_TYPE,
        (leaf: WorkspaceLeaf) => new TaxonomyView(leaf),
      );

      this.addSettingTab(new DelveSettingsTab(this.app, this));

      this.addCommand({
        id: 'delve:start-course',
        name: 'Start new course',
        callback: () => void this.startCourse(),
      });

      this.addCommand({
        id: 'delve:resume-course',
        name: 'Resume interrupted course',
        callback: () => void this.checkAndOfferResume(),
      });

      await this.checkAndOfferResume();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`Delve failed to load: ${msg}`);
      console.error('Delve load error:', err);
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TAXONOMY_VIEW_TYPE);
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async loadSettings(): Promise<void> {
    const all = await this.loadAll();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, all.settings) as DelveSettings;
    this.settings.promptOverrides = {
      ...(DEFAULT_SETTINGS.promptOverrides),
      ...((all.settings.promptOverrides as DelveSettings['promptOverrides']) ?? {}),
    };
  }

  async saveSettings(): Promise<void> {
    const all = await this.loadAll();
    all.settings = this.settings as unknown as Record<string, unknown>;
    await this.saveAll(all);
    this.llm?.updateCredentials(this.settings.openrouterApiKey, this.settings.defaultModel);
  }

  // ─── Internal data I/O ────────────────────────────────────────────────────

  async loadAll(): Promise<AllPluginData> {
    const raw = (await this.loadData()) as Partial<AllPluginData> | null;
    return {
      settings: raw?.settings ?? {},
      courses: raw?.courses ?? {},
      activeCourseId: raw?.activeCourseId,
    };
  }

  async saveAll(data: AllPluginData): Promise<void> {
    await this.saveData(data);
  }

  // ─── Course flow ──────────────────────────────────────────────────────────

  private async startCourse(): Promise<void> {
    const lockData = await this.lock.read();
    if (lockData) {
      new ResumeModal(this.app, lockData, async choice => {
        if (choice === 'resume') {
          await this.resumeCourse(lockData.courseId, lockData.stage);
        } else if (choice === 'restart') {
          await this.lock.release();
          this.openTopicInput();
        }
      }).open();
      return;
    }
    this.openTopicInput();
  }

  private openTopicInput(): void {
    if (!this.settings.openrouterApiKey) {
      new Notice('Delve: Set your OpenRouter API key in settings first.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app as any).setting?.open();
      return;
    }

    new TopicInputModal(this.app, async topic => {
      const courseId: CourseId = generateCourseId(topic);
      await this.cache.setActiveCourseId(courseId);
      this.llm.updateCredentials(
        this.settings.openrouterApiKey,
        this.settings.defaultModel,
      );

      try {
        await runStage0(
          this.app,
          courseId,
          topic,
          this.llm,
          this.cache,
          this.lock,
          this.context,
          this.settings.promptOverrides.stage0,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        new Notice(`Delve: Stage 0 failed — ${msg}`);
        console.error('Delve Stage 0 error:', err);
        await this.lock.release();
      }
    }).open();
  }

  private async checkAndOfferResume(): Promise<void> {
    const lockData = await this.lock.read();
    if (!lockData) return;

    new ResumeModal(this.app, lockData, async choice => {
      if (choice === 'resume') {
        await this.resumeCourse(lockData.courseId, lockData.stage);
      } else if (choice === 'restart') {
        await this.lock.release();
      }
    }).open();
  }

  private async resumeCourse(courseId: CourseId, stage: number): Promise<void> {
    if (stage === 0) {
      const s0 = await this.cache.readStage(courseId, 0);
      if (s0 && !s0.completedAt && s0.taxonomy.length > 0) {
        // Taxonomy was generated but scope not yet confirmed — re-open the view
        new Notice('Delve: Resuming scope selection…');
        const { reopenTaxonomyView } = await import('./stages/stage0-topic');
        await reopenTaxonomyView(this.app, courseId, s0.taxonomy, this.cache, this.lock);
        return;
      }
    }

    // Stages 1–4: not yet implemented
    new Notice(`Delve: Resume for Stage ${stage} coming in a future update.`);
    await this.lock.release();
  }
}
