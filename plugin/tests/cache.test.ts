import { describe, expect, it, vi } from 'vitest';
import { CacheService } from '../src/services/cache';
import type { PluginData } from '../src/interfaces';

describe('cache: listCourses', () => {
  it('returns multiple saved curricula even when metadata is missing', async () => {
    const data: PluginData = {
      courses: {
        'course-a': {
          0: {
            courseId: 'course-a',
            seedTopic: 'Category theory',
            taxonomy: [],
            selectedScope: [],
            scopeSummary: 'Category theory',
            startedAt: '2026-04-22T10:00:00.000Z',
          },
          3: {
            courseId: 'course-a',
            curriculum: {
              courseId: 'course-a',
              title: 'Category Theory Foundations',
              modules: [],
            },
            completedAt: '2026-04-22T10:30:00.000Z',
          },
        },
        'course-b': {
          0: {
            courseId: 'course-b',
            seedTopic: 'Linear algebra',
            taxonomy: [],
            selectedScope: [],
            scopeSummary: 'Linear algebra',
            startedAt: '2026-04-23T09:00:00.000Z',
          },
          3: {
            courseId: 'course-b',
            curriculum: {
              courseId: 'course-b',
              title: 'Linear Algebra for ML',
              modules: [],
            },
            completedAt: '2026-04-23T09:30:00.000Z',
          },
        },
      },
      meta: {},
    };

    const plugin = {
      loadData: vi.fn(async () => data),
      saveData: vi.fn(async () => {}),
    };

    const cache = new CacheService(plugin as never);
    const courses = await cache.listCourses();

    expect(courses).toEqual([
      {
        courseId: 'course-b',
        title: 'Linear Algebra for ML',
        createdAt: '2026-04-23T09:00:00.000Z',
      },
      {
        courseId: 'course-a',
        title: 'Category Theory Foundations',
        createdAt: '2026-04-22T10:00:00.000Z',
      },
    ]);
  });
});

describe('cache: listCourseSummaries', () => {
  it('derives stage and lesson progress for dashboard tiles', async () => {
    const data: PluginData = {
      courses: {
        'stage-zero': {
          0: {
            courseId: 'stage-zero',
            seedTopic: 'Rhetoric',
            taxonomy: [],
            selectedScope: [],
            scopeSummary: 'Rhetoric',
            status: 'pending',
            startedAt: '2026-04-20T10:00:00.000Z',
          },
        },
        'partial-lessons': {
          0: {
            courseId: 'partial-lessons',
            seedTopic: 'Music theory',
            taxonomy: [],
            selectedScope: [],
            scopeSummary: 'Music theory',
            status: 'complete',
            startedAt: '2026-04-21T10:00:00.000Z',
          },
          3: {
            courseId: 'partial-lessons',
            curriculum: {
              courseId: 'partial-lessons',
              title: 'Music Theory',
              modules: [
                {
                  moduleId: 'm1',
                  title: 'Foundations',
                  description: 'Basics',
                  lessons: [
                    { lessonId: 'l1', title: 'Pitch', description: 'Pitch', prerequisites: [] },
                    { lessonId: 'l2', title: 'Rhythm', description: 'Rhythm', prerequisites: [] },
                  ],
                },
              ],
            },
            status: 'complete',
            completedAt: '2026-04-21T10:30:00.000Z',
          },
          4: {
            courseId: 'partial-lessons',
            progress: {
              totalLessons: 2,
              completedLessons: 1,
            },
            outputs: {
              rootDir: '4-Curriculum/Music Theory',
              courseIndexPath: '4-Curriculum/Music Theory/Course Index.md',
              canvasPath: '4-Curriculum/Music Theory/Course.canvas',
              modulePaths: {},
              lessonPaths: {},
            },
            completedLessonIds: ['l1'],
            status: 'pending',
            startedAt: '2026-04-21T11:00:00.000Z',
          },
        },
      },
      meta: {},
    };

    const plugin = {
      loadData: vi.fn(async () => data),
      saveData: vi.fn(async () => {}),
    };

    const cache = new CacheService(plugin as never);
    const summaries = await cache.listCourseSummaries();

    expect(summaries).toMatchObject([
      {
        courseId: 'partial-lessons',
        title: 'Music Theory',
        currentStage: 4,
        stageLabel: 'Lessons',
        stageStatus: 'pending',
        totalLessons: 2,
        completedLessons: 1,
        remainingLessonIds: ['l2'],
        outputRootPath: '4-Curriculum/Music Theory',
        courseIndexPath: '4-Curriculum/Music Theory/Course Index.md',
        hasStage3Cache: true,
      },
      {
        courseId: 'stage-zero',
        title: 'Rhetoric',
        currentStage: 0,
        stageLabel: 'Taxonomy',
        totalLessons: 0,
        completedLessons: 0,
        hasStage3Cache: false,
      },
    ]);
  });

  it('discovers generated courses from the curriculum folder when cache data is absent', async () => {
    const data: PluginData = {
      courses: {},
      meta: {},
    };
    const files = new Map<string, string>([
      [
        '4-Curriculum/generated-course/Course Index.md',
        '# Generated Course\n\n## Modules\n\n- [[Module MOC]]\n  - [[lesson-one]]\n',
      ],
      ['4-Curriculum/generated-course/module-a/Module MOC.md', '# Module A'],
      ['4-Curriculum/generated-course/module-a/lesson-one.md', '# Lesson One'],
      ['4-Curriculum/generated-course/module-a/lesson-two.md', '# Lesson Two'],
    ]);
    const folders = new Map<string, string[]>([
      ['4-Curriculum', ['4-Curriculum/generated-course']],
      ['4-Curriculum/generated-course', ['4-Curriculum/generated-course/module-a']],
      ['4-Curriculum/generated-course/module-a', []],
    ]);

    const plugin = {
      loadData: vi.fn(async () => data),
      saveData: vi.fn(async () => {}),
      app: {
        vault: {
          adapter: {
            exists: vi.fn(async (path: string) => files.has(path)),
            read: vi.fn(async (path: string) => files.get(path) ?? ''),
            stat: vi.fn(async (path: string) => ({ mtime: path.includes('lesson-two') ? 2000 : 1000 })),
            list: vi.fn(async (path: string) => ({
              files: [...files.keys()].filter(file => file.startsWith(`${path}/`) && !file.slice(path.length + 1).includes('/')),
              folders: folders.get(path) ?? [],
            })),
          },
        },
      },
    };

    const cache = new CacheService(plugin as never);
    const summaries = await cache.listCourseSummaries();

    expect(summaries).toEqual([
      {
        courseId: 'generated-course',
        title: 'Generated Course',
        createdAt: '1970-01-01T00:00:02.000Z',
        updatedAt: '1970-01-01T00:00:02.000Z',
        currentStage: 4,
        stageLabel: 'Lessons',
        stageStatus: 'complete',
        totalLessons: 2,
        completedLessons: 2,
        remainingLessonIds: [],
        outputRootPath: '4-Curriculum/generated-course',
        courseIndexPath: '4-Curriculum/generated-course/Course Index.md',
        hasStage3Cache: false,
      },
    ]);
  });
});
