// ─── Core IDs ────────────────────────────────────────────────────────────────

export type CourseId = string;
export type StageId = 0 | 1 | 2 | 3 | 4;

// ─── Stage 0: Taxonomy ───────────────────────────────────────────────────────

export interface TaxonomyNode {
  id: string;
  title: string;
  description: string;
  children?: TaxonomyNode[];
}

export interface TaxonomyResponse {
  taxonomy: TaxonomyNode[];
}

export interface Stage0Cache {
  courseId: CourseId;
  seedTopic: string;
  taxonomy: TaxonomyNode[];
  /** IDs of nodes the user selected as course scope */
  selectedScope: string[];
  /** Human-readable summary of the selected scope */
  scopeSummary: string;
  /** ISO timestamp; empty string means scope not yet confirmed */
  completedAt: string;
}

// ─── Stage 1: Concept Extraction ─────────────────────────────────────────────

export interface Concept {
  id: string;
  title: string;
  description: string;
  /** File paths within 2-Markdown_Sources that were the primary source */
  sourceRefs?: string[];
}

export interface Stage1Cache {
  courseId: CourseId;
  concepts: Concept[];
  completedAt: string;
}

// ─── Stage 2: Diagnostic ─────────────────────────────────────────────────────

export type LikertScore = 1 | 2 | 3 | 4 | 5;

export interface Stage2Cache {
  courseId: CourseId;
  /** Maps concept ID → self-assessed proficiency (1 = new, 5 = expert) */
  proficiencyMap: Record<string, LikertScore>;
  completedAt: string;
}

// ─── Stage 3: Curriculum Design ──────────────────────────────────────────────

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
  completedAt: string;
}

// ─── Stage 4: Content Generation ─────────────────────────────────────────────

export interface GenerationProgress {
  totalLessons: number;
  completedLessons: number;
  currentLesson?: string;
}

export interface Stage4Cache {
  courseId: CourseId;
  progress: GenerationProgress;
  /** Undefined while generation is in progress */
  completedAt?: string;
}

// ─── Aggregate Types ─────────────────────────────────────────────────────────

export interface StageCache {
  0?: Stage0Cache;
  1?: Stage1Cache;
  2?: Stage2Cache;
  3?: Stage3Cache;
  4?: Stage4Cache;
}

export interface AllPluginData {
  /** Serialised DelveSettings (partial, merged with defaults on load) */
  settings: Record<string, unknown>;
  courses: Record<CourseId, StageCache>;
  activeCourseId?: CourseId;
}
