import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type DelvePlugin from '../main';

export interface DelveSettings {
  openRouterApiKey: string;
  defaultModel: string;
  promptOverrides: Record<string, string>;
}

export const DEFAULT_SETTINGS: DelveSettings = {
  openRouterApiKey: '',
  defaultModel: 'anthropic/claude-3-5-sonnet',
  promptOverrides: {},
};

export class DelveSettingsTab extends PluginSettingTab {
  plugin: DelvePlugin;

  constructor(app: App, plugin: DelvePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Delve' });

    new Setting(containerEl)
      .setName('OpenRouter API key')
      .setDesc('Your OpenRouter API key. Get one at openrouter.ai.')
      .addText(text =>
        text
          .setPlaceholder('sk-or-...')
          .setValue(this.plugin.settings.openRouterApiKey)
          .onChange(async value => {
            this.plugin.settings.openRouterApiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Model')
      .setDesc('OpenRouter model ID (e.g. anthropic/claude-3-5-sonnet, google/gemini-flash-1.5).')
      .addText(text =>
        text
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async value => {
            this.plugin.settings.defaultModel = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Verify connection')
      .setDesc('Check that your API key is valid and the model is reachable.')
      .addButton(btn =>
        btn
          .setButtonText('Test connection')
          .onClick(async () => {
            if (!this.plugin.settings.openRouterApiKey) {
              new Notice('Enter an API key first.');
              return;
            }
            btn.setButtonText('Testing…').setDisabled(true);
            try {
              await this.plugin.llmService.listModels();
              new Notice(`✓ Connected — model: ${this.plugin.settings.defaultModel}`);
            } catch (e) {
              new Notice(`✗ Connection failed: ${(e as Error).message}`);
            } finally {
              btn.setButtonText('Test connection').setDisabled(false);
            }
          })
      );

    containerEl.createEl('h3', { text: 'Prompt overrides' });
    containerEl.createEl('p', {
      text: 'Override any stage prompt. Leave blank to use the built-in default.',
      cls: 'setting-item-description',
    });

    const promptNames: Array<{ key: string; label: string }> = [
      { key: 'stage0-taxonomy', label: 'Stage 0: Initial taxonomy' },
      { key: 'stage0-disaggregate', label: 'Stage 0: Split node' },
      { key: 'stage0-expand', label: 'Stage 0: Expand node' },
      { key: 'stage0-suggest-related', label: 'Stage 0: Suggest related topics' },
      { key: 'stage1-concepts', label: 'Stage 1: Concept extraction' },
      { key: 'stage3-curriculum', label: 'Stage 3: Curriculum design' },
      { key: 'stage4-lesson', label: 'Stage 4: Lesson generation' },
    ];

    for (const { key, label } of promptNames) {
      new Setting(containerEl)
        .setName(label)
        .addTextArea(area => {
          area
            .setPlaceholder('Leave blank to use default…')
            .setValue(this.plugin.settings.promptOverrides[key] ?? '')
            .onChange(async value => {
              if (value.trim()) {
                this.plugin.settings.promptOverrides[key] = value;
              } else {
                delete this.plugin.settings.promptOverrides[key];
              }
              await this.plugin.saveSettings();
            });
          area.inputEl.rows = 6;
          area.inputEl.style.width = '100%';
        });
    }
  }
}
