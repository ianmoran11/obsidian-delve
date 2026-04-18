import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type { TaxonomyNode, Stage0Cache } from '../interfaces';
import { Stage0ResponseSchema, validateAndRepair } from '../services/validator';
import { TAXONOMY_VIEW_TYPE } from '../constants';

export async function runStage0(
  plugin: DelvePlugin,
  seedTopic: string,
  courseId: string
): Promise<void> {
  await plugin.lockService.acquire(courseId, 0);

  try {
    new Notice('Generating topic taxonomy…');

    const promptTemplate = await plugin.loadPrompt('stage0-taxonomy');
    const raw = await plugin.llmService.callJson<{ taxonomy: TaxonomyNode[] }>(
      promptTemplate,
      { topic: seedTopic }
    );

    const validated = await validateAndRepair(
      raw,
      Stage0ResponseSchema,
      plugin.llmService,
      'Fix the taxonomy JSON so every node has id (kebab-case string), title, and description fields.'
    );

    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: TAXONOMY_VIEW_TYPE,
      active: true,
      state: {
        courseId,
        seedTopic,
        taxonomy: validated.taxonomy,
      },
    });
    plugin.app.workspace.revealLeaf(leaf);
  } catch (e) {
    await plugin.lockService.release();
    new Notice(`Delve: taxonomy generation failed — ${(e as Error).message}`);
    throw e;
  }
}

export async function confirmScope(
  plugin: DelvePlugin,
  courseId: string,
  seedTopic: string,
  taxonomy: TaxonomyNode[],
  selectedScope: string[]
): Promise<void> {
  const scopeSummary = selectedScope
    .map(id => findNode(taxonomy, id)?.title ?? id)
    .join(', ');

  const cache: Stage0Cache = {
    courseId,
    seedTopic,
    taxonomy,
    selectedScope,
    scopeSummary,
    completedAt: new Date().toISOString(),
  };

  await plugin.cacheService.writeStage(courseId, 0, cache);
  await plugin.lockService.release();
  new Notice('Scope confirmed. Ready for concept extraction.');
}

function findNode(nodes: TaxonomyNode[], id: string): TaxonomyNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
