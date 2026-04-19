export type CourseId = string;
export type StageId = 0 | 1 | 2 | 3 | 4;

export interface TaxonomyNode {
  id: string;
  title: string;
  description: string;
  children?: TaxonomyNode[];
}

export interface Stage0Cache {
  courseId: CourseId;
  seedTopic: string;
  taxonomy: TaxonomyNode[];
  selectedScope: string[];
  scopeSummary: string;
  status?: 'pending' | 'complete';
  startedAt?: string;
  completedAt?: string;
}

export interface Concept {
  id: string;
  title: string;
  description: string;
  sourceRefs?: string[];
}

export interface Stage1Cache {
  courseId: CourseId;
  concepts: Concept[];
  status?: 'pending' | 'complete';
  startedAt?: string;
  completedAt?: string;
}

export type LikertScore = 1 | 2 | 3 | 4 | 5;

export interface Stage2Cache {
  courseId: CourseId;
  proficiencyMap: Record<string, LikertScore>;
  completedAt: string;
}

export interface LessonSpec {
  lessonId: string;
  title: string;
  description: string;
  prerequisites: string[];
}

export interface ModuleSpec {
  moduleId: string;
  title: string;
  description: string;
  lessons: LessonSpec[];
}

export interface Curriculum {
  courseId: CourseId;
  title: string;
  modules: ModuleSpec[];
}

export interface Stage3Cache {
  courseId: CourseId;
  curriculum: Curriculum;
  status?: 'pending' | 'complete';
  startedAt?: string;
  completedAt?: string;
}

export interface GenerationProgress {
  totalLessons: number;
  completedLessons: number;
  currentLesson?: string;
}

export interface Stage4Cache {
  courseId: CourseId;
  progress: GenerationProgress;
  completedAt?: string;
}

export interface StageCache {
  0?: Stage0Cache;
  1?: Stage1Cache;
  2?: Stage2Cache;
  3?: Stage3Cache;
  4?: Stage4Cache;
}

export interface LockData {
  courseId: CourseId;
  stage: StageId;
  timestamp: string;
}

export interface CourseMeta {
  courseId: CourseId;
  title: string;
  createdAt: string;
}

export interface PluginData {
  settings?: Record<string, unknown>;
  courses: Record<CourseId, StageCache>;
  meta: Record<CourseId, CourseMeta>;
}
