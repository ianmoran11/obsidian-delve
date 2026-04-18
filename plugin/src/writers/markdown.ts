// Stage 4 — Markdown file writer
// TODO: write lesson .md files to the vault with collision handling
import type { Vault } from 'obsidian';

export async function writeMarkdownFile(
  _vault: Vault,
  _path: string,
  _content: string,
): Promise<void> {
  throw new Error('Markdown writer not yet implemented');
}
