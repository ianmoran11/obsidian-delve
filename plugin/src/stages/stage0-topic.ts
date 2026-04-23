import { Notice } from 'obsidian';
import type DelvePlugin from '../../main';
import type { TaxonomyNode, Stage0Cache } from '../interfaces';
import {
  Stage0ResponseSchema,
  DisaggregateResponseSchema,
  ExpandResponseSchema,
  SuggestRelatedResponseSchema,
  validateAndRepair,
} from '../services/validator';
import { TAXONOMY_VIEW_TYPE } from '../constants';
import { runStage1 } from './stage1-concepts';

export async function runStage0(
  plugin: DelvePlugin,
  seedTopic: string,
  courseId: string
): Promise<void> {
  await plugin.lockService.acquire(courseId, 0);
  const createdAt = new Date().toISOString();
  await plugin.cacheService.writeMeta({
    courseId,
    title: seedTopic,
    createdAt,
  });
  await plugin.cacheService.writeStage(courseId, 0, {
    courseId,
    seedTopic,
    taxonomy: [],
    selectedScope: [],
    scopeSummary: '',
    status: 'pending',
    startedAt: createdAt,
  });

  try {
    new Notice('Generating topic taxonomy…');

    const promptConfig = await plugin.loadPrompt('stage0-taxonomy');
    const raw = await plugin.llmService.callJson<{ taxonomy: TaxonomyNode[] }>(
      promptConfig.template,
      { topic: seedTopic },
      promptConfig.model
    );

    const validated = await validateAndRepair(
      raw,
      Stage0ResponseSchema,
      plugin.llmService,
      'Fix the taxonomy JSON so every node has id (kebab-case string), title, and description.'
    );

    await plugin.cacheService.writeStage(courseId, 0, {
      courseId,
      seedTopic,
      taxonomy: validated.taxonomy,
      selectedScope: [],
      scopeSummary: '',
      status: 'pending',
      startedAt: createdAt,
    });

    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: TAXONOMY_VIEW_TYPE,
      active: true,
      state: { courseId, seedTopic, taxonomy: validated.taxonomy },
    });
    plugin.app.workspace.revealLeaf(leaf);
  } catch (e) {
    await plugin.lockService.release();
    new Notice(`Delve: taxonomy generation failed — ${(e as Error).message}`);
    throw e;
  }
}

export async function disaggregateNode(
  plugin: DelvePlugin,
  seedTopic: string,
  node: TaxonomyNode,
  selectedScope: string[]
): Promise<TaxonomyNode[]> {
  const promptConfig = await plugin.loadPrompt('stage0-disaggregate');
  const raw = await plugin.llmService.callJson<{ nodes: TaxonomyNode[] }>(
    promptConfig.template,
    {
      topic: seedTopic,
      nodeTitle: node.title,
      nodeDescription: node.description,
      selectedScope: selectedScope.join(', ') || 'none selected yet',
    },
    promptConfig.model
  );
  const validated = await validateAndRepair(
    raw, DisaggregateResponseSchema, plugin.llmService,
    'Return { nodes: [...] } with 2–5 TaxonomyNode items each having id, title, description.'
  );
  return validated.nodes;
}

export async function expandNode(
  plugin: DelvePlugin,
  seedTopic: string,
  node: TaxonomyNode
): Promise<TaxonomyNode[]> {
  const promptConfig = await plugin.loadPrompt('stage0-expand');
  const raw = await plugin.llmService.callJson<{ children: TaxonomyNode[] }>(
    promptConfig.template,
    {
      topic: seedTopic,
      nodeTitle: node.title,
      nodeDescription: node.description,
    },
    promptConfig.model
  );
  const validated = await validateAndRepair(
    raw, ExpandResponseSchema, plugin.llmService,
    'Return { children: [...] } with 3–6 TaxonomyNode items each having id, title, description.'
  );
  return validated.children;
}

export async function suggestRelated(
  plugin: DelvePlugin,
  seedTopic: string,
  existingTaxonomy: TaxonomyNode[],
  selectedScope: string[]
): Promise<TaxonomyNode[]> {
  const promptConfig = await plugin.loadPrompt('stage0-suggest-related');
  const existingTitles = existingTaxonomy.map(n => n.title).join(', ');
  const raw = await plugin.llmService.callJson<{ topics: TaxonomyNode[] }>(
    promptConfig.template,
    {
      topic: seedTopic,
      existingTopics: existingTitles,
      selectedScope: selectedScope.join(', ') || 'none selected yet',
    },
    promptConfig.model
  );
  const validated = await validateAndRepair(
    raw, SuggestRelatedResponseSchema, plugin.llmService,
    'Return { topics: [...] } with 2–5 TaxonomyNode items not already in the existing list.'
  );
  return validated.topics;
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
    status: 'complete',
    completedAt: new Date().toISOString(),
  };

  await plugin.cacheService.writeStage(courseId, 0, cache);
  await plugin.lockService.release();

  // Chain directly into Stage 1
  await runStage1(plugin, courseId);
}

export function replaceNode(
  taxonomy: TaxonomyNode[], targetId: string, replacements: TaxonomyNode[]
): TaxonomyNode[] {
  const result: TaxonomyNode[] = [];
  for (const node of taxonomy) {
    if (node.id === targetId) {
      result.push(...replacements);
    } else {
      result.push({
        ...node,
        children: node.children ? replaceNode(node.children, targetId, replacements) : undefined,
      });
    }
  }
  return result;
}

export function addChildren(
  taxonomy: TaxonomyNode[], targetId: string, newChildren: TaxonomyNode[]
): TaxonomyNode[] {
  return taxonomy.map(node => {
    if (node.id === targetId) {
      return { ...node, children: [...(node.children ?? []), ...newChildren] };
    }
    if (node.children) {
      return { ...node, children: addChildren(node.children, targetId, newChildren) };
    }
    return node;
  });
}

export function appendTopLevel(
  taxonomy: TaxonomyNode[], nodes: TaxonomyNode[]
): TaxonomyNode[] {
  return [...taxonomy, ...nodes];
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
