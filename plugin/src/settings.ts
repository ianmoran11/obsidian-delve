import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type DelvePlugin from '../main';
import { ensurePromptSettings, getSettingsPaths, loadRuntimeConfig } from './prompts';

export interface DelveSettings {
  openRouterApiKey: string;
  defaultModel: string;
  promptOverrides: Record<string, string>;
}

export const DEFAULT_SETTINGS: DelveSettings = {
  openRouterApiKey: '',
  defaultModel: 'google/gemini-3-flash-preview',
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
      .setName('Vault settings folder')
      .setDesc(`Prompts and non-secret Delve config now live in "${getSettingsPaths().config}" and "${getSettingsPaths().prompts}".`)
      .addButton(btn =>
        btn
          .setButtonText('Create / refresh notes')
          .onClick(async () => {
            btn.setButtonText('Syncing…').setDisabled(true);
            try {
              await ensurePromptSettings(this.plugin);
              const runtimeConfig = await loadRuntimeConfig(this.plugin);
              new Notice(`Delve settings notes are ready. Default model: ${runtimeConfig.defaultModel}`);
            } catch (e) {
              new Notice(`Could not sync settings notes: ${(e as Error).message}`);
            } finally {
              btn.setButtonText('Create / refresh notes').setDisabled(false);
            }
          })
      );

    new Setting(containerEl)
      .setName('Verify connection')
      .setDesc('Check that your API key is valid. Prompt-specific models are configured in the vault settings notes.')
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
              const runtimeConfig = await loadRuntimeConfig(this.plugin);
              new Notice(`✓ Connected — default model in vault config: ${runtimeConfig.defaultModel}`);
            } catch (e) {
              new Notice(`✗ Connection failed: ${(e as Error).message}`);
            } finally {
              btn.setButtonText('Test connection').setDisabled(false);
            }
          })
      );

    containerEl.createEl('h3', { text: 'Editable Prompt Notes' });
    containerEl.createEl('p', {
      text: 'Edit prompt bodies and per-stage models directly in the notes inside the Delve Settings folder. Each prompt note stores its model in YAML properties.',
      cls: 'setting-item-description',
    });
  }
}
