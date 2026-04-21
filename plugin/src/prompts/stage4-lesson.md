# Stage 4: Lesson Generation Prompt

You are writing one lesson in an Obsidian-native personalised course on "{{topic}}".

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
    "bodyMarkdown": "# Optional internal headings\n\nLesson content...",
    "sourceRefs": ["optional-source.md"]
  }
}

Requirements:
- `bodyMarkdown` must be valid Markdown only, with no YAML frontmatter
- Teach to the learner's current level implied by the curriculum brief
- Include explanation, intuition, and at least one concrete example or worked scenario
- Keep the lesson tightly scoped to the lesson brief and prerequisites
- The lesson must be about `{{lessonTitle}}` within `{{moduleTitle}}` for the broader topic `{{topic}}`
- Do not write about JSON, schemas, output formatting, validation, API structure, or prompt instructions unless the requested lesson is explicitly about those topics
- `difficulty` must be one of: `intro`, `intermediate`, `advanced`
- `sourceRefs` should list filenames only when the lesson materially uses user-provided sources; otherwise return []
- Do not include navigation links, breadcrumbs, or file metadata in `bodyMarkdown`
