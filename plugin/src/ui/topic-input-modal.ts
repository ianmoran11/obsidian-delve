import { App, Modal, Setting } from 'obsidian';

export class TopicInputModal extends Modal {
  private topic = '';
  private readonly onSubmit: (topic: string) => void;

  constructor(app: App, onSubmit: (topic: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('delve-topic-modal');

    contentEl.createEl('h2', { text: 'Start a new course' });
    contentEl.createEl('p', {
      text: 'Enter a broad topic. Delve will generate a taxonomy so you can choose exactly what to cover.',
      cls: 'setting-item-description',
    });

    new Setting(contentEl).setName('Topic').addText(text => {
      text
        .setPlaceholder('e.g. machine learning, Kubernetes, linear algebra')
        .onChange(v => {
          this.topic = v;
        });
      text.inputEl.style.width = '100%';
      text.inputEl.setAttribute('autocorrect', 'off');
      text.inputEl.setAttribute('autocapitalize', 'off');
      text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') this.submit();
      });
      // Focus after the modal animation settles
      setTimeout(() => text.inputEl.focus(), 60);
    });

    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('Generate taxonomy')
        .setCta()
        .onClick(() => this.submit()),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private submit(): void {
    const t = this.topic.trim();
    if (!t) return;
    this.close();
    this.onSubmit(t);
  }
}
