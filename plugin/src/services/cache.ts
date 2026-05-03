import type DelvePlugin from '../../main';
import type {
  CourseId,
  CourseMeta,
  CourseSummary,
  PluginData,
  StageId,
  StageCache,
  Stage0Cache,
  Stage1Cache,
  Stage2Cache,
  Stage3Cache,
  Stage4Cache,
} from '../interfaces';

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

    return [...courseIds]
      .map(courseId => this.deriveCourseSummary(courseId, data.courses[courseId], data.meta[courseId]))
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

  private deriveCourseSummary(
    courseId: CourseId,
    course?: StageCache,
    meta?: CourseMeta
  ): CourseSummary {
    const currentStage = this.deriveCurrentStage(course);
    const allLessonIds = course?.[3]?.curriculum?.modules
      .flatMap(module => module.lessons.map(lesson => lesson.lessonId)) ?? [];
    const completedLessonIds = new Set(course?.[4]?.completedLessonIds ?? []);
    const completedLessons = Math.min(
      completedLessonIds.size || course?.[4]?.progress.completedLessons || 0,
      allLessonIds.length
    );

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
    };
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
