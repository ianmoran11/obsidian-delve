import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runStage1 } from '../src/stages/stage1-concepts';
import { makeMockPlugin } from './helpers';

describe('stage1: runStage1', () => {
  let plugin: ReturnType<typeof makeMockPlugin>;

  beforeEach(() => {
    plugin = makeMockPlugin();
  });

  it('fails fast with a clear message when the API key is missing', async () => {
    plugin.settings.openRouterApiKey = '';

    await expect(runStage1(plugin as never, 'course-1')).rejects.toThrow(
      'Add your OpenRouter API key in Delve settings before extracting concepts.'
    );
  });

  it('does not write a pending cache when credentials are missing', async () => {
    plugin.settings.openRouterApiKey = '';
    const writeStage = vi.fn();
    plugin.cacheService.writeStage = writeStage;

    await expect(runStage1(plugin as never, 'course-1')).rejects.toThrow();

    expect(writeStage).not.toHaveBeenCalled();
  });
});
