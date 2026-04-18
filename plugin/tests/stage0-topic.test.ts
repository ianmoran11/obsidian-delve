import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmScope } from '../src/stages/stage0-topic';
import { makeMockPlugin, makeTaxonomyNode } from './helpers';

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
});

interface Stage0Cache {
  courseId: string;
  seedTopic: string;
  taxonomy: unknown[];
  selectedScope: string[];
  scopeSummary: string;
  completedAt: string;
}
