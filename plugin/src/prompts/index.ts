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

  'stage3-curriculum': `You are designing a personalised course syllabus for "{{topic}}", scoped to: {{scopeSummary}}.

Selected scope nodes: {{scopeNodes}}

Foundational concepts and learner confidence:
{{conceptProficiency}}

{{contextSection}}

Design a draft curriculum that adapts to the learner's current knowledge.

Return a JSON object:
{
  "curriculum": {
    "courseId": "{{courseId}}",
    "title": "Course title",
    "modules": [
      {
        "moduleId": "module-kebab-id",
        "title": "Module title",
        "description": "2-3 sentences explaining the module's role in the course.",
        "lessons": [
          {
            "lessonId": "lesson-kebab-id",
            "title": "Lesson title",
            "description": "1-2 sentences explaining what the learner will achieve.",
            "prerequisites": ["earlier-lesson-id"]
          }
        ]
      }
    ]
  }
}

Requirements:
- Create 3 to 6 modules with 2 to 5 lessons each
- Order lessons from foundational to advanced within each module
- Use the learner's proficiency scores:
  - scores 1-2 mean teach thoroughly
  - score 3 means concise but still included
  - scores 4-5 mean condense or omit unless needed as a prerequisite
- Every lesson must have a unique lessonId in kebab-case
- prerequisites must only reference lessonIds that appear earlier in the curriculum
- Keep the syllabus tightly scoped to "{{scopeSummary}}"
- Prefer user sources when they are strong, but fill gaps with general knowledge when needed`,
  'stage4-lesson': `You are writing one lesson in an Obsidian-native personalised course on "{{topic}}".

Course title: {{courseTitle}}
Module: {{moduleTitle}}
Lesson: {{lessonTitle}}
Lesson brief: {{lessonDescription}}
Prerequisites already covered: {{prerequisiteSummary}}
Generation mode: {{generationMode}}

{{contextSection}}

Write a complete lesson in Obsidian-flavoured Markdown.

Return a JSON object:
{
  "lesson": {
    "title": "Lesson title",
    "summary": "1-2 sentence summary of the lesson.",
    "difficulty": "intro",
    "bodyMarkdown": "# Optional internal headings\\n\\nLesson content...",
    "sourceRefs": ["optional-source.md"]
  }
}

Requirements:
- bodyMarkdown must be valid Markdown only, with no YAML frontmatter
- Teach to the learner's current level implied by the curriculum brief
- Include explanation, intuition, and at least one concrete example or worked scenario
- Keep the lesson tightly scoped to the lesson brief and prerequisites
- difficulty must be one of: intro, intermediate, advanced
- sourceRefs should list filenames only when the lesson materially uses user-provided sources; otherwise return []
- Do not include navigation links, breadcrumbs, or file metadata in bodyMarkdown`,
};

export async function loadPrompt(
  plugin: DelvePlugin,
  name: PromptName
): Promise<string> {
  const override = plugin.settings.promptOverrides[name];
  if (override?.trim()) return override.trim();
  return DEFAULTS[name];
}
