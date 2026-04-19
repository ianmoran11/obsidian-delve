import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type { Concept, Stage1Cache, TaxonomyNode } from '../interfaces';
import type { ContextPayload } from '../services/context';
import { Stage1ResponseSchema, validateAndRepair } from '../services/validator';
import { CONCEPTS_VIEW_TYPE } from '../constants';

export async function runStage1(
  plugin: DelvePlugin,
  courseId: string
): Promise<void> {
  await plugin.lockService.acquire(courseId, 1);

  try {
    new Notice('Extracting concepts…');

    const stage0 = await plugin.cacheService.readStage(courseId, 0);
    if (!stage0) throw new Error('Stage 0 not complete — run the topic explorer first.');

    const context = await plugin.contextService.build();
    const promptTemplate = await plugin.loadPrompt('stage1-concepts');

    const scopeNodeTitles = stage0.selectedScope
      .map(id => findNodeTitle(stage0.taxonomy, id))
      .filter((t): t is string => t !== undefined)
      .join(', ');

    const raw = await plugin.llmService.callJson<{ concepts: Concept[] }>(
      promptTemplate,
      {
        topic: stage0.seedTopic,
        scopeSummary: stage0.scopeSummary,
        scopeNodes: scopeNodeTitles || stage0.scopeSummary,
        contextSection: buildContextSection(context),
      }
    );

    const validated = await validateAndRepair(
      raw,
      Stage1ResponseSchema,
      plugin.llmService,
      'Return { concepts: [...] } where each concept has id (kebab-case), title, description, and sourceRefs (array of strings, may be empty).'
    );

    const cache: Stage1Cache = {
      courseId,
      concepts: validated.concepts,
      completedAt: new Date().toISOString(),
    };

    await plugin.cacheService.writeStage(courseId, 1, cache);
    await plugin.lockService.release();

    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: CONCEPTS_VIEW_TYPE,
      active: true,
      state: {
        courseId,
        seedTopic: stage0.seedTopic,
        concepts: validated.concepts,
        sourceMode: context.mode,
        fileCount: context.fileCount,
      },
    });
    plugin.app.workspace.revealLeaf(leaf);
  } catch (e) {
    await plugin.lockService.release();
    new Notice(`Delve: concept extraction failed — ${(e as Error).message}`);
    throw e;
  }
}

function buildContextSection(context: ContextPayload): string {
  if (context.mode === 'knowledge-only' || !context.content) {
    return 'No source material has been provided. Draw entirely on your general knowledge.';
  }
  return `The learner has provided ${context.fileCount} source file(s). Prefer this material where it is strong; supplement with general knowledge where it is absent or incomplete.\n\n${context.content}`;
}

function findNodeTitle(
  taxonomy: TaxonomyNode[],
  id: string
): string | undefined {
  for (const n of taxonomy) {
    if (n.id === id) return n.title;
    if (n.children) {
      const found = findNodeTitle(n.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
