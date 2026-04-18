export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const STAGES = [0, 1, 2, 3, 4] as const;

export const VAULT_PATHS = {
  RAW_SOURCES: '1-Raw_Sources',
  MARKDOWN_SOURCES: '2-Markdown_Sources',
  SYNTHESIZED: '3-Synthesized',
  CURRICULUM: '4-Curriculum',
} as const;

export const LOCK_FILE = '.delve.lock';

export const TAXONOMY_VIEW_TYPE = 'delve-taxonomy-view';
export const PROGRESS_VIEW_TYPE = 'delve-progress-view';
export const SYLLABUS_VIEW_TYPE = 'delve-syllabus-editor-view';
