import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runStage4 } from '../src/stages/stage4-generate';
import { makeMockPlugin, makeStage0Cache } from './helpers';

describe('stage4: runStage4', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;

  beforeEach(() => {
    plugin = makeMockPlugin();
  });

  it('writes course outputs and completes cache progress', async () => {
    const writeStage = vi.fn();
    const write = vi.fn();
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
      return undefined;
    }) as never;
    plugin.cacheService.writeStage = writeStage;
    plugin.app.vault.adapter.write = write;
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
      });

    await runStage4(plugin as never, 'course-1');

    expect(writeStage).toHaveBeenCalled();
    expect(writeStage.mock.calls[0]?.[2]).toMatchObject({
      courseId: 'course-1',
      status: 'pending',
      progress: {
        totalLessons: 2,
        completedLessons: 0,
      },
    });
    expect(writeStage.mock.calls.at(-1)?.[2]).toMatchObject({
      courseId: 'course-1',
      status: 'complete',
      progress: {
        totalLessons: 2,
        completedLessons: 2,
      },
    });

    expect(write).toHaveBeenCalledTimes(5);
    expect(write.mock.calls.map(call => call[0])).toEqual(
      expect.arrayContaining([
        '4-Curriculum/category-theory-foundations/Course Index.md',
        '4-Curriculum/category-theory-foundations/01-foundations/Module MOC.md',
        '4-Curriculum/category-theory-foundations/01-foundations/01-functors.md',
        '4-Curriculum/category-theory-foundations/01-foundations/02-limits.md',
        '4-Curriculum/category-theory-foundations/Category Theory Foundations.canvas',
      ])
    );
    expect(write.mock.calls.find(call => String(call[0]).endsWith('01-functors.md'))?.[1]).toContain(
      'Previous: none | Next: [[02-limits]]'
    );
    expect(write.mock.calls.find(call => String(call[0]).endsWith('02-limits.md'))?.[1]).toContain(
      'difficulty: intermediate'
    );
    expect(mkdir).toHaveBeenCalled();
  });

  it('normalizes common difficulty labels from the model', async () => {
    const write = vi.fn();

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
    plugin.app.vault.adapter.write = write;
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

    expect(write.mock.calls.find(call => String(call[0]).endsWith('01-functors.md'))?.[1]).toContain(
      'difficulty: intro'
    );
  });
});
