import { App, PluginSettingTab, Setting } from 'obsidian';
import type { DelvePlugin } from './plugin';

export interface DelveSettings {
  openrouterApiKey: string;
  defaultModel: string;
  promptOverrides: {
    stage0?: string;
    stage1?: string;
    stage3?: string;
    stage4?: string;
  };
}

export const DEFAULT_SETTINGS: DelveSettings = {
  openrouterApiKey: '',
  defaultModel: 'anthropic/claude-3-5-haiku',
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
    containerEl.createEl('h2', { text: 'Delve Settings' });

    new Setting(containerEl)
      .setName('OpenRouter API key')
      .setDesc('Your OpenRouter API key. Get one at openrouter.ai.')
      .addText(text =>
        text
          .setPlaceholder('sk-or-...')
          .setValue(this.plugin.settings.openrouterApiKey)
          .onChange(async value => {
            this.plugin.settings.openrouterApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Default model')
      .setDesc('OpenRouter model ID used for all stages unless overridden.')
      .addText(text =>
        text
          .setPlaceholder('anthropic/claude-3-5-haiku')
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async value => {
            this.plugin.settings.defaultModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl('h3', { text: 'Prompt overrides' });
    containerEl.createEl('p', {
      text: 'Leave blank to use built-in prompts. Use {{topic}}, {{sourceContext}}, etc. as template variables.',
      cls: 'setting-item-description',
    });

    const stagePrompts: Array<{
      key: keyof DelveSettings['promptOverrides'];
      label: string;
      placeholder: string;
    }> = [
      { key: 'stage0', label: 'Stage 0 — Taxonomy', placeholder: 'Override the taxonomy generation prompt…' },
      { key: 'stage1', label: 'Stage 1 — Concepts', placeholder: 'Override the concept extraction prompt…' },
      { key: 'stage3', label: 'Stage 3 — Curriculum', placeholder: 'Override the curriculum design prompt…' },
      { key: 'stage4', label: 'Stage 4 — Lesson', placeholder: 'Override the lesson generation prompt…' },
    ];

    for (const { key, label, placeholder } of stagePrompts) {
      new Setting(containerEl).setName(label).addTextArea(text => {
        text
          .setPlaceholder(placeholder)
          .setValue(this.plugin.settings.promptOverrides[key] ?? '')
          .onChange(async value => {
            if (value.trim()) {
              this.plugin.settings.promptOverrides[key] = value;
            } else {
              delete this.plugin.settings.promptOverrides[key];
            }
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.style.width = '100%';
      });
    }
  }
}
