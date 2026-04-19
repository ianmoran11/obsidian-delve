import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type {
  Curriculum,
  LessonDraft,
  LessonSpec,
  ModuleSpec,
  Stage4Cache,
  Stage4OutputPaths,
} from '../interfaces';
import type { ContextPayload, SourceMode } from '../services/context';
import { VAULT_PATHS } from '../constants';
import { loadPrompt } from '../prompts';
import { Stage4LessonResponseSchema, validateAndRepair } from '../services/validator';
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

  const stage0 = await plugin.cacheService.readStage(courseId, 0);
  const stage3 = await plugin.cacheService.readStage(courseId, 3);
  if (!stage0 || !stage3?.curriculum) {
    await plugin.lockService.release();
    throw new Error('Stage 0 and Stage 3 must be complete before lesson generation can begin.');
  }

  const curriculum = stage3.curriculum;
  const context = await plugin.contextService.build();
  const outputs = buildOutputPaths(curriculum);
  await ensureFolderTree(plugin, outputs);

  const totalLessons = curriculum.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  await plugin.cacheService.writeStage(courseId, 4, {
    courseId,
    progress: {
      totalLessons,
      completedLessons: 0,
    },
    outputs,
    status: 'pending',
    startedAt: new Date().toISOString(),
  });

  try {
    new Notice('Generating lesson notes…');

    const promptTemplate = await loadPrompt(plugin, 'stage4-lesson');
    const lessonOrder = flattenLessons(curriculum);
    const lessonDrafts = new Map<string, LessonDraft>();

    for (let index = 0; index < lessonOrder.length; index++) {
      const item = lessonOrder[index];
      const { module, lesson } = item;
      await plugin.cacheService.writeStage(courseId, 4, {
        courseId,
        progress: {
          totalLessons,
          completedLessons: index,
          currentLesson: lesson.title,
        },
        outputs,
        status: 'pending',
        startedAt: new Date().toISOString(),
      });

      const raw = await plugin.llmService.callJson<{ lesson: LessonDraft }>(
        promptTemplate,
        {
          topic: stage0.seedTopic,
          courseTitle: curriculum.title,
          moduleTitle: module.title,
          lessonTitle: lesson.title,
          lessonDescription: lesson.description,
          prerequisiteSummary: describePrerequisites(lesson, lessonOrder, lessonDrafts),
          generationMode: context.mode,
          contextSection: buildContextSection(context),
        }
      );

      const validated = await validateAndRepair(
        raw,
        Stage4LessonResponseSchema,
        plugin.llmService,
        'Return { lesson: { title, summary, difficulty, bodyMarkdown, sourceRefs } } with non-empty Markdown in bodyMarkdown.'
      );
      lessonDrafts.set(lesson.lessonId, {
        ...validated.lesson,
        difficulty: validated.lesson.difficulty as LessonDraft['difficulty'],
        sourceRefs: validated.lesson.sourceRefs ?? [],
      });
    }

    await writeCourseOutputs(plugin, curriculum, outputs, lessonDrafts, context.mode);

    const cache: Stage4Cache = {
      courseId,
      progress: {
        totalLessons,
        completedLessons: totalLessons,
      },
      outputs,
      status: 'complete',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await plugin.cacheService.writeStage(courseId, 4, cache);
    await plugin.lockService.release();
    new Notice(`Generated ${totalLessons} lessons in ${outputs.rootDir}.`);
  } catch (error) {
    await plugin.lockService.release();
    new Notice(`Delve: lesson generation failed — ${(error as Error).message}`);
    throw error;
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

async function writeCourseOutputs(
  plugin: DelvePlugin,
  curriculum: Curriculum,
  outputs: Stage4OutputPaths,
  lessonDrafts: Map<string, LessonDraft>,
  mode: SourceMode
): Promise<void> {
  const lessonOrder = flattenLessons(curriculum);
  const courseIndexLink = wikiLinkFromPath(outputs.courseIndexPath);
  const lessonLinks = lessonOrder.map(item => wikiLinkFromPath(outputs.lessonPaths[item.lesson.lessonId]));
  const flatLessons = lessonOrder.map(item => item.lesson);

  await writeMarkdownFile(
    plugin,
    outputs.courseIndexPath,
    buildCourseIndex(curriculum, outputs)
  );

  for (const module of curriculum.modules) {
    const moduleLink = wikiLinkFromPath(outputs.modulePaths[module.moduleId]);
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

    for (const lesson of module.lessons) {
      const draft = lessonDrafts.get(lesson.lessonId);
      if (!draft) {
        throw new Error(`Missing generated lesson draft for ${lesson.lessonId}`);
      }
      const lessonIndex = flatLessons.findIndex(item => item.lessonId === lesson.lessonId);
      const previous = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : undefined;
      const next = lessonIndex < flatLessons.length - 1 ? flatLessons[lessonIndex + 1] : undefined;
      const navigation = buildNavigationLinks(
        courseIndexLink,
        moduleLink,
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
        '---',
        '',
        navigation.sequence,
      ].join('\n');

      await writeMarkdownFile(plugin, outputs.lessonPaths[lesson.lessonId], content);
    }
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
  lessonDrafts: Map<string, LessonDraft>
): string {
  if (lesson.prerequisites.length === 0) return 'None';

  return lesson.prerequisites
    .map(prereqId => {
      const prereq = lessonOrder.find(item => item.lesson.lessonId === prereqId)?.lesson;
      const draft = lessonDrafts.get(prereqId);
      return prereq
        ? `${prereq.title}: ${draft?.summary ?? prereq.description}`
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
