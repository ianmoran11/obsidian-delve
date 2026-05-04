import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmScope, getCourseRequest, runStage0 } from '../src/stages/stage0-topic';
import { makeMockPlugin, makeTaxonomyNode } from './helpers';

vi.mock('../src/stages/stage1-concepts', () => ({
  runStage1: vi.fn().mockResolvedValue(undefined),
}));

describe('stage0: confirmScope', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;

  beforeEach(() => {
    plugin = makeMockPlugin();
  });

  it('writes stage 0 cache with correct scope summary', async () => {
    const taxonomy = [
      makeTaxonomyNode({ id: 'ml', title: 'Machine Learning' }),
      makeTaxonomyNode({ id: 'dl', title: 'Deep Learning' }),
    ];
    const writeStage = vi.fn();
    plugin.cacheService.writeStage = writeStage;
    plugin.lockService.release = vi.fn();

    await confirmScope(plugin as never, 'course-1', 'ML', taxonomy, ['ml', 'dl']);

    expect(writeStage).toHaveBeenCalledOnce();
    const [courseId, stage, cache] = writeStage.mock.calls[0] as [
      string,
      number,
      Stage0Cache,
    ];
    expect(courseId).toBe('course-1');
    expect(stage).toBe(0);
    expect(cache.selectedScope).toEqual(['ml', 'dl']);
    expect(cache.scopeSummary).toBe('Machine Learning, Deep Learning');
    expect(cache.seedTopic).toBe('ML');
    expect(cache.completedAt).toBeTruthy();
  });

  it('releases the lock after writing cache', async () => {
    const release = vi.fn();
    plugin.lockService.release = release;
    plugin.cacheService.writeStage = vi.fn();

    await confirmScope(plugin as never, 'course-1', 'ML', [], []);

    expect(release).toHaveBeenCalledOnce();
  });

  it('handles empty scope selection gracefully', async () => {
    const writeStage = vi.fn();
    plugin.cacheService.writeStage = writeStage;
    plugin.lockService.release = vi.fn();

    await confirmScope(plugin as never, 'course-1', 'ML', [], []);

    const [, , cache] = writeStage.mock.calls[0] as [string, number, Stage0Cache];
    expect(cache.selectedScope).toEqual([]);
    expect(cache.scopeSummary).toBe('');
  });

  it('resolves IDs to titles for scope summary', async () => {
    const taxonomy = [
      makeTaxonomyNode({
        id: 'root',
        title: 'Root',
        children: [makeTaxonomyNode({ id: 'child', title: 'Child Topic' })],
      }),
    ];
    const writeStage = vi.fn();
    plugin.cacheService.writeStage = writeStage;
    plugin.lockService.release = vi.fn();

    await confirmScope(plugin as never, 'c1', 'Topic', taxonomy, ['root', 'child']);

    const [, , cache] = writeStage.mock.calls[0] as [string, number, Stage0Cache];
    expect(cache.scopeSummary).toBe('Root, Child Topic');
  });

  it('preserves the detailed course request when confirming scope', async () => {
    const writeStage = vi.fn();
    plugin.cacheService.readStage = vi.fn(async () => ({
      courseId: 'c1',
      seedTopic: 'Applied AI',
      courseDescription: 'For product managers; include evaluation rubrics.',
      courseRequest: {
        title: 'Applied AI',
        description: 'For product managers; include evaluation rubrics.',
      },
      taxonomy: [],
      selectedScope: [],
      scopeSummary: '',
    })) as never;
    plugin.cacheService.writeStage = writeStage;
    plugin.lockService.release = vi.fn();

    await confirmScope(plugin as never, 'c1', 'Applied AI', [], []);

    const [, , cache] = writeStage.mock.calls[0] as [string, number, Stage0Cache];
    expect(cache.courseRequest).toEqual({
      title: 'Applied AI',
      description: 'For product managers; include evaluation rubrics.',
    });
    expect(cache.courseDescription).toBe('For product managers; include evaluation rubrics.');
  });
});

describe('stage0: runStage0', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;

  beforeEach(() => {
    plugin = makeMockPlugin();
  });

  it('stores and sends a structured course request to the taxonomy prompt', async () => {
    const writeStage = vi.fn();
    plugin.cacheService.writeStage = writeStage;
    plugin.llmService.callJson = vi.fn(async () => ({
      taxonomy: [makeTaxonomyNode({ id: 'foundations', title: 'Foundations' })],
    })) as never;

    await runStage0(plugin as never, {
      title: 'Practical Cryptography',
      description: 'For backend engineers. Focus on protocols, threat models, and implementation mistakes.',
    }, 'course-1');

    expect(plugin.llmService.callJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        topic: 'Practical Cryptography',
        courseTitle: 'Practical Cryptography',
        courseDescription: 'For backend engineers. Focus on protocols, threat models, and implementation mistakes.',
        courseRequest: expect.stringContaining('Course title: Practical Cryptography'),
      }),
      expect.any(String)
    );

    const pendingCache = writeStage.mock.calls[0]?.[2] as Stage0Cache;
    expect(pendingCache.seedTopic).toBe('Practical Cryptography');
    expect(pendingCache.courseRequest).toEqual({
      title: 'Practical Cryptography',
      description: 'For backend engineers. Focus on protocols, threat models, and implementation mistakes.',
    });
  });

  it('reads old stage 0 caches as title-only course requests', () => {
    expect(getCourseRequest({
      courseId: 'legacy',
      seedTopic: 'Linear Algebra',
      taxonomy: [],
      selectedScope: [],
      scopeSummary: '',
    })).toEqual({
      title: 'Linear Algebra',
      description: '',
    });
  });
});

interface Stage0Cache {
  courseId: string;
  seedTopic: string;
  courseDescription?: string;
  courseRequest?: { title: string; description: string };
  taxonomy: unknown[];
  selectedScope: string[];
  scopeSummary: string;
  status?: 'pending' | 'complete';
  startedAt?: string;
  completedAt?: string;
}
