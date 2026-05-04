import type DelvePlugin from '../../main';
import { VAULT_PATHS } from '../constants';

export type PromptName =
  | 'stage0-taxonomy'
  | 'stage0-disaggregate'
  | 'stage0-expand'
  | 'stage0-suggest-related'
  | 'stage1-concepts'
  | 'stage3-curriculum'
  | 'stage4-lesson';

export interface PromptConfig {
  name: PromptName;
  model: string;
  template: string;
  path: string;
}

interface PromptDefinition {
  title: string;
  filename: string;
  description: string;
  defaultModel: string;
  template: string;
}

interface RuntimeConfig {
  defaultModel: string;
}

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const CONFIG_NOTE_PATH = `${VAULT_PATHS.SETTINGS}/Delve Config.md`;

const PROMPTS: Record<PromptName, PromptDefinition> = {
  'stage0-taxonomy': {
    title: 'Stage 0 - Taxonomy',
    filename: 'Stage 0 - Taxonomy.md',
    description: 'Generates the first scoped taxonomy for a broad topic.',
    defaultModel: DEFAULT_MODEL,
    template: `You are a curriculum expert. Generate a comprehensive hierarchical taxonomy for this course request.

{{courseRequest}}

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
- Cover the full breadth of "{{courseTitle}}" comprehensively while honoring the detailed request`,
  },
  'stage0-disaggregate': {
    title: 'Stage 0 - Disaggregate Node',
    filename: 'Stage 0 - Disaggregate Node.md',
    description: 'Splits one scoped node into more specific alternatives.',
    defaultModel: DEFAULT_MODEL,
    template: `A learner is scoping a course on "{{topic}}".

Split "{{nodeTitle}}" ({{nodeDescription}}) into more specific, distinct alternatives at the same level.
Current selections: {{selectedScope}}

Return: { "nodes": [ { "id": "kebab-id", "title": "...", "description": "One sentence." } ] }
- 2 to 5 nodes, non-overlapping, covering what "{{nodeTitle}}" covered
- Do NOT include "{{nodeTitle}}" itself`,
  },
  'stage0-expand': {
    title: 'Stage 0 - Expand Node',
    filename: 'Stage 0 - Expand Node.md',
    description: 'Adds more granular children under a chosen taxonomy node.',
    defaultModel: DEFAULT_MODEL,
    template: `A learner is scoping a course on "{{topic}}".

Add detailed subtopics under "{{nodeTitle}}" ({{nodeDescription}}).

Return: { "children": [ { "id": "kebab-id", "title": "...", "description": "One sentence." } ] }
- 3 to 6 children, fine-grained and learnable within "{{nodeTitle}}"`,
  },
  'stage0-suggest-related': {
    title: 'Stage 0 - Suggest Related Topics',
    filename: 'Stage 0 - Suggest Related Topics.md',
    description: 'Suggests missing top-level topics related to the current scope.',
    defaultModel: DEFAULT_MODEL,
    template: `A learner is building a course on "{{topic}}".
Existing topics: {{existingTopics}}
Current selections: {{selectedScope}}

Suggest 2–5 additional top-level topics NOT already listed.

Return: { "topics": [ { "id": "kebab-id", "title": "...", "description": "One sentence explaining relevance." } ] }`,
  },
  'stage1-concepts': {
    title: 'Stage 1 - Concept Extraction',
    filename: 'Stage 1 - Concept Extraction.md',
    description: 'Extracts the foundational concepts for the chosen scope.',
    defaultModel: DEFAULT_MODEL,
    template: `You are a curriculum expert building a personalised course.

{{courseRequest}}

Chosen scope: {{scopeSummary}}

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
- Cover prerequisites, core ideas, and practical applications within the scope
- Honor the detailed course request when selecting concepts, depth, tone, examples, and exclusions`,
  },
  'stage3-curriculum': {
    title: 'Stage 3 - Curriculum Design',
    filename: 'Stage 3 - Curriculum Design.md',
    description: 'Designs the editable syllabus from scope, concepts, and self-assessment.',
    defaultModel: DEFAULT_MODEL,
    template: `You are designing a personalised course syllabus.

{{courseRequest}}

Chosen scope: {{scopeSummary}}

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
- Honor the detailed course request when choosing module sequence, lesson depth, examples, format, and assessment emphasis
- Prefer user sources when they are strong, but fill gaps with general knowledge when needed`,
  },
  'stage4-lesson': {
    title: 'Stage 4 - Lesson Generation',
    filename: 'Stage 4 - Lesson Generation.md',
    description: 'Writes one lesson at a time into the curriculum vault structure.',
    defaultModel: DEFAULT_MODEL,
    template: `You are writing one lesson in an Obsidian-native personalised course.

Course title: {{courseTitle}}
Original course request:
{{courseRequest}}

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
- The lesson must be about "{{lessonTitle}}" within "{{moduleTitle}}" for the broader course "{{courseTitle}}"
- Honor the detailed course request when choosing tone, depth, examples, format, exclusions, and assessment style
- Do not write about JSON, schemas, output formatting, validation, API structure, or prompt instructions unless the requested lesson is explicitly about those topics
- difficulty must be one of: intro, intermediate, advanced
- sourceRefs should list filenames only when the lesson materially uses user-provided sources; otherwise return []
- Do not include navigation links, breadcrumbs, or file metadata in bodyMarkdown`,
  },
};

export async function ensurePromptSettings(plugin: DelvePlugin): Promise<void> {
  await ensureFolder(plugin, VAULT_PATHS.SETTINGS);
  await ensureFolder(plugin, VAULT_PATHS.PROMPTS);

  const runtimeConfig = await ensureRuntimeConfig(plugin);
  for (const [name, definition] of Object.entries(PROMPTS) as Array<[PromptName, PromptDefinition]>) {
    const legacyOverride = plugin.settings.promptOverrides[name];
    const notePath = getPromptPath(name);
    const exists = await plugin.app.vault.adapter.exists(notePath);
    if (exists) continue;

    const content = buildPromptNote(definition, legacyOverride?.trim() || definition.template, runtimeConfig.defaultModel);
    await plugin.app.vault.adapter.write(notePath, content);
  }
}

export async function loadPrompt(
  plugin: DelvePlugin,
  name: PromptName
): Promise<PromptConfig> {
  await ensurePromptSettings(plugin);

  const runtimeConfig = await loadRuntimeConfig(plugin);
  const notePath = getPromptPath(name);
  const raw = await plugin.app.vault.adapter.read(notePath);
  const parsed = parseNote(raw);
  const definition = PROMPTS[name];

  return {
    name,
    model: normalizeScalar(parsed.frontmatter.model) || runtimeConfig.defaultModel || definition.defaultModel,
    template: parsed.body.trim() || definition.template,
    path: notePath,
  };
}

export async function loadRuntimeConfig(plugin: DelvePlugin): Promise<RuntimeConfig> {
  await ensureRuntimeConfig(plugin);
  return loadRuntimeConfigWithoutEnsure(plugin);
}

export function getPromptPath(name: PromptName): string {
  return `${VAULT_PATHS.PROMPTS}/${PROMPTS[name].filename}`;
}

export function getSettingsPaths(): { config: string; prompts: string } {
  return {
    config: CONFIG_NOTE_PATH,
    prompts: VAULT_PATHS.PROMPTS,
  };
}

async function ensureRuntimeConfig(plugin: DelvePlugin): Promise<RuntimeConfig> {
  const exists = await plugin.app.vault.adapter.exists(CONFIG_NOTE_PATH);
  if (!exists) {
    const content = buildConfigNote(plugin.settings.defaultModel || DEFAULT_MODEL);
    await plugin.app.vault.adapter.write(CONFIG_NOTE_PATH, content);
  }
  return loadRuntimeConfigWithoutEnsure(plugin);
}

async function loadRuntimeConfigWithoutEnsure(plugin: DelvePlugin): Promise<RuntimeConfig> {
  const raw = await plugin.app.vault.adapter.read(CONFIG_NOTE_PATH);
  const parsed = parseNote(raw);
  return {
    defaultModel: normalizeScalar(parsed.frontmatter.defaultModel) || plugin.settings.defaultModel || DEFAULT_MODEL,
  };
}

async function ensureFolder(plugin: DelvePlugin, path: string): Promise<void> {
  const exists = await plugin.app.vault.adapter.exists(path);
  if (!exists) {
    await plugin.app.vault.adapter.mkdir?.(path);
  }
}

function buildConfigNote(defaultModel: string): string {
  return [
    '---',
    `defaultModel: ${escapeYamlValue(defaultModel)}`,
    '---',
    '',
    '# Delve Config',
    '',
    'This note stores editable Delve configuration that should live in the vault rather than plugin data.',
    '',
    '- `defaultModel`: fallback OpenRouter model used when a prompt note does not set its own `model` property.',
    '',
    'The API key stays in the Delve plugin settings panel and is not written into the vault.',
    '',
  ].join('\n');
}

function buildPromptNote(definition: PromptDefinition, template: string, model: string): string {
  return [
    '---',
    `title: ${escapeYamlValue(definition.title)}`,
    `description: ${escapeYamlValue(definition.description)}`,
    `model: ${escapeYamlValue(model || definition.defaultModel)}`,
    '---',
    '',
    template.trim(),
    '',
  ].join('\n');
}

function parseNote(content: string): { frontmatter: Record<string, string>; body: string } {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: normalized };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter: {}, body: normalized };
  }

  const frontmatterBlock = normalized.slice(4, end);
  const body = normalized.slice(end + 5).trim();
  const frontmatter = frontmatterBlock
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const separator = line.indexOf(':');
      if (separator === -1) return acc;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      if (key) acc[key] = value;
      return acc;
    }, {});

  return { frontmatter, body };
}

function normalizeScalar(value: string | undefined): string {
  return value?.trim() ?? '';
}

function escapeYamlValue(value: string): string {
  return JSON.stringify(value);
}
