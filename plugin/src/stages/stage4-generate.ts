import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type {
  Curriculum,
  GeneratedLessonSummary,
  LessonDraft,
  LessonSpec,
  ModuleSpec,
  Stage4Cache,
  Stage4OutputPaths,
} from '../interfaces';
import type { ContextPayload, SourceMode } from '../services/context';
import { renderPromptTemplate } from '../services/openrouter';
import { VAULT_PATHS } from '../constants';
import { Stage4LessonResponseSchema } from '../services/validator';
import { writeCanvas } from '../writers/canvas';
import { buildFrontmatter } from '../writers/frontmatter';
import { writeMarkdownFile } from '../writers/markdown';
import { writeModuleMoc } from '../writers/moc';
import { buildNavigationLinks } from '../writers/navigation';

export async function runStage4(
  plugin: DelvePlugin,
  courseId: string
): Promise<void> {
  await plugin.lockService.acquire(courseId, 4);

  try {
    const stage0 = await plugin.cacheService.readStage(courseId, 0);
    const stage3 = await plugin.cacheService.readStage(courseId, 3);
    if (!stage0 || !stage3?.curriculum) {
      throw new Error('Stage 0 and Stage 3 must be complete before lesson generation can begin.');
    }

    const curriculum = stage3.curriculum;
    const context = await plugin.contextService.build();
    const outputs = buildOutputPaths(curriculum);
    await ensureFolderTree(plugin, outputs);

    const lessonOrder = flattenLessons(curriculum);
    const totalLessons = lessonOrder.length;
    const existingCache = (await plugin.cacheService.readStage(courseId, 4)) as Stage4Cache | undefined;
    const startedAt = existingCache?.startedAt ?? new Date().toISOString();
    const completedLessonIds = normalizeCompletedLessonIds(existingCache, outputs);
    const generatedLessonSummaries = existingCache?.generatedLessonSummaries ?? {};
    const nextLesson = lessonOrder.find(item => !completedLessonIds.includes(item.lesson.lessonId));

    if (!nextLesson) {
      const completeCache: Stage4Cache = {
        courseId,
        progress: {
          totalLessons,
          completedLessons: totalLessons,
        },
        outputs,
        completedLessonIds,
        generatedLessonSummaries,
        status: 'complete',
        startedAt,
        completedAt: existingCache?.completedAt ?? new Date().toISOString(),
      };
      await plugin.cacheService.writeStage(courseId, 4, completeCache);
      new Notice('All lesson notes have already been generated.');
      return;
    }

    await plugin.cacheService.writeStage(courseId, 4, {
      courseId,
      progress: {
        totalLessons,
        completedLessons: completedLessonIds.length,
        currentLesson: nextLesson.lesson.title,
      },
      outputs,
      completedLessonIds,
      generatedLessonSummaries,
      status: 'pending',
      startedAt,
    });

    new Notice(`Generating lesson ${completedLessonIds.length + 1} of ${totalLessons}: ${nextLesson.lesson.title}`);

    const promptConfig = await plugin.loadPrompt('stage4-lesson');
    const promptVariables = {
      topic: stage0.seedTopic,
      courseTitle: curriculum.title,
      moduleTitle: nextLesson.module.title,
      lessonTitle: nextLesson.lesson.title,
      lessonDescription: nextLesson.lesson.description,
      prerequisiteSummary: describePrerequisites(nextLesson.lesson, lessonOrder, generatedLessonSummaries),
      generationMode: context.mode,
      contextSection: buildContextSection(context),
    };
    const renderedPrompt = renderPromptTemplate(promptConfig.template, promptVariables);
    const raw = await plugin.llmService.callJson<{ lesson: LessonDraft }>(
      promptConfig.template,
      promptVariables,
      promptConfig.model
    );

    const validated = await validateLessonDraft(
      plugin,
      raw,
      promptConfig.model,
      renderedPrompt,
      stage0.seedTopic,
      nextLesson.module.title,
      nextLesson.lesson
    );
    const draft: LessonDraft = {
      ...validated.lesson,
      difficulty: validated.lesson.difficulty as LessonDraft['difficulty'],
      sourceRefs: validated.lesson.sourceRefs ?? [],
    };

    await writeLessonOutput(
      plugin,
      curriculum,
      outputs,
      nextLesson.module,
      nextLesson.lesson,
      draft,
      context.mode,
      renderedPrompt
    );

    const updatedCompletedLessonIds = [...completedLessonIds, nextLesson.lesson.lessonId];
    const updatedGeneratedLessonSummaries = {
      ...generatedLessonSummaries,
      [nextLesson.lesson.lessonId]: {
        title: draft.title,
        summary: draft.summary,
      },
    };

    await writeSupportingOutputs(plugin, curriculum, outputs);

    const isComplete = updatedCompletedLessonIds.length === totalLessons;
    const cache: Stage4Cache = {
      courseId,
      progress: {
        totalLessons,
        completedLessons: updatedCompletedLessonIds.length,
      },
      outputs,
      completedLessonIds: updatedCompletedLessonIds,
      generatedLessonSummaries: updatedGeneratedLessonSummaries,
      status: isComplete ? 'complete' : 'pending',
      startedAt,
      completedAt: isComplete ? new Date().toISOString() : undefined,
    };
    await plugin.cacheService.writeStage(courseId, 4, cache);

    new Notice(
      isComplete
        ? `Generated all ${totalLessons} lessons in ${outputs.rootDir}.`
        : `Generated ${draft.title}. ${totalLessons - updatedCompletedLessonIds.length} lesson${totalLessons - updatedCompletedLessonIds.length === 1 ? '' : 's'} remaining.`
    );
  } catch (error) {
    new Notice(`Delve: lesson generation failed — ${(error as Error).message}`);
    throw error;
  } finally {
    await plugin.lockService.release();
  }
}

function buildOutputPaths(curriculum: Curriculum): Stage4OutputPaths {
  const courseSlug = slugify(curriculum.title || curriculum.courseId);
  const rootDir = `${VAULT_PATHS.CURRICULUM}/${courseSlug}`;
  const courseIndexPath = `${rootDir}/Course Index.md`;
  const canvasPath = `${rootDir}/${safeFileName(curriculum.title)}.canvas`;
  const modulePaths: Record<string, string> = {};
  const lessonPaths: Record<string, string> = {};

  curriculum.modules.forEach((module, moduleIndex) => {
    const moduleDir = `${rootDir}/${padNumber(moduleIndex + 1)}-${slugify(module.title)}`;
    modulePaths[module.moduleId] = `${moduleDir}/Module MOC.md`;
    module.lessons.forEach((lesson, lessonIndex) => {
      lessonPaths[lesson.lessonId] =
        `${moduleDir}/${padNumber(lessonIndex + 1)}-${slugify(lesson.title)}.md`;
    });
  });

  return {
    rootDir,
    courseIndexPath,
    canvasPath,
    modulePaths,
    lessonPaths,
  };
}

async function ensureFolderTree(
  plugin: DelvePlugin,
  outputs: Stage4OutputPaths
): Promise<void> {
  const directories = new Set<string>([VAULT_PATHS.CURRICULUM, outputs.rootDir]);
  Object.values(outputs.modulePaths).forEach(path => directories.add(dirname(path)));
  Object.values(outputs.lessonPaths).forEach(path => directories.add(dirname(path)));

  for (const dir of directories) {
    await ensureFolder(plugin, dir);
  }
}

async function ensureFolder(plugin: DelvePlugin, path: string): Promise<void> {
  if (!path || path === '.') return;
  const exists = await plugin.app.vault.adapter.exists(path);
  if (exists) return;
  await plugin.app.vault.adapter.mkdir?.(path);
}

function normalizeCompletedLessonIds(
  cache: Stage4Cache | undefined,
  outputs: Stage4OutputPaths
): string[] {
  const completedLessonIds = cache?.completedLessonIds ?? [];
  const knownLessonIds = new Set(Object.keys(outputs.lessonPaths));
  return completedLessonIds.filter(lessonId => knownLessonIds.has(lessonId));
}

async function writeSupportingOutputs(
  plugin: DelvePlugin,
  curriculum: Curriculum,
  outputs: Stage4OutputPaths
): Promise<void> {
  const courseIndexLink = wikiLinkFromPath(outputs.courseIndexPath);

  await writeMarkdownFile(
    plugin,
    outputs.courseIndexPath,
    buildCourseIndex(curriculum, outputs)
  );

  for (const module of curriculum.modules) {
    const moduleLessonLinks = module.lessons.map(lesson =>
      wikiLinkFromPath(outputs.lessonPaths[lesson.lessonId])
    );
    await writeModuleMoc(
      plugin,
      outputs.modulePaths[module.moduleId],
      module,
      courseIndexLink,
      moduleLessonLinks
    );
  }

  await writeCanvas(
    plugin,
    curriculum,
    outputs.canvasPath,
    outputs.lessonPaths,
    outputs.modulePaths,
    outputs.courseIndexPath
  );
}

async function writeLessonOutput(
  plugin: DelvePlugin,
  curriculum: Curriculum,
  outputs: Stage4OutputPaths,
  module: ModuleSpec,
  lesson: LessonSpec,
  draft: LessonDraft,
  mode: SourceMode,
  renderedPrompt: string
): Promise<void> {
  const lessonOrder = flattenLessons(curriculum);
  const flatLessons = lessonOrder.map(item => item.lesson);
  const lessonIndex = flatLessons.findIndex(item => item.lessonId === lesson.lessonId);
  const previous = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : undefined;
  const next = lessonIndex < flatLessons.length - 1 ? flatLessons[lessonIndex + 1] : undefined;
  const navigation = buildNavigationLinks(
    wikiLinkFromPath(outputs.courseIndexPath),
    wikiLinkFromPath(outputs.modulePaths[module.moduleId]),
    previous ? wikiLinkFromPath(outputs.lessonPaths[previous.lessonId]) : undefined,
    next ? wikiLinkFromPath(outputs.lessonPaths[next.lessonId]) : undefined
  );

  const content = [
    buildFrontmatter({
      status: 'draft',
      difficulty: draft.difficulty,
      lessonId: lesson.lessonId,
      moduleId: module.moduleId,
      generationMode: mode,
      sourceRefs: draft.sourceRefs,
      generatedAt: new Date().toISOString(),
    }),
    '',
    `# ${draft.title}`,
    '',
    navigation.breadcrumbs,
    '',
    `> ${draft.summary}`,
    '',
    draft.bodyMarkdown.trim(),
    '',
    buildPromptCallout(renderedPrompt),
    '',
    '---',
    '',
    navigation.sequence,
  ].join('\n');

  await writeMarkdownFile(plugin, outputs.lessonPaths[lesson.lessonId], content);
}

async function validateLessonDraft(
  plugin: DelvePlugin,
  raw: unknown,
  model: string,
  renderedPrompt: string,
  topic: string,
  moduleTitle: string,
  lesson: LessonSpec
): Promise<{ lesson: LessonDraft }> {
  const initial = Stage4LessonResponseSchema.safeParse(raw);
  if (initial.success && !looksOffTopic(initial.data.lesson, topic, moduleTitle, lesson)) {
    return initial.data;
  }

  const issues = initial.success
    ? ['lesson drifted away from the requested topic and focused on output-format or JSON/schema details']
    : initial.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);

  const repaired = await plugin.llmService.callJson<{ lesson: LessonDraft }>(
    buildLessonRepairPrompt(renderedPrompt, topic, moduleTitle, lesson, raw, issues),
    {},
    model
  );

  const repairedResult = Stage4LessonResponseSchema.parse(repaired);
  if (looksOffTopic(repairedResult.lesson, topic, moduleTitle, lesson)) {
    throw new Error(`Generated lesson drifted off-topic for "${lesson.title}".`);
  }

  return repairedResult;
}

function buildLessonRepairPrompt(
  renderedPrompt: string,
  topic: string,
  moduleTitle: string,
  lesson: LessonSpec,
  raw: unknown,
  issues: string[]
): string {
  return [
    'You are repairing a lesson-generation response for an Obsidian course builder.',
    '',
    `The lesson MUST remain about "${lesson.title}" in module "${moduleTitle}" for topic "${topic}".`,
    `Lesson brief: ${lesson.description}`,
    '',
    'Do not write about JSON, schemas, validation, output formatting, API payloads, or prompt instructions unless the requested lesson is explicitly about those topics.',
    'Preserve the intended teaching task and rewrite the response as valid JSON only.',
    '',
    'Original lesson-generation prompt:',
    renderedPrompt,
    '',
    'Problem with the previous response:',
    ...issues.map(issue => `- ${issue}`),
    '',
    'Previous response:',
    JSON.stringify(raw, null, 2),
    '',
    'Return exactly:',
    '{',
    '  "lesson": {',
    '    "title": "Lesson title aligned with the requested lesson",',
    '    "summary": "1-2 sentence summary of the requested lesson",',
    '    "difficulty": "intro | intermediate | advanced",',
    '    "bodyMarkdown": "# Markdown lesson body",',
    '    "sourceRefs": []',
    '  }',
    '}',
  ].join('\n');
}

function looksOffTopic(
  draft: LessonDraft,
  topic: string,
  moduleTitle: string,
  lesson: LessonSpec
): boolean {
  const requestedText = `${topic} ${moduleTitle} ${lesson.title} ${lesson.description}`.toLowerCase();
  const generatedText = `${draft.title} ${draft.summary} ${draft.bodyMarkdown}`.toLowerCase();
  const generatedRefs = draft.sourceRefs.map(ref => ref.toLowerCase()).join(' ');

  const metaSignals = [
    'json schema',
    'schema validation',
    'validation error',
    'expected object',
    'received array',
    'bodymarkdown',
    'sourcerefs',
    'return a json object',
    'yaml frontmatter',
  ];

  const requestedIsJsonLesson = /\bjson\b|\bschema\b/.test(requestedText);
  if (requestedIsJsonLesson) return false;

  const signalCount = metaSignals.reduce((count, signal) => {
    return count + (generatedText.includes(signal) ? 1 : 0) + (generatedRefs.includes(signal) ? 1 : 0);
  }, 0);

  if (signalCount >= 1) return true;
  if (/\bjson\b/.test(generatedText) || /\bjson\b/.test(generatedRefs)) return true;

  return false;
}

function buildPromptCallout(renderedPrompt: string): string {
  const lines = renderedPrompt.trim().split('\n');
  const quotedPrompt = [
    '> [!note]- Generation Prompt',
    '> ```text',
    ...lines.map(line => `> ${line}`),
    '> ```',
  ];
  return quotedPrompt.join('\n');
}

function buildCourseIndex(curriculum: Curriculum, outputs: Stage4OutputPaths): string {
  const lines = [
    `# ${curriculum.title}`,
    '',
    '## Modules',
    '',
  ];

  curriculum.modules.forEach(module => {
    lines.push(`- ${wikiLinkFromPath(outputs.modulePaths[module.moduleId])}`);
    module.lessons.forEach(lesson => {
      lines.push(`  - ${wikiLinkFromPath(outputs.lessonPaths[lesson.lessonId])}`);
    });
  });

  lines.push('', `Canvas: ${wikiLinkFromPath(outputs.canvasPath)}`);
  return lines.join('\n');
}

function flattenLessons(curriculum: Curriculum): Array<{ module: ModuleSpec; lesson: LessonSpec }> {
  return curriculum.modules.flatMap(module =>
    module.lessons.map(lesson => ({ module, lesson }))
  );
}

function describePrerequisites(
  lesson: LessonSpec,
  lessonOrder: Array<{ module: ModuleSpec; lesson: LessonSpec }>,
  generatedLessonSummaries: Record<string, GeneratedLessonSummary>
): string {
  if (lesson.prerequisites.length === 0) return 'None';

  return lesson.prerequisites
    .map(prereqId => {
      const prereq = lessonOrder.find(item => item.lesson.lessonId === prereqId)?.lesson;
      const generated = generatedLessonSummaries[prereqId];
      return prereq
        ? `${prereq.title}: ${generated?.summary ?? prereq.description}`
        : prereqId;
    })
    .join('\n');
}

function buildContextSection(context: ContextPayload): string {
  if (context.mode === 'knowledge-only' || !context.content) {
    return 'No source material has been provided. Write the lesson using general knowledge only.';
  }

  return `The learner has provided ${context.fileCount} source file(s). Prefer this material where it is strong; supplement with general knowledge when needed.\n\n${context.content}`;
}

function wikiLinkFromPath(path: string): string {
  const basename = path.split('/').pop()?.replace(/\.(md|canvas)$/i, '') ?? path;
  return `[[${basename}]]`;
}

function dirname(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'course';
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '').trim() || 'Course';
}

function padNumber(value: number): string {
  return String(value).padStart(2, '0');
}
