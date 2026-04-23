import { Plugin, Notice } from 'obsidian';
import { DEFAULT_SETTINGS, DelveSettings, DelveSettingsTab } from './settings';
import { OpenRouterService } from './services/openrouter';
import { CacheService } from './services/cache';
import { LockService } from './services/lock';
import { ContextService } from './services/context';
import { TopicInputModal } from './ui/topic-input-modal';
import { TaxonomyView } from './ui/taxonomy-view';
import { ConceptsView } from './ui/concepts-view';
import { DiagnosticView } from './ui/diagnostic-view';
import { SyllabusEditorView } from './ui/syllabus-editor-view';
import { ResumeModal } from './ui/resume-modal';
import { OpenCurriculumModal } from './ui/open-curriculum-modal';
import {
  TAXONOMY_VIEW_TYPE,
  CONCEPTS_VIEW_TYPE,
  DIAGNOSTIC_VIEW_TYPE,
  SYLLABUS_VIEW_TYPE,
} from './constants';
import { ensurePromptSettings, loadPrompt, loadRuntimeConfig, PromptConfig, PromptName } from './prompts';
import { runStage0 } from './stages/stage0-topic';
import { runStage1 } from './stages/stage1-concepts';
import { resumeStage3, runStage3 } from './stages/stage3-curriculum';
import { runStage4 } from './stages/stage4-generate';

export default class DelvePlugin extends Plugin {
  settings!: DelveSettings;
  llmService!: OpenRouterService;
  cacheService!: CacheService;
  lockService!: LockService;
  contextService!: ContextService;

  async onload(): Promise<void> {
    try {
      await this.loadSettings();
      this.initServices();
      await ensurePromptSettings(this);
      this.registerViews();
      this.registerCommands();
      this.addSettingTab(new DelveSettingsTab(this.app, this));
      await this.checkResume();
    } catch (e) {
      await this.handleLoadError(e as Error);
    }
  }

  async onunload(): Promise<void> {}

  async loadSettings(): Promise<void> {
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw?.settings ?? {});
  }

  async saveSettings(): Promise<void> {
    const raw = (await this.loadData()) ?? {};
    raw.settings = this.settings;
    await this.saveData(raw);
    const runtimeConfig = await loadRuntimeConfig(this);
    this.llmService.updateConfig(this.settings.openRouterApiKey, runtimeConfig.defaultModel);
  }

  async loadPrompt(name: PromptName): Promise<PromptConfig> {
    return loadPrompt(this, name);
  }

  private initServices(): void {
    this.llmService = new OpenRouterService(
      this.settings.openRouterApiKey,
      this.settings.defaultModel
    );
    this.cacheService = new CacheService(this);
    this.lockService = new LockService(this.app.vault);
    this.contextService = new ContextService(this.app.vault);
  }

  private registerViews(): void {
    this.registerView(TAXONOMY_VIEW_TYPE, leaf => new TaxonomyView(leaf, this));
    this.registerView(CONCEPTS_VIEW_TYPE, leaf => new ConceptsView(leaf, this));
    this.registerView(DIAGNOSTIC_VIEW_TYPE, leaf => new DiagnosticView(leaf, this));
    this.registerView(SYLLABUS_VIEW_TYPE, leaf => new SyllabusEditorView(leaf, this));
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'start-course',
      name: 'Start new course',
      callback: () => new TopicInputModal(this.app, this).open(),
    });

    this.addCommand({
      id: 'open-saved-curriculum',
      name: 'Open saved curriculum',
      callback: () => void this.openSavedCurriculum(),
    });
  }

  private async openSavedCurriculum(): Promise<void> {
    const courses = await this.cacheService.listCourses();
    const curricula = [];

    for (const course of courses) {
      const stage3 = await this.cacheService.readStage(course.courseId, 3);
      if (stage3?.curriculum) {
        curricula.push({
          ...course,
          title: stage3.curriculum.title || course.title,
        });
      }
    }

    if (curricula.length === 0) {
      new Notice('No saved curricula found.');
      return;
    }

    new OpenCurriculumModal(this.app, curricula, course => {
      void resumeStage3(this, course.courseId);
    }).open();
  }

  private async checkResume(): Promise<void> {
    try {
      const lock = await this.lockService.read();
      if (!lock) return;

      const modal = new ResumeModal(this.app, lock);
      const choice = await modal.waitForChoice();

      if (choice === 'resume') {
        await this.resumeStage(lock.courseId, lock.stage);
      } else {
        await this.lockService.release();
      }
    } catch (e) {
      console.warn('Delve: resume check failed', e);
    }
  }

  private async resumeStage(
    courseId: string,
    stage: number
  ): Promise<void> {
    if (stage === 0) {
      const cached = await this.cacheService.readStage(courseId, 0);
      if (!cached) return;

      if (cached.taxonomy?.length) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({
          type: TAXONOMY_VIEW_TYPE,
          active: true,
          state: { courseId, seedTopic: cached.seedTopic, taxonomy: cached.taxonomy },
        });
        this.app.workspace.revealLeaf(leaf);
      } else if (cached.seedTopic) {
        await runStage0(this, cached.seedTopic, courseId);
      }
    } else if (stage === 1) {
      const cached = await this.cacheService.readStage(courseId, 1);
      const stage0 = await this.cacheService.readStage(courseId, 0);
      if (cached?.concepts?.length && stage0) {
        const context = await this.contextService.build();
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({
          type: CONCEPTS_VIEW_TYPE,
          active: true,
          state: {
            courseId,
            seedTopic: stage0.seedTopic,
            concepts: cached.concepts,
            sourceMode: context.mode,
            fileCount: context.fileCount,
          },
        });
        this.app.workspace.revealLeaf(leaf);
        await this.lockService.release();
      } else if (stage0?.status === 'complete') {
        await runStage1(this, courseId);
      }
    } else if (stage === 2) {
      const stage1 = await this.cacheService.readStage(courseId, 1);
      const stage0 = await this.cacheService.readStage(courseId, 0);
      const stage2 = await this.cacheService.readStage(courseId, 2);
      if (stage1?.concepts?.length && stage0) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({
          type: DIAGNOSTIC_VIEW_TYPE,
          active: true,
          state: {
            courseId,
            seedTopic: stage0.seedTopic,
            concepts: stage1.concepts,
            savedProficiencyMap: stage2?.proficiencyMap,
          },
        });
        this.app.workspace.revealLeaf(leaf);
      }
    } else if (stage === 3) {
      await resumeStage3(this, courseId);
    } else if (stage === 4) {
      await runStage4(this, courseId);
    }
  }

  private async handleLoadError(error: Error): Promise<void> {
    console.error('Delve: failed to load', error);
    new Notice(`Delve failed to load: ${error.message}`);
    try {
      await this.app.vault.adapter.write(
        'delve-load-error.md',
        `# Delve failed to load\n\n${error.message}\n\n\`\`\`\n${error.stack}\n\`\`\``
      );
    } catch { /* ignore */ }
  }
}
