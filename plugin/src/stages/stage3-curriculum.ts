import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type {
  Concept,
  Curriculum,
  LessonSpec,
  LikertScore,
  ModuleSpec,
  Stage3Cache,
} from '../interfaces';
import type { ContextPayload } from '../services/context';
import { Stage3ResponseSchema, validateAndRepair } from '../services/validator';
import { SYLLABUS_VIEW_TYPE } from '../constants';

export async function runStage3(
  plugin: DelvePlugin,
  courseId: string
): Promise<void> {
  await plugin.lockService.acquire(courseId, 3);

  const stage0 = await plugin.cacheService.readStage(courseId, 0);
  const stage1 = await plugin.cacheService.readStage(courseId, 1);
  const stage2 = await plugin.cacheService.readStage(courseId, 2);
  if (!stage0 || !stage1 || !stage2) {
    await plugin.lockService.release();
    throw new Error('Stage 0, 1, and 2 must be complete before curriculum design can begin.');
  }

  const context = await plugin.contextService.build();
  const placeholder = emptyCurriculum(courseId, stage0.seedTopic);
  await plugin.cacheService.writeStage(courseId, 3, {
    courseId,
    curriculum: placeholder,
    status: 'pending',
    startedAt: new Date().toISOString(),
  });

  const leaf = plugin.app.workspace.getLeaf(false);
  await leaf.setViewState({
    type: SYLLABUS_VIEW_TYPE,
    active: true,
    state: {
      courseId,
      seedTopic: stage0.seedTopic,
      curriculum: placeholder,
      sourceMode: context.mode,
      fileCount: context.fileCount,
      loading: true,
    },
  });
  plugin.app.workspace.revealLeaf(leaf);

  try {
    new Notice('Designing curriculum draft…');

    const promptTemplate = await plugin.loadPrompt('stage3-curriculum');
    const raw = await plugin.llmService.callJson<{ curriculum: Curriculum }>(
      promptTemplate,
      {
        courseId,
        topic: stage0.seedTopic,
        scopeSummary: stage0.scopeSummary,
        scopeNodes: buildScopeNodes(stage0.taxonomy, stage0.selectedScope) || stage0.scopeSummary,
        conceptProficiency: buildConceptProficiency(stage1.concepts, stage2.proficiencyMap),
        contextSection: buildContextSection(context),
      }
    );

    const validated = await validateAndRepair(
      raw,
      Stage3ResponseSchema,
      plugin.llmService,
      'Return { curriculum: { courseId, title, modules } } where each module has moduleId/title/description/lessons and each lesson has lessonId/title/description/prerequisites.'
    );

    const curriculum = normalizeCurriculum(courseId, validated.curriculum);
    const cache: Stage3Cache = {
      courseId,
      curriculum,
      status: 'complete',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await plugin.cacheService.writeStage(courseId, 3, cache);
    await plugin.lockService.release();

    await leaf.setViewState({
      type: SYLLABUS_VIEW_TYPE,
      active: true,
      state: {
        courseId,
        seedTopic: stage0.seedTopic,
        curriculum,
        sourceMode: context.mode,
        fileCount: context.fileCount,
        loading: false,
      },
    });
    plugin.app.workspace.revealLeaf(leaf);
  } catch (e) {
    await plugin.lockService.release();
    new Notice(`Delve: curriculum design failed — ${(e as Error).message}`);
    throw e;
  }
}

export async function resumeStage3(
  plugin: DelvePlugin,
  courseId: string
): Promise<void> {
  const stage0 = await plugin.cacheService.readStage(courseId, 0);
  const stage3 = await plugin.cacheService.readStage(courseId, 3);

  if (stage0 && stage3?.status === 'complete') {
    const context = await plugin.contextService.build();
    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: SYLLABUS_VIEW_TYPE,
      active: true,
      state: {
        courseId,
        seedTopic: stage0.seedTopic,
        curriculum: stage3.curriculum,
        sourceMode: context.mode,
        fileCount: context.fileCount,
        loading: false,
      },
    });
    plugin.app.workspace.revealLeaf(leaf);
    await plugin.lockService.release();
    return;
  }

  await runStage3(plugin, courseId);
}

function emptyCurriculum(courseId: string, seedTopic: string): Curriculum {
  return {
    courseId,
    title: `${seedTopic} Course`,
    modules: [],
  };
}

function buildContextSection(context: ContextPayload): string {
  if (context.mode === 'knowledge-only' || !context.content) {
    return 'No source material has been provided. Build the curriculum from general knowledge only.';
  }

  return `The learner has provided ${context.fileCount} source file(s). Prefer this material where it is strong; supplement with general knowledge where it is absent or incomplete.\n\n${context.content}`;
}

function buildScopeNodes(
  taxonomy: Array<{ id: string; title: string; children?: Array<{ id: string; title: string }> }>,
  selectedScope: string[]
): string {
  const titles = selectedScope
    .map(id => findNodeTitle(taxonomy, id))
    .filter((title): title is string => Boolean(title));
  return titles.join(', ');
}

function buildConceptProficiency(
  concepts: Concept[],
  proficiencyMap: Record<string, LikertScore>
): string {
  return JSON.stringify(
    concepts.map(concept => ({
      id: concept.id,
      title: concept.title,
      description: concept.description,
      sourceRefs: concept.sourceRefs ?? [],
      proficiency: proficiencyMap[concept.id] ?? 1,
    })),
    null,
    2
  );
}

function findNodeTitle(
  taxonomy: Array<{ id: string; title: string; children?: Array<{ id: string; title: string }> }>,
  id: string
): string | undefined {
  for (const node of taxonomy) {
    if (node.id === id) return node.title;
    if (node.children?.length) {
      const child = findNodeTitle(node.children, id);
      if (child) return child;
    }
  }

  return undefined;
}

function normalizeCurriculum(courseId: string, curriculum: Curriculum): Curriculum {
  return {
    ...curriculum,
    courseId,
    modules: curriculum.modules.map(normalizeModule),
  };
}

function normalizeModule(module: ModuleSpec, moduleIndex: number): ModuleSpec {
  const lessons = module.lessons.map((lesson, lessonIndex) => normalizeLesson(lesson, lessonIndex));
  const validLessonIds = new Set(lessons.map(lesson => lesson.lessonId));

  return {
    ...module,
    moduleId: module.moduleId || `module-${moduleIndex + 1}`,
    lessons: lessons.map(lesson => ({
      ...lesson,
      prerequisites: lesson.prerequisites.filter(prereq => validLessonIds.has(prereq)),
    })),
  };
}

function normalizeLesson(lesson: LessonSpec, lessonIndex: number): LessonSpec {
  return {
    ...lesson,
    lessonId: lesson.lessonId || `lesson-${lessonIndex + 1}`,
    prerequisites: lesson.prerequisites ?? [],
  };
}
