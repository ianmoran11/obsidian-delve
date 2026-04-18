# Delve

An Obsidian plugin that turns a dedicated vault into a personalised, AI-assisted learning environment.

Delve guides you from a broad topic to a structured course with scoped modules, lessons, navigation notes, and a visual curriculum map — using a five-stage LLM pipeline powered by OpenRouter.

## Features

- **Stage 0 — Topic Explorer**: Enter a seed topic; get a hierarchical taxonomy to scope your course
- **Stage 1 — Concept Extraction**: Extract foundational concepts from the scoped topic
- **Stage 2 — Diagnostic**: Self-assess your familiarity with each concept
- **Stage 3 — Curriculum Design**: Generate a proficiency-aware syllabus
- **Stage 4 — Content Generation**: Write lessons, MOCs, Canvas map, and index into your vault

## Installation (BRAT)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. **Settings → BRAT → Add Beta Plugin** → enter `ianmoran11/obsidian-delve`
3. Enable **Delve** in Community Plugins
4. Add your OpenRouter API key in **Settings → Delve**

## Vault Structure

Delve expects a dedicated vault with these folders:

```
1-Raw_Sources/        # Your PDFs and images
2-Markdown_Sources/   # Extracted Markdown (optional)
3-Synthesized/        # Reserved for future use
4-Curriculum/         # Generated course files
```

## Usage

Run the command **Delve: Start new course** (Cmd/Ctrl+P) to begin.

## Platform Support

Delve runs on both Obsidian desktop (macOS, Windows, Linux) and Obsidian mobile (Android, iOS). It uses only Obsidian-safe APIs (`requestUrl`, `Vault`, `DataAdapter`) and avoids Node.js built-ins.
