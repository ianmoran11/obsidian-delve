import { App, Modal, Setting } from 'obsidian';
import type { LockData } from '../interfaces';

const STAGE_NAMES: Record<number, string> = {
  0: 'Topic Explorer',
  1: 'Concept Extraction',
  2: 'Diagnostic',
  3: 'Curriculum Design',
  4: 'Content Generation',
};

export class ResumeModal extends Modal {
  private resolve!: (choice: 'resume' | 'restart') => void;

  constructor(app: App, private lock: LockData) {
    super(app);
  }

  waitForChoice(): Promise<'resume' | 'restart'> {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Resume previous session?' });
    contentEl.createEl('p', {
      text: `A session was interrupted at Stage ${this.lock.stage} — ${STAGE_NAMES[this.lock.stage] ?? 'Unknown'}.`,
    });
    contentEl.createEl('p', {
      text: `Course: ${this.lock.courseId}`,
      cls: 'setting-item-description',
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Resume')
          .setCta()
          .onClick(() => {
            this.close();
            this.resolve('resume');
          })
      )
      .addButton(btn =>
        btn.setButtonText('Start over').onClick(() => {
          this.close();
          this.resolve('restart');
        })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    // Resolve with 'restart' if the user dismissed without choosing
    this.resolve?.('restart');
  }
}
