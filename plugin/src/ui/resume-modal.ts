import { App, Modal, Setting } from 'obsidian';
import type { LockData } from '../services/lock';

export type ResumeChoice = 'resume' | 'restart' | 'cancel';

const STAGE_LABELS: Record<number, string> = {
  0: 'Topic Explorer (Stage 0)',
  1: 'Concept Extraction (Stage 1)',
  2: 'Diagnostic (Stage 2)',
  3: 'Curriculum Design (Stage 3)',
  4: 'Content Generation (Stage 4)',
};

export class ResumeModal extends Modal {
  private readonly lock: LockData;
  private readonly onChoice: (choice: ResumeChoice) => void;

  constructor(app: App, lock: LockData, onChoice: (choice: ResumeChoice) => void) {
    super(app);
    this.lock = lock;
    this.onChoice = onChoice;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Resume previous session?' });
    contentEl.createEl('p', {
      text: `A previous generation was interrupted at ${STAGE_LABELS[this.lock.stage] ?? `Stage ${this.lock.stage}`}. What would you like to do?`,
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Resume')
          .setCta()
          .onClick(() => this.choose('resume')),
      )
      .addButton(btn =>
        btn.setButtonText('Start new course').onClick(() => this.choose('restart')),
      )
      .addButton(btn =>
        btn.setButtonText('Dismiss').onClick(() => this.choose('cancel')),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private choose(choice: ResumeChoice): void {
    this.close();
    this.onChoice(choice);
  }
}
