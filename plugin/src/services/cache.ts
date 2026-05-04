import type DelvePlugin from '../../main';
import type {
  CourseId,
  CourseMeta,
  CourseSummary,
  NoteProgressSummary,
  PluginData,
  StageId,
  StageCache,
  Stage0Cache,
  Stage1Cache,
  Stage2Cache,
  Stage3Cache,
  Stage4Cache,
} from '../interfaces';
import { VAULT_PATHS } from '../constants';

type StageDataMap = {
  0: Stage0Cache;
  1: Stage1Cache;
  2: Stage2Cache;
  3: Stage3Cache;
  4: Stage4Cache;
};

export class CacheService {
  constructor(private plugin: DelvePlugin) {}

  async readAll(): Promise<PluginData> {
    const raw = (await this.plugin.loadData()) as PluginData | null;
    return {
      settings: raw?.settings,
      courses: raw?.courses ?? {},
      meta: raw?.meta ?? {},
    };
  }

  async readCourse(courseId: CourseId): Promise<StageCache> {
    const data = await this.readAll();
    return data.courses[courseId] ?? {};
  }

  async readStage<S extends keyof StageDataMap>(
    courseId: CourseId,
    stage: S
  ): Promise<StageDataMap[S] | undefined> {
    const cache = await this.readCourse(courseId);
    return cache[stage] as StageDataMap[S] | undefined;
  }

  async writeStage<S extends keyof StageDataMap>(
    courseId: CourseId,
    stage: S,
    payload: StageDataMap[S]
  ): Promise<void> {
    const data = await this.readAll();
    if (!data.courses[courseId]) data.courses[courseId] = {};
    (data.courses[courseId] as StageCache)[stage] = payload as never;
    await this.plugin.saveData(data);
  }

  async writeMeta(meta: CourseMeta): Promise<void> {
    const data = await this.readAll();
    data.meta[meta.courseId] = meta;
    await this.plugin.saveData(data);
  }

  async listCourses(): Promise<CourseMeta[]> {
    const data = await this.readAll();
    const courseIds = new Set([
      ...Object.keys(data.courses),
      ...Object.keys(data.meta),
    ]);

    return [...courseIds]
      .map(courseId => {
        const meta = data.meta[courseId];
        if (meta) {
          return {
            ...meta,
            title: this.deriveCourseTitle(courseId, data.courses[courseId]) ?? meta.title,
          };
        }

        const course = data.courses[courseId];
        return {
          courseId,
          title: this.deriveCourseTitle(courseId, course) ?? courseId,
          createdAt: this.deriveCreatedAt(course) ?? new Date(0).toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listCourseSummaries(): Promise<CourseSummary[]> {
    const data = await this.readAll();
    const courseIds = new Set([
      ...Object.keys(data.courses),
      ...Object.keys(data.meta),
    ]);

    const summaries = new Map<string, CourseSummary>();
    for (const courseId of courseIds) {
      summaries.set(
        courseId,
        await this.deriveCourseSummary(courseId, data.courses[courseId], data.meta[courseId])
      );
    }

    for (const summary of await this.discoverGeneratedCourseSummaries()) {
      const existingKey = findMatchingSummaryKey(summaries, summary);
      if (existingKey) summaries.set(existingKey, mergeGeneratedSummary(summaries.get(existingKey), summary));
      else summaries.set(summary.courseId, summary);
    }

    return [...summaries.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async clearCourse(courseId: CourseId): Promise<void> {
    const data = await this.readAll();
    delete data.courses[courseId];
    delete data.meta[courseId];
    await this.plugin.saveData(data);
  }

  private deriveCourseTitle(courseId: CourseId, course?: StageCache): string | undefined {
    return course?.[3]?.curriculum?.title
      || course?.[0]?.seedTopic
      || this.readableCourseId(courseId);
  }

  private async deriveCourseSummary(
    courseId: CourseId,
    course?: StageCache,
    meta?: CourseMeta
  ): Promise<CourseSummary> {
    const currentStage = this.deriveCurrentStage(course);
    const allLessonIds = course?.[3]?.curriculum?.modules
      .flatMap(module => module.lessons.map(lesson => lesson.lessonId)) ?? [];
    const completedLessonIds = new Set(course?.[4]?.completedLessonIds ?? []);
    const completedLessons = Math.min(
      completedLessonIds.size || course?.[4]?.progress.completedLessons || 0,
      allLessonIds.length
    );
    const lessonPaths = allLessonIds
      .map(lessonId => course?.[4]?.outputs?.lessonPaths?.[lessonId])
      .filter((path): path is string => Boolean(path));
    const noteProgress = await this.readNoteProgressSummary(lessonPaths, allLessonIds.length);

    return {
      courseId,
      title: this.deriveCourseTitle(courseId, course) ?? meta?.title ?? this.readableCourseId(courseId),
      createdAt: meta?.createdAt ?? this.deriveCreatedAt(course) ?? new Date(0).toISOString(),
      updatedAt: this.deriveUpdatedAt(course, meta) ?? new Date(0).toISOString(),
      currentStage,
      stageLabel: this.describeStage(currentStage),
      stageStatus: this.deriveStageStatus(course, currentStage),
      totalLessons: allLessonIds.length,
      completedLessons,
      remainingLessonIds: allLessonIds.filter(lessonId => !completedLessonIds.has(lessonId)),
      outputRootPath: course?.[4]?.outputs?.rootDir,
      courseIndexPath: course?.[4]?.outputs?.courseIndexPath,
      hasStage3Cache: Boolean(course?.[3]?.curriculum),
      noteProgress,
    };
  }

  private async discoverGeneratedCourseSummaries(): Promise<CourseSummary[]> {
    const adapter = this.plugin.app?.vault?.adapter;
    if (!adapter) return [];
    if (!('list' in adapter)) return [];

    let courseFolders: string[];
    try {
      const listing = await adapter.list(VAULT_PATHS.CURRICULUM);
      courseFolders = listing.folders;
    } catch {
      return [];
    }

    const summaries = await Promise.all(
      courseFolders.map(folder => this.discoverGeneratedCourseSummary(folder))
    );
    return summaries.filter((summary): summary is CourseSummary => Boolean(summary));
  }

  private async discoverGeneratedCourseSummary(folder: string): Promise<CourseSummary | undefined> {
    const adapter = this.plugin.app.vault.adapter;
    const courseIndexPath = `${folder}/Course Index.md`;
    if (!(await this.adapterExists(courseIndexPath))) return undefined;

    const markdownFiles = await this.listMarkdownFiles(folder);
    const lessonPaths = markdownFiles.filter(path => !isGeneratedCourseSupportFile(path));
    const title = await this.readGeneratedCourseTitle(courseIndexPath, folder);
    const updatedAt = await this.deriveGeneratedCourseUpdatedAt([courseIndexPath, ...lessonPaths]);
    const noteProgress = await this.readNoteProgressSummary(lessonPaths);

    return {
      courseId: folder.split('/').pop() ?? folder,
      title,
      createdAt: updatedAt,
      updatedAt,
      currentStage: 4,
      stageLabel: 'Lessons',
      stageStatus: 'complete',
      totalLessons: lessonPaths.length,
      completedLessons: lessonPaths.length,
      remainingLessonIds: [],
      outputRootPath: folder,
      courseIndexPath,
      hasStage3Cache: false,
      noteProgress,
    };
  }

  private async readNoteProgressSummary(
    lessonPaths: string[],
    fallbackTotal = lessonPaths.length
  ): Promise<NoteProgressSummary> {
    const summary: NoteProgressSummary = {
      totalNotes: Math.max(fallbackTotal, lessonPaths.length),
      readNotes: 0,
      flashcardsCreatedNotes: 0,
      reviewedNotes: 0,
    };
    const adapter = this.plugin.app?.vault?.adapter;
    if (!adapter || lessonPaths.length === 0) return summary;

    for (const path of lessonPaths) {
      try {
        const content = await adapter.read(path);
        const progress = parseNoteProgress(content);
        if (progress.read) summary.readNotes += 1;
        if (progress.flashcardsCreated) summary.flashcardsCreatedNotes += 1;
        if (progress.reviewed) summary.reviewedNotes += 1;
      } catch {
        // Missing or unreadable lesson notes count toward the total, but not toward progress.
      }
    }

    return summary;
  }

  private async listMarkdownFiles(folder: string): Promise<string[]> {
    const adapter = this.plugin.app.vault.adapter;
    const listing = await adapter.list(folder);
    const nested = await Promise.all(listing.folders.map(child => this.listMarkdownFiles(child)));
    return [
      ...listing.files.filter(path => path.endsWith('.md')),
      ...nested.flat(),
    ];
  }

  private async readGeneratedCourseTitle(courseIndexPath: string, folder: string): Promise<string> {
    try {
      const content = await this.plugin.app.vault.adapter.read(courseIndexPath);
      const heading = content.split('\n')
        .map(line => line.match(/^#\s+(.+)$/)?.[1]?.trim())
        .find(Boolean);
      if (heading) return heading;
    } catch {
      // Fall back to the folder name below.
    }
    return this.readableCourseId(folder.split('/').pop() ?? folder);
  }

  private async deriveGeneratedCourseUpdatedAt(paths: string[]): Promise<string> {
    const stats = await Promise.all(paths.map(path => this.adapterMtime(path)));
    const latest = Math.max(0, ...stats.filter((mtime): mtime is number => typeof mtime === 'number'));
    return latest > 0 ? new Date(latest).toISOString() : new Date(0).toISOString();
  }

  private async adapterExists(path: string): Promise<boolean> {
    try {
      return await this.plugin.app.vault.adapter.exists(path);
    } catch {
      return false;
    }
  }

  private async adapterMtime(path: string): Promise<number | undefined> {
    const adapter = this.plugin.app.vault.adapter;
    if (!('stat' in adapter)) return undefined;
    try {
      return (await adapter.stat(path))?.mtime;
    } catch {
      return undefined;
    }
  }

  private deriveCurrentStage(course?: StageCache): StageId {
    for (const stage of [4, 3, 2, 1, 0] as StageId[]) {
      if (course?.[stage]) return stage;
    }
    return 0;
  }

  private describeStage(stage: StageId): string {
    if (stage === 0) return 'Taxonomy';
    if (stage === 1) return 'Concepts';
    if (stage === 2) return 'Diagnostic';
    if (stage === 3) return 'Curriculum';
    return 'Lessons';
  }

  private deriveStageStatus(course: StageCache | undefined, stage: StageId): 'pending' | 'complete' {
    if (stage === 2) return course?.[2]?.completedAt ? 'complete' : 'pending';
    return course?.[stage]?.status === 'complete' ? 'complete' : 'pending';
  }

  private deriveCreatedAt(course?: StageCache): string | undefined {
    return course?.[0]?.startedAt
      || course?.[0]?.completedAt
      || course?.[3]?.startedAt
      || course?.[3]?.completedAt
      || course?.[4]?.startedAt
      || course?.[4]?.completedAt;
  }

  private deriveUpdatedAt(course?: StageCache, meta?: CourseMeta): string | undefined {
    return course?.[4]?.completedAt
      || course?.[4]?.startedAt
      || course?.[3]?.completedAt
      || course?.[3]?.startedAt
      || course?.[2]?.completedAt
      || course?.[1]?.completedAt
      || course?.[1]?.startedAt
      || course?.[0]?.completedAt
      || course?.[0]?.startedAt
      || meta?.createdAt;
  }

  private readableCourseId(courseId: string): string {
    return courseId
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }
}

function isGeneratedCourseSupportFile(path: string): boolean {
  const name = path.split('/').pop();
  return name === 'Course Index.md' || name === 'Module MOC.md';
}

function findMatchingSummaryKey(
  summaries: Map<string, CourseSummary>,
  generated: CourseSummary
): string | undefined {
  if (summaries.has(generated.courseId)) return generated.courseId;

  for (const [key, summary] of summaries) {
    if (summary.outputRootPath && summary.outputRootPath === generated.outputRootPath) return key;
    if (summary.courseIndexPath && summary.courseIndexPath === generated.courseIndexPath) return key;
  }

  return undefined;
}

function mergeGeneratedSummary(
  cached: CourseSummary | undefined,
  generated: CourseSummary
): CourseSummary {
  if (!cached) return generated;

  return {
    ...cached,
    updatedAt: maxIsoDate(cached.updatedAt, generated.updatedAt),
    totalLessons: Math.max(cached.totalLessons, generated.totalLessons),
    completedLessons: Math.max(cached.completedLessons, generated.completedLessons),
    outputRootPath: cached.outputRootPath ?? generated.outputRootPath,
    courseIndexPath: cached.courseIndexPath ?? generated.courseIndexPath,
    noteProgress: generated.noteProgress.totalNotes > 0
      ? generated.noteProgress
      : cached.noteProgress,
  };
}

function maxIsoDate(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b;
}

function parseNoteProgress(content: string): {
  read: boolean;
  flashcardsCreated: boolean;
  reviewed: boolean;
} {
  return {
    read: isChecked(content, 'Read'),
    flashcardsCreated: isChecked(content, 'Flashcards created'),
    reviewed: isChecked(content, 'Reviewed'),
  };
}

function isChecked(content: string, label: string): boolean {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*-\\s*\\[[xX]\\]\\s*${escapedLabel}\\s*$`, 'm').test(content);
}
