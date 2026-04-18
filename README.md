# Delve

Delve is an Obsidian plugin that turns a dedicated vault into a personalised, AI-assisted learning environment.

Given a broad topic — such as machine learning, linear algebra, or Kubernetes — Delve builds a structured course with scoped modules, lessons, navigation notes, and a visual curriculum map. It uses a five-stage LLM pipeline through OpenRouter.

## Stages

| Stage | Name | Description |
|-------|------|-------------|
| 0 | Topic Explorer | Generates a hierarchical taxonomy; user selects scope |
| 1 | Concept Extraction | Extracts foundational concepts from the scoped topic |
| 2 | Diagnostic | Learner self-assesses proficiency via Likert scale |
| 3 | Curriculum Design | Generates a proficiency-aware syllabus |
| 4 | Content Generation | Writes lesson files, MOCs, Canvas, and Index into the vault |

## Requirements

- Obsidian 1.5.0+
- An [OpenRouter](https://openrouter.ai) API key

## Vault Structure

Delve expects the following folders in your vault:

```
1-Raw_Sources/       # Original PDFs or images (optional)
2-Markdown_Sources/  # Extracted Markdown source material (optional)
3-Synthesized/       # Reserved for future use
4-Curriculum/        # Generated course output
```

Source material is optional. Delve works in three modes:
- **Knowledge-only**: No sources provided; model uses general knowledge
- **Augmented**: Sources provided but incomplete; model supplements with general knowledge
- **Grounded**: Sources provided; model prefers them

## Installation

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) during development.

## Development

```bash
cd plugin
npm install
npm run dev      # watch mode
npm run build    # production build
npm run test     # run tests
npm run typecheck
```
