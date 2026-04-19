import type DelvePlugin from '../../main';

export type PromptName =
  | 'stage0-taxonomy'
  | 'stage0-disaggregate'
  | 'stage0-expand'
  | 'stage0-suggest-related'
  | 'stage1-concepts'
  | 'stage3-curriculum'
  | 'stage4-lesson';

const DEFAULTS: Record<PromptName, string> = {
  'stage0-taxonomy': `You are a curriculum expert. Given the broad topic "{{topic}}", generate a comprehensive hierarchical taxonomy of the subject area.

Return a JSON object with this EXACT structure:
{
  "taxonomy": [
    {
      "id": "unique-kebab-case-id",
      "title": "Domain Title",
      "description": "One sentence describing this domain.",
      "children": [
        { "id": "unique-child-id", "title": "Subtopic", "description": "One sentence.", "children": [] }
      ]
    }
  ]
}

Requirements:
- 3 to 5 top-level domains, 3 to 6 subtopics per domain, maximum 3 levels deep
- Every node MUST have: id (unique kebab-case), title, description
- Cover the full breadth of "{{topic}}" comprehensively`,

  'stage0-disaggregate': `A learner is scoping a course on "{{topic}}".

Split "{{nodeTitle}}" ({{nodeDescription}}) into more specific, distinct alternatives at the same level.
Current selections: {{selectedScope}}

Return: { "nodes": [ { "id": "kebab-id", "title": "...", "description": "One sentence." } ] }
- 2 to 5 nodes, non-overlapping, covering what "{{nodeTitle}}" covered
- Do NOT include "{{nodeTitle}}" itself`,

  'stage0-expand': `A learner is scoping a course on "{{topic}}".

Add detailed subtopics under "{{nodeTitle}}" ({{nodeDescription}}).

Return: { "children": [ { "id": "kebab-id", "title": "...", "description": "One sentence." } ] }
- 3 to 6 children, fine-grained and learnable within "{{nodeTitle}}"`,

  'stage0-suggest-related': `A learner is building a course on "{{topic}}".
Existing topics: {{existingTopics}}
Current selections: {{selectedScope}}

Suggest 2–5 additional top-level topics NOT already listed.

Return: { "topics": [ { "id": "kebab-id", "title": "...", "description": "One sentence explaining relevance." } ] }`,

  'stage1-concepts': `You are a curriculum expert building a personalised course on "{{topic}}", scoped to: {{scopeSummary}}.

Selected areas: {{scopeNodes}}

{{contextSection}}

Extract 15 to 25 foundational concepts and key terms the learner needs to master this scope.

Return a JSON object:
{
  "concepts": [
    {
      "id": "unique-kebab-id",
      "title": "Concept Name",
      "description": "2–3 sentences explaining this concept and why it matters for the learner.",
      "sourceRefs": []
    }
  ]
}

Requirements:
- 15 to 25 concepts, ordered from foundational to advanced
- Each concept must be DISTINCT and LEARNABLE — not just a vocabulary term
- If source material was provided and a concept appears in it, list the source filename(s) in sourceRefs
- If no source material was provided, sourceRefs must be an empty array
- Cover prerequisites, core ideas, and practical applications within the scope`,

  'stage3-curriculum': '// TODO: Stage 3 curriculum design prompt — to be implemented',
  'stage4-lesson': '// TODO: Stage 4 lesson generation prompt — to be implemented',
};

export async function loadPrompt(
  plugin: DelvePlugin,
  name: PromptName
): Promise<string> {
  const override = plugin.settings.promptOverrides[name];
  if (override?.trim()) return override.trim();
  return DEFAULTS[name];
}
