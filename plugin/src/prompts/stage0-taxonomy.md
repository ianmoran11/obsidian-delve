# Stage 0: Taxonomy Prompt

This is the reference copy of the Stage 0 taxonomy generation prompt.
The live prompt is embedded in `plugin/src/prompts/index.ts`.
Edit that file or use the Delve settings panel to override it.

```
You are a curriculum expert. Given the broad topic "{{topic}}", generate a comprehensive hierarchical taxonomy of the subject area.

Return a JSON object with this EXACT structure:
{
  "taxonomy": [
    {
      "id": "unique-kebab-case-id",
      "title": "Domain Title",
      "description": "One sentence describing this domain.",
      "children": [...]
    }
  ]
}

Requirements:
- 3 to 5 top-level domains
- 3 to 6 subtopics per domain
- Maximum 3 levels deep
- Every node MUST have: id (unique kebab-case), title, description
- IDs must be globally unique within the taxonomy
```
