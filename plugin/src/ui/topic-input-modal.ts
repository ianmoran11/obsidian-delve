import { App, Modal, Notice, Setting } from 'obsidian';
import type DelvePlugin from '../../main';
import { runStage0 } from '../stages/stage0-topic';

export class TopicInputModal extends Modal {
  private topic = '';
  private readonly courseId: string;

  constructor(app: App, private plugin: DelvePlugin) {
    super(app);
    this.courseId = generateCourseId();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('delve-topic-input');

    contentEl.createEl('h2', { text: 'Start a New Course' });
    contentEl.createEl('p', {
      text: 'Enter a broad topic and Delve will build a personalised course for you.',
      cls: 'delve-subtitle',
    });

    new Setting(contentEl)
      .setName('Topic')
      .setDesc('e.g. “Machine Learning”, “Linear Algebra”, “Kubernetes”')
      .addText(text => {
        text
          .setPlaceholder('Enter your topic…')
          .onChange(v => {
            this.topic = v.trim();
          });
        text.inputEl.addClass('delve-topic-input__field');
        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') void this.submit();
        });
        setTimeout(() => text.inputEl.focus(), 50);
      });

    const btnRow = contentEl.createDiv('delve-topic-input__actions');
    const startBtn = btnRow.createEl('button', {
      text: 'Build Course',
      cls: 'mod-cta delve-btn-primary',
    });
    startBtn.addEventListener('click', () => void this.submit());
  }

  private async submit(): Promise<void> {
    if (!this.topic) {
      new Notice('Please enter a topic.');
      return;
    }
    if (!this.plugin.settings.openRouterApiKey) {
      new Notice('Add your OpenRouter API key in Delve settings first.');
      return;
    }
    this.close();
    await runStage0(this.plugin, this.topic, this.courseId);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function generateCourseId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}
