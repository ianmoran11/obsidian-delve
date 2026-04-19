import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type { LikertScore, Stage2Cache } from '../interfaces';
import { DIAGNOSTIC_VIEW_TYPE } from '../constants';

export async function runStage2(
  plugin: DelvePlugin,
  courseId: string
): Promise<void> {
  const stage1 = await plugin.cacheService.readStage(courseId, 1);
  if (!stage1) throw new Error('Stage 1 not complete — run concept extraction first.');
  const stage0 = await plugin.cacheService.readStage(courseId, 0);
  const stage2 = await plugin.cacheService.readStage(courseId, 2);

  await plugin.lockService.acquire(courseId, 2);

  const leaf = plugin.app.workspace.getLeaf(false);
  await leaf.setViewState({
    type: DIAGNOSTIC_VIEW_TYPE,
    active: true,
    state: {
      courseId,
      seedTopic: stage0?.seedTopic ?? '',
      concepts: stage1.concepts,
      savedProficiencyMap: stage2?.proficiencyMap,
    },
  });
  plugin.app.workspace.revealLeaf(leaf);
}

export async function confirmDiagnostic(
  plugin: DelvePlugin,
  courseId: string,
  proficiencyMap: Record<string, LikertScore>
): Promise<void> {
  const cache: Stage2Cache = {
    courseId,
    proficiencyMap,
    completedAt: new Date().toISOString(),
  };
  await plugin.cacheService.writeStage(courseId, 2, cache);
  await plugin.lockService.release();
  new Notice('Assessment saved.');
}
