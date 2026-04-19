import type { Vault } from 'obsidian';
import { VAULT_PATHS } from '../constants';

export type SourceMode = 'grounded' | 'augmented' | 'knowledge-only';

export interface ContextPayload {
  mode: SourceMode;
  content: string;
  fileCount: number;
}

export class ContextService {
  constructor(private vault: Vault) {}

  async build(): Promise<ContextPayload> {
    const folder = this.vault.getAbstractFileByPath(VAULT_PATHS.MARKDOWN_SOURCES);
    if (!folder) {
      return { mode: 'knowledge-only', content: '', fileCount: 0 };
    }

    const files = this.vault
      .getFiles()
      .filter(
        f =>
          f.path.startsWith(VAULT_PATHS.MARKDOWN_SOURCES + '/') &&
          f.extension === 'md'
      );

    if (files.length === 0) {
      return { mode: 'knowledge-only', content: '', fileCount: 0 };
    }

    const parts: string[] = [];
    for (const file of files) {
      const text = await this.vault.read(file);
      parts.push(`--- FILE: ${file.name} ---\n${text}`);
    }

    return {
      // Current UX does not let the learner force strict source-only grounding,
      // so source-backed runs are treated as augmented by default.
      mode: 'augmented',
      content: parts.join('\n\n'),
      fileCount: files.length,
    };
  }
}
