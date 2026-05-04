import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runStage3 } from '../src/stages/stage3-curriculum';
import { makeMockPlugin, makeStage0Cache } from './helpers';

describe('stage3: runStage3', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;

  beforeEach(() => {
    plugin = makeMockPlugin();
  });

  it('writes a pending cache, generates a curriculum, and opens the syllabus view', async () => {
    const writeStage = vi.fn();
    const setViewState = vi.fn();

    plugin.cacheService.readStage = vi.fn(async (_courseId: string, stage: number) => {
      if (stage === 0) {
        return makeStage0Cache({
          courseId: 'course-1',
          seedTopic: 'Category theory',
          courseRequest: {
            title: 'Category theory',
            description: 'Make this practical for functional programmers and include proof intuition.',
          },
          scopeSummary: 'Functors, natural transformations',
        });
      }
      if (stage === 1) {
        return {
          courseId: 'course-1',
          concepts: [
            {
              id: 'functors',
              title: 'Functors',
              description: 'Structure-preserving mappings between categories.',
              sourceRefs: [],
            },
          ],
        };
      }
      if (stage === 2) {
        return {
          courseId: 'course-1',
          proficiencyMap: { functors: 2 },
          completedAt: new Date().toISOString(),
        };
      }
      return undefined;
    }) as never;
    plugin.cacheService.writeStage = writeStage;
    plugin.app.workspace.getLeaf = () => ({
      setViewState,
    });
    plugin.llmService.callJson = vi.fn(async () => ({
      curriculum: {
        courseId: 'wrong-id',
        title: 'Applied Category Theory',
        modules: [
          {
            moduleId: 'foundations',
            title: 'Foundations',
            description: 'Core language and intuition.',
            lessons: [
              {
                lessonId: 'what-is-a-category',
                title: 'What Is a Category?',
                description: 'Learn the basic ingredients.',
                prerequisites: [],
              },
            ],
          },
        ],
      },
    })) as never;

    await runStage3(plugin as never, 'course-1');

    expect(plugin.llmService.callJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        courseRequest: expect.stringContaining('functional programmers'),
        courseDescription: 'Make this practical for functional programmers and include proof intuition.',
      }),
      expect.any(String)
    );
    expect(writeStage).toHaveBeenCalledTimes(2);
    expect(writeStage.mock.calls[0]?.[1]).toBe(3);
    expect(writeStage.mock.calls[0]?.[2]).toMatchObject({
      courseId: 'course-1',
      status: 'pending',
    });
    expect(writeStage.mock.calls[1]?.[2]).toMatchObject({
      courseId: 'course-1',
      status: 'complete',
      curriculum: {
        courseId: 'course-1',
        title: 'Applied Category Theory',
      },
    });
    expect(setViewState).toHaveBeenCalledTimes(2);
    expect(setViewState.mock.calls[1]?.[0]).toMatchObject({
      type: 'delve-syllabus-editor-view',
      state: expect.objectContaining({
        courseId: 'course-1',
        seedTopic: 'Category theory',
        loading: false,
      }),
    });
  });
});
