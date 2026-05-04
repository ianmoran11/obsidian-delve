import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type { Concept, Stage1Cache, TaxonomyNode } from '../interfaces';
import type { ContextPayload } from '../services/context';
import { Stage1ResponseSchema, validateAndRepair } from '../services/validator';
import { CONCEPTS_VIEW_TYPE } from '../constants';
import { formatCourseRequest, getCourseRequest } from './stage0-topic';

export async function runStage1(
  plugin: DelvePlugin,
  courseId: string
): Promise<void> {
  if (!plugin.settings.openRouterApiKey) {
    throw new Error('Add your OpenRouter API key in Delve settings before extracting concepts.');
  }

  await plugin.lockService.acquire(courseId, 1);
  await plugin.cacheService.writeStage(courseId, 1, {
    courseId,
    concepts: [],
    status: 'pending',
    startedAt: new Date().toISOString(),
  });

  try {
    new Notice('Extracting concepts…');

    const stage0 = await plugin.cacheService.readStage(courseId, 0);
    if (!stage0) throw new Error('Stage 0 not complete — run the topic explorer first.');
    const courseRequest = getCourseRequest(stage0);

    const context = await plugin.contextService.build();
    const promptConfig = await plugin.loadPrompt('stage1-concepts');

    const scopeNodeTitles = stage0.selectedScope
      .map(id => findNodeTitle(stage0.taxonomy, id))
      .filter((t): t is string => t !== undefined)
      .join(', ');

    const raw = await plugin.llmService.callJson<{ concepts: Concept[] }>(
      promptConfig.template,
      {
        topic: courseRequest.title,
        courseTitle: courseRequest.title,
        courseDescription: courseRequest.description || 'No additional course requirements provided.',
        courseRequest: formatCourseRequest(courseRequest),
        scopeSummary: stage0.scopeSummary,
        scopeNodes: scopeNodeTitles || stage0.scopeSummary,
        contextSection: buildContextSection(context),
      },
      promptConfig.model
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
      status: 'complete',
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
