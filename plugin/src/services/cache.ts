import type {
  AllPluginData,
  CourseId,
  Stage0Cache,
  Stage1Cache,
  Stage2Cache,
  Stage3Cache,
  Stage4Cache,
  StageCache,
} from '../interfaces';

type StageDataMap = {
  0: Stage0Cache;
  1: Stage1Cache;
  2: Stage2Cache;
  3: Stage3Cache;
  4: Stage4Cache;
};

export class CacheService {
  constructor(
    private loadAll: () => Promise<AllPluginData>,
    private saveAll: (data: AllPluginData) => Promise<void>,
  ) {}

  async readCourse(courseId: CourseId): Promise<StageCache | null> {
    const data = await this.loadAll();
    return data.courses[courseId] ?? null;
  }

  async readStage<S extends keyof StageDataMap>(
    courseId: CourseId,
    stage: S,
  ): Promise<StageDataMap[S] | null> {
    const data = await this.loadAll();
    return (data.courses[courseId]?.[stage] as StageDataMap[S]) ?? null;
  }

  async writeStage<S extends keyof StageDataMap>(
    courseId: CourseId,
    stage: S,
    value: StageDataMap[S],
  ): Promise<void> {
    const data = await this.loadAll();
    if (!data.courses[courseId]) data.courses[courseId] = {};
    (data.courses[courseId] as StageCache)[stage] = value as StageCache[S];
    await this.saveAll(data);
  }

  async getActiveCourseId(): Promise<CourseId | null> {
    const data = await this.loadAll();
    return data.activeCourseId ?? null;
  }

  async setActiveCourseId(courseId: CourseId): Promise<void> {
    const data = await this.loadAll();
    data.activeCourseId = courseId;
    await this.saveAll(data);
  }

  async deleteCourse(courseId: CourseId): Promise<void> {
    const data = await this.loadAll();
    delete data.courses[courseId];
    if (data.activeCourseId === courseId) delete data.activeCourseId;
    await this.saveAll(data);
  }
}
