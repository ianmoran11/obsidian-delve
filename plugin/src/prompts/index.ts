import type DelvePlugin from '../../main';

export type PromptName =
  | 'stage0-taxonomy'
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
- Cover the full breadth of "{{topic}}" comprehensively
- Write descriptions that help a learner understand what each area covers`,

  'stage1-concepts':
    '// TODO: Stage 1 concept extraction prompt — to be implemented',

  'stage3-curriculum':
    '// TODO: Stage 3 curriculum design prompt — to be implemented',

  'stage4-lesson':
    '// TODO: Stage 4 lesson generation prompt — to be implemented',
};

export async function loadPrompt(
  plugin: DelvePlugin,
  name: PromptName
): Promise<string> {
  const override = plugin.settings.promptOverrides[name];
  if (override?.trim()) return override.trim();
  return DEFAULTS[name];
}
