import { App, Notice } from 'obsidian';
import type { LlmService } from '../services/openrouter';
import type { CacheService } from '../services/cache';
import type { LockService } from '../services/lock';
import type { ContextService } from '../services/context';
import { validate, TaxonomyResponseSchema, validateWithRepair } from '../services/validator';
import type { TaxonomyNode, Stage0Cache, CourseId } from '../interfaces';
import { loadPrompt } from '../prompts';
import { TaxonomyView, TAXONOMY_VIEW_TYPE } from '../ui/taxonomy-view';

export async function runStage0(
  app: App,
  courseId: CourseId,
  seedTopic: string,
  llm: LlmService,
  cache: CacheService,
  lock: LockService,
  context: ContextService,
  promptOverride?: string,
): Promise<void> {
  await lock.acquire(courseId, 0);

  try {
    new Notice(`Delve: Generating taxonomy for \u201c${seedTopic}\u201d\u2026`);

    const sourceCtx = await context.buildContext();
    const prompt = loadPrompt('stage0-taxonomy', promptOverride);

    const raw = await llm.callJson<unknown>(prompt, {
      topic: seedTopic,
      sourceContext:
        sourceCtx.text
          ? `\n\nSource material (${sourceCtx.mode} mode):\n${sourceCtx.text.slice(0, 8_000)}`
          : '',
      mode: sourceCtx.mode,
    });

    const { taxonomy } = await validateWithRepair(
      TaxonomyResponseSchema,
      raw,
      async () => {
        new Notice('Delve: Repairing taxonomy response\u2026');
        return llm.callJson<unknown>(
          'The following JSON failed schema validation. Return only a corrected version that matches the required schema.\n\nOriginal:\n{{original}}',
          { original: JSON.stringify(raw) },
        );
      },
    );

    // Persist with empty scope (to be confirmed by user in TaxonomyView)
    const draft: Stage0Cache = {
      courseId,
      seedTopic,
      taxonomy,
      selectedScope: [],
      scopeSummary: '',
      completedAt: '',
    };
    await cache.writeStage(courseId, 0, draft);

    await openTaxonomyView(app, courseId, taxonomy, async (selected, summary) => {
      const completed: Stage0Cache = {
        ...draft,
        selectedScope: selected,
        scopeSummary: summary,
        completedAt: new Date().toISOString(),
      };
      await cache.writeStage(courseId, 0, completed);
      await lock.release();
      new Notice('Delve: Scope confirmed. Stage 0 complete \u2014 ready for concept extraction.');
    });
  } catch (err) {
    await lock.release();
    throw err;
  }
}

/** Re-open the TaxonomyView for an already-generated (but unconfirmed) taxonomy. */
export async function reopenTaxonomyView(
  app: App,
  courseId: CourseId,
  taxonomy: TaxonomyNode[],
  cache: CacheService,
  lock: LockService,
): Promise<void> {
  const draft = await cache.readStage(courseId, 0);
  if (!draft) return;

  await openTaxonomyView(app, courseId, taxonomy, async (selected, summary) => {
    const completed: Stage0Cache = {
      ...draft,
      selectedScope: selected,
      scopeSummary: summary,
      completedAt: new Date().toISOString(),
    };
    await cache.writeStage(courseId, 0, completed);
    await lock.release();
    new Notice('Delve: Scope confirmed. Stage 0 complete.');
  });
}

async function openTaxonomyView(
  app: App,
  courseId: CourseId,
  taxonomy: TaxonomyNode[],
  onConfirm: (selectedIds: string[], scopeSummary: string) => Promise<void>,
): Promise<void> {
  const existing = app.workspace.getLeavesOfType(TAXONOMY_VIEW_TYPE);
  const leaf = existing.length > 0 ? existing[0] : app.workspace.getLeaf(true);

  await leaf.setViewState({
    type: TAXONOMY_VIEW_TYPE,
    active: true,
    state: { courseId, taxonomy, onConfirm } satisfies import('../ui/taxonomy-view').TaxonomyViewState,
  });

  app.workspace.revealLeaf(leaf);
}
