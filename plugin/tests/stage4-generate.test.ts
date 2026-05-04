import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stage4Cache } from '../src/interfaces';
import { runStage4 } from '../src/stages/stage4-generate';
import { makeMockPlugin, makeStage0Cache } from './helpers';

describe('stage4: runStage4', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;

  beforeEach(() => {
    plugin = makeMockPlugin();
  });

  it('generates all remaining lessons by default', async () => {
    const stageWrites: Stage4Cache[] = [];
    const fileWrites: Array<{ path: string; content: string }> = [];
    const mkdir = vi.fn();

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          scopeSummary: 'Functors and limits',
        });
      }
      if (stage === 3) {
        return {
          courseId: 'course-1',
          status: 'complete',
          curriculum: {
            courseId: 'course-1',
            title: 'Category Theory Foundations',
            modules: [
              {
                moduleId: 'module-foundations',
                title: 'Foundations',
                description: 'Core ideas.',
                lessons: [
                  {
                    lessonId: 'functors',
                    title: 'Functors',
                    description: 'Learn how structure-preserving maps work.',
                    prerequisites: [],
                  },
                  {
                    lessonId: 'limits',
                    title: 'Limits',
                    description: 'Understand categorical limits.',
                    prerequisites: ['functors'],
                  },
                ],
              },
            ],
          },
        };
      }
      if (stage === 4) {
        return stageWrites.at(-1);
      }
      return undefined;
    }) as never;
    plugin.cacheService.writeStage = vi.fn(async (_courseId: string, stage: number, cache: Stage4Cache) => {
      if (stage === 4) stageWrites.push(cache);
    }) as never;
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      fileWrites.push({ path, content });
    });
    plugin.app.vault.adapter.mkdir = mkdir;
    plugin.app.vault.adapter.exists = vi.fn(async () => false);
    plugin.llmService.callJson = vi
      .fn()
      .mockResolvedValueOnce({
        lesson: {
          title: 'Functors',
          summary: 'A lesson on functors.',
          difficulty: 'intro',
          bodyMarkdown: '## Overview\n\nFunctors map objects and morphisms.',
          sourceRefs: [],
        },
      })
      .mockResolvedValueOnce({
        lesson: {
          title: 'Limits',
          summary: 'A lesson on limits.',
          difficulty: 'intermediate',
          bodyMarkdown: '## Overview\n\nLimits capture universal cones.',
          sourceRefs: [],
        },
      }) as never;

    await runStage4(plugin as never, 'course-1');

    expect(plugin.llmService.callJson).toHaveBeenCalledTimes(2);
    expect(fileWrites.map(call => call.path)).toEqual(
      expect.arrayContaining([
        '4-Curriculum/category-theory-foundations/Course Index.md',
        '4-Curriculum/category-theory-foundations/01-foundations/Module MOC.md',
        '4-Curriculum/category-theory-foundations/01-foundations/01-functors.md',
        '4-Curriculum/category-theory-foundations/Category Theory Foundations.canvas',
      ])
    );
    expect(fileWrites.map(call => call.path)).toContain(
      '4-Curriculum/category-theory-foundations/01-foundations/02-limits.md'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      'Previous: none | Next: [[02-limits]]'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      '[!note]- Generation Prompt'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      '## Progress\n\n- [ ] Read\n- [ ] Flashcards created\n- [ ] Reviewed'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      'Model: `anthropic/claude-3-5-sonnet`'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      'Repair pass used: no'
    );
    expect(stageWrites.at(-1)).toMatchObject({
      courseId: 'course-1',
      status: 'complete',
      completedLessonIds: ['functors', 'limits'],
      progress: {
        totalLessons: 2,
        completedLessons: 2,
      },
    });
    expect(mkdir).toHaveBeenCalled();
  });

  it('generates only the next remaining lesson when requested', async () => {
    const stageWrites: Stage4Cache[] = [];
    const fileWrites: Array<{ path: string; content: string }> = [];

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          scopeSummary: 'Functors and limits',
        });
      }
      if (stage === 3) {
        return {
          courseId: 'course-1',
          status: 'complete',
          curriculum: {
            courseId: 'course-1',
            title: 'Category Theory Foundations',
            modules: [
              {
                moduleId: 'module-foundations',
                title: 'Foundations',
                description: 'Core ideas.',
                lessons: [
                  {
                    lessonId: 'functors',
                    title: 'Functors',
                    description: 'Learn how structure-preserving maps work.',
                    prerequisites: [],
                  },
                  {
                    lessonId: 'limits',
                    title: 'Limits',
                    description: 'Understand categorical limits.',
                    prerequisites: ['functors'],
                  },
                ],
              },
            ],
          },
        };
      }
      if (stage === 4) {
        return stageWrites.at(-1);
      }
      return undefined;
    }) as never;
    plugin.cacheService.writeStage = vi.fn(async (_courseId: string, stage: number, cache: Stage4Cache) => {
      if (stage === 4) stageWrites.push(cache);
    }) as never;
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      fileWrites.push({ path, content });
    });
    plugin.app.vault.adapter.mkdir = vi.fn();
    plugin.app.vault.adapter.exists = vi.fn(async () => false);
    plugin.llmService.callJson = vi.fn(async () => ({
      lesson: {
        title: 'Functors',
        summary: 'A lesson on functors.',
        difficulty: 'intro',
        bodyMarkdown: '## Overview\n\nFunctors map objects and morphisms.',
        sourceRefs: [],
      },
    })) as never;

    await runStage4(plugin as never, 'course-1', { mode: 'next' });

    expect(plugin.llmService.callJson).toHaveBeenCalledTimes(1);
    expect(fileWrites.map(call => call.path)).toContain(
      '4-Curriculum/category-theory-foundations/01-foundations/01-functors.md'
    );
    expect(fileWrites.map(call => call.path)).not.toContain(
      '4-Curriculum/category-theory-foundations/01-foundations/02-limits.md'
    );
    expect(stageWrites.at(-1)).toMatchObject({
      courseId: 'course-1',
      status: 'pending',
      completedLessonIds: ['functors'],
      progress: {
        totalLessons: 2,
        completedLessons: 1,
      },
    });
  });

  it('resumes from cache and completes the remaining lesson', async () => {
    const stageWrites: Stage4Cache[] = [
      {
        courseId: 'course-1',
        progress: {
          totalLessons: 2,
          completedLessons: 1,
        },
        outputs: {
          rootDir: '4-Curriculum/category-theory-foundations',
          courseIndexPath: '4-Curriculum/category-theory-foundations/Course Index.md',
          canvasPath: '4-Curriculum/category-theory-foundations/Category Theory Foundations.canvas',
          modulePaths: {
            'module-foundations': '4-Curriculum/category-theory-foundations/01-foundations/Module MOC.md',
          },
          lessonPaths: {
            functors: '4-Curriculum/category-theory-foundations/01-foundations/01-functors.md',
            limits: '4-Curriculum/category-theory-foundations/01-foundations/02-limits.md',
          },
        },
        completedLessonIds: ['functors'],
        generatedLessonSummaries: {
          functors: {
            title: 'Functors',
            summary: 'A lesson on functors.',
          },
        },
        status: 'pending',
        startedAt: '2026-04-20T00:00:00.000Z',
      },
    ];
    const fileWrites: Array<{ path: string; content: string }> = [];

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          scopeSummary: 'Functors and limits',
        });
      }
      if (stage === 3) {
        return {
          courseId: 'course-1',
          status: 'complete',
          curriculum: {
            courseId: 'course-1',
            title: 'Category Theory Foundations',
            modules: [
              {
                moduleId: 'module-foundations',
                title: 'Foundations',
                description: 'Core ideas.',
                lessons: [
                  {
                    lessonId: 'functors',
                    title: 'Functors',
                    description: 'Learn how structure-preserving maps work.',
                    prerequisites: [],
                  },
                  {
                    lessonId: 'limits',
                    title: 'Limits',
                    description: 'Understand categorical limits.',
                    prerequisites: ['functors'],
                  },
                ],
              },
            ],
          },
        };
      }
      if (stage === 4) {
        return stageWrites.at(-1);
      }
      return undefined;
    }) as never;
    plugin.cacheService.writeStage = vi.fn(async (_courseId: string, stage: number, cache: Stage4Cache) => {
      if (stage === 4) stageWrites.push(cache);
    }) as never;
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      fileWrites.push({ path, content });
    });
    plugin.app.vault.adapter.mkdir = vi.fn();
    plugin.app.vault.adapter.exists = vi.fn(async () => false);
    plugin.llmService.callJson = vi.fn(async () => ({
      lesson: {
        title: 'Limits',
        summary: 'A lesson on limits.',
        difficulty: 'intermediate',
        bodyMarkdown: '## Overview\n\nLimits capture universal cones.',
        sourceRefs: [],
      },
    })) as never;

    await runStage4(plugin as never, 'course-1');

    expect(plugin.llmService.callJson).toHaveBeenCalledTimes(1);
    expect(plugin.llmService.callJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        lessonTitle: 'Limits',
        prerequisiteSummary: 'Functors: A lesson on functors.',
      }),
      'anthropic/claude-3-5-sonnet'
    );
    expect(fileWrites.find(call => call.path.endsWith('02-limits.md'))?.content).toContain(
      'difficulty: intermediate'
    );
    expect(stageWrites.at(-1)).toMatchObject({
      courseId: 'course-1',
      status: 'complete',
      completedLessonIds: ['functors', 'limits'],
      progress: {
        totalLessons: 2,
        completedLessons: 2,
      },
    });
  });

  it('generates only the selected lessons in curriculum order', async () => {
    const stageWrites: Stage4Cache[] = [];
    const fileWrites: Array<{ path: string; content: string }> = [];

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          scopeSummary: 'Functors, natural transformations, and limits',
        });
      }
      if (stage === 3) {
        return {
          courseId: 'course-1',
          status: 'complete',
          curriculum: {
            courseId: 'course-1',
            title: 'Category Theory Foundations',
            modules: [
              {
                moduleId: 'module-foundations',
                title: 'Foundations',
                description: 'Core ideas.',
                lessons: [
                  {
                    lessonId: 'functors',
                    title: 'Functors',
                    description: 'Learn how structure-preserving maps work.',
                    prerequisites: [],
                  },
                  {
                    lessonId: 'natural-transformations',
                    title: 'Natural transformations',
                    description: 'Understand morphisms between functors.',
                    prerequisites: ['functors'],
                  },
                  {
                    lessonId: 'limits',
                    title: 'Limits',
                    description: 'Understand categorical limits.',
                    prerequisites: ['functors'],
                  },
                ],
              },
            ],
          },
        };
      }
      if (stage === 4) {
        return stageWrites.at(-1);
      }
      return undefined;
    }) as never;
    plugin.cacheService.writeStage = vi.fn(async (_courseId: string, stage: number, cache: Stage4Cache) => {
      if (stage === 4) stageWrites.push(cache);
    }) as never;
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      fileWrites.push({ path, content });
    });
    plugin.app.vault.adapter.mkdir = vi.fn();
    plugin.app.vault.adapter.exists = vi.fn(async () => false);
    plugin.llmService.callJson = vi
      .fn()
      .mockResolvedValueOnce({
        lesson: {
          title: 'Functors',
          summary: 'A lesson on functors.',
          difficulty: 'intro',
          bodyMarkdown: '## Overview\n\nFunctors map objects and morphisms.',
          sourceRefs: [],
        },
      })
      .mockResolvedValueOnce({
        lesson: {
          title: 'Limits',
          summary: 'A lesson on limits.',
          difficulty: 'intermediate',
          bodyMarkdown: '## Overview\n\nLimits capture universal cones.',
          sourceRefs: [],
        },
      }) as never;

    await runStage4(plugin as never, 'course-1', {
      mode: 'selected',
      lessonIds: ['limits', 'functors'],
    });

    expect(plugin.llmService.callJson).toHaveBeenCalledTimes(2);
    expect(plugin.llmService.callJson).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ lessonTitle: 'Functors' }),
      'anthropic/claude-3-5-sonnet'
    );
    expect(plugin.llmService.callJson).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ lessonTitle: 'Limits' }),
      'anthropic/claude-3-5-sonnet'
    );
    expect(fileWrites.map(call => call.path)).toContain(
      '4-Curriculum/category-theory-foundations/01-foundations/01-functors.md'
    );
    expect(fileWrites.map(call => call.path)).toContain(
      '4-Curriculum/category-theory-foundations/01-foundations/03-limits.md'
    );
    expect(fileWrites.map(call => call.path)).not.toContain(
      '4-Curriculum/category-theory-foundations/01-foundations/02-natural-transformations.md'
    );
    expect(stageWrites.at(-1)).toMatchObject({
      courseId: 'course-1',
      status: 'pending',
      completedLessonIds: ['functors', 'limits'],
      progress: {
        totalLessons: 3,
        completedLessons: 2,
      },
    });
  });

  it('normalizes common difficulty labels from the model', async () => {
    const fileWrites: Array<{ path: string; content: string }> = [];

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          scopeSummary: 'Functors',
        });
      }
      if (stage === 3) {
        return {
          courseId: 'course-1',
          status: 'complete',
          curriculum: {
            courseId: 'course-1',
            title: 'Category Theory Foundations',
            modules: [
              {
                moduleId: 'module-foundations',
                title: 'Foundations',
                description: 'Core ideas.',
                lessons: [
                  {
                    lessonId: 'functors',
                    title: 'Functors',
                    description: 'Learn how structure-preserving maps work.',
                    prerequisites: [],
                  },
                ],
              },
            ],
          },
        };
      }
      return undefined;
    }) as never;
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      fileWrites.push({ path, content });
    });
    plugin.app.vault.adapter.mkdir = vi.fn();
    plugin.app.vault.adapter.exists = vi.fn(async () => false);
    plugin.llmService.callJson = vi.fn(async () => ({
      lesson: {
        title: 'Functors',
        summary: 'A lesson on functors.',
        difficulty: 'Beginner',
        bodyMarkdown: '## Overview\n\nFunctors map objects and morphisms.',
        sourceRefs: [],
      },
    })) as never;

    await runStage4(plugin as never, 'course-1');

    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      'difficulty: intro'
    );
  });

  it('repairs off-topic JSON-schema lessons back to the requested lesson topic', async () => {
    const fileWrites: Array<{ path: string; content: string }> = [];

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          scopeSummary: 'Functors',
        });
      }
      if (stage === 3) {
        return {
          courseId: 'course-1',
          status: 'complete',
          curriculum: {
            courseId: 'course-1',
            title: 'Category Theory Foundations',
            modules: [
              {
                moduleId: 'module-foundations',
                title: 'Foundations',
                description: 'Core ideas.',
                lessons: [
                  {
                    lessonId: 'functors',
                    title: 'Functors',
                    description: 'Learn how structure-preserving maps work.',
                    prerequisites: [],
                  },
                ],
              },
            ],
          },
        };
      }
      return undefined;
    }) as never;
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      fileWrites.push({ path, content });
    });
    plugin.app.vault.adapter.mkdir = vi.fn();
    plugin.app.vault.adapter.exists = vi.fn(async () => false);
    plugin.llmService.callJson = vi
      .fn()
      .mockResolvedValueOnce({
        lesson: {
          title: 'Understanding JSON Schema Validation',
          summary: 'A guide to JSON validation.',
          difficulty: 'intro',
          bodyMarkdown: '## JSON Schema Debugging\n\nExpected object, received array.',
          sourceRefs: ['https://json-schema.org/understanding-json-schema/'],
        },
      })
      .mockResolvedValueOnce({
        lesson: {
          title: 'Functors',
          summary: 'A lesson on functors.',
          difficulty: 'intro',
          bodyMarkdown: '## Overview\n\nFunctors map objects and morphisms while preserving composition.',
          sourceRefs: [],
        },
      }) as never;

    await runStage4(plugin as never, 'course-1');

    expect(plugin.llmService.callJson).toHaveBeenCalledTimes(2);
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      '# Functors'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).not.toContain(
      'Understanding JSON Schema Validation'
    );
    expect(fileWrites.find(call => call.path.endsWith('01-functors.md'))?.content).toContain(
      'Repair pass used: yes'
    );
  });
});
