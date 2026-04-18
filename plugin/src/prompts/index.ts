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
        {
          "id": "unique-child-id",
          "title": "Subtopic Title",
          "description": "One sentence description.",
          "children": []
        }
      ]
    }
  ]
}

Requirements:
- 3 to 5 top-level domains
- 3 to 6 subtopics per domain
- Maximum 3 levels deep
- Every node MUST have: id (unique kebab-case string), title, description
- IDs must be globally unique within the taxonomy
- Cover the full breadth of "{{topic}}" comprehensively`,

  'stage0-disaggregate': `A learner is scoping a course on "{{topic}}".

They want to split the topic "{{nodeTitle}}" ({{nodeDescription}}) into more specific, distinct alternatives at the same level of the taxonomy.

Current selections: {{selectedScope}}

Return a JSON object:
{
  "nodes": [
    { "id": "unique-kebab-id", "title": "More Specific Topic", "description": "One sentence." }
  ]
}

Requirements:
- 2 to 5 nodes
- Each node should be a distinct, non-overlapping sub-area that together cover what "{{nodeTitle}}" covered
- IDs must be unique kebab-case strings not already in the taxonomy
- Do NOT include "{{nodeTitle}}" itself in the result`,

  'stage0-expand': `A learner is scoping a course on "{{topic}}".

They want to see more detailed subtopics under "{{nodeTitle}}" ({{nodeDescription}}).

Return a JSON object:
{
  "children": [
    { "id": "unique-kebab-id", "title": "Detailed Subtopic", "description": "One sentence." }
  ]
}

Requirements:
- 3 to 6 child nodes
- Each should be a concrete, learnable sub-area within "{{nodeTitle}}"
- IDs must be unique kebab-case strings
- Focus on depth: these are fine-grained subtopics, not broad alternatives`,

  'stage0-suggest-related': `A learner is building a course on "{{topic}}".

Existing top-level topics already in their taxonomy: {{existingTopics}}
Their current selections: {{selectedScope}}

Suggest 2 to 5 additional top-level topics that are related and complementary to "{{topic}}" but NOT already covered by the existing list.

Return a JSON object:
{
  "topics": [
    { "id": "unique-kebab-id", "title": "Related Topic", "description": "One sentence explaining relevance." }
  ]
}

Requirements:
- 2 to 5 topics
- Must NOT duplicate any existing topic
- Should be genuinely related and useful alongside the existing taxonomy
- IDs must be unique kebab-case strings`,

  'stage1-concepts': '// TODO: Stage 1 concept extraction prompt — to be implemented',
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
