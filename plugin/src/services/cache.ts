import type DelvePlugin from '../../main';
import type {
  CourseId,
  CourseMeta,
  PluginData,
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
    return raw ?? { courses: {}, meta: {} };
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
    return Object.values(data.meta);
  }

  async clearCourse(courseId: CourseId): Promise<void> {
    const data = await this.readAll();
    delete data.courses[courseId];
    delete data.meta[courseId];
    await this.plugin.saveData(data);
  }
}
