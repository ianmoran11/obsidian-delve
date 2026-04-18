import type { Vault } from 'obsidian';
import { VAULT_PATHS } from '../constants';

export type SourceMode = 'knowledge-only' | 'augmented' | 'grounded';

export interface SourceContext {
  mode: SourceMode;
  /** Concatenated Markdown source text (empty in knowledge-only mode) */
  text: string;
  fileCount: number;
}

const GROUNDED_THRESHOLD = 5_000;

export class ContextService {
  constructor(private vault: Vault) {}

  async buildContext(): Promise<SourceContext> {
    const files = this.vault
      .getFiles()
      .filter(
        f =>
          f.path.startsWith(VAULT_PATHS.MARKDOWN_SOURCES + '/') &&
          f.extension === 'md',
      );

    if (files.length === 0) {
      return { mode: 'knowledge-only', text: '', fileCount: 0 };
    }

    const chunks: string[] = [];
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      chunks.push(`=== ${file.basename} ===\n${content}`);
    }

    const text = chunks.join('\n\n');
    const mode: SourceMode = text.length >= GROUNDED_THRESHOLD ? 'grounded' : 'augmented';
    return { mode, text, fileCount: files.length };
  }
}
