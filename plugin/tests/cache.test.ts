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
