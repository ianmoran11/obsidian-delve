import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensurePromptSettings, loadPrompt, loadRuntimeConfig } from '../src/prompts';
import { makeMockPlugin } from './helpers';

describe('prompts', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;
  const files = new Map<string, string>();

  beforeEach(() => {
    plugin = makeMockPlugin();
    files.clear();

    plugin.app.vault.adapter.exists = vi.fn(async (path: string) => files.has(path));
    plugin.app.vault.adapter.mkdir = vi.fn(async (path: string) => {
      files.set(path, files.get(path) ?? '');
    });
    plugin.app.vault.adapter.write = vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    });
    plugin.app.vault.adapter.read = vi.fn(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`Missing file: ${path}`);
      return content;
    });
  });

  it('creates settings notes and loads prompt config without recursion', async () => {
    await ensurePromptSettings(plugin as never);

    const runtime = await loadRuntimeConfig(plugin as never);
    const prompt = await loadPrompt(plugin as never, 'stage1-concepts');

    expect(runtime.defaultModel).toBe('anthropic/claude-3-5-sonnet');
    expect(prompt.model).toBe('anthropic/claude-3-5-sonnet');
    expect(prompt.path).toBe('Delve Settings/Prompts/Stage 1 - Concept Extraction.md');
    expect(prompt.template).toContain('Extract 15 to 25 foundational concepts');
  });
});
