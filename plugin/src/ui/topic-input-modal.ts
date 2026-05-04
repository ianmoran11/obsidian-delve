import { App, Modal, Notice, Setting } from 'obsidian';
import type DelvePlugin from '../../main';
import { runStage0 } from '../stages/stage0-topic';

export class TopicInputModal extends Modal {
  private title = '';
  private description = '';
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
      text: 'Give Delve a course title and any goals, audience, constraints, or style notes you want it to honor.',
      cls: 'delve-subtitle',
    });

    new Setting(contentEl)
      .setName('Course title')
      .setDesc('e.g. “Machine Learning”, “Linear Algebra”, “Kubernetes”')
      .addText(text => {
        text
          .setPlaceholder('Enter your course title…')
          .onChange(v => {
            this.title = v.trim();
          });
        text.inputEl.addClass('delve-topic-input__field');
        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') void this.submit();
        });
        setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName('Detailed request')
      .setDesc('Optional: goals, learner level, source preferences, format, assessment style, exclusions, or constraints.')
      .addTextArea(text => {
        text
          .setPlaceholder('Describe the course you want Delve to build…')
          .onChange(v => {
            this.description = v.trim();
          });
        text.inputEl.addClass('delve-topic-input__description');
      });

    const btnRow = contentEl.createDiv('delve-topic-input__actions');
    const startBtn = btnRow.createEl('button', {
      text: 'Build Course',
      cls: 'mod-cta delve-btn-primary',
    });
    startBtn.addEventListener('click', () => void this.submit());
  }

  private async submit(): Promise<void> {
    if (!this.title) {
      new Notice('Please enter a course title.');
      return;
    }
    if (!this.plugin.settings.openRouterApiKey) {
      new Notice('Add your OpenRouter API key in Delve settings first.');
      return;
    }
    this.close();
    await runStage0(this.plugin, {
      title: this.title,
      description: this.description,
    }, this.courseId);
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
