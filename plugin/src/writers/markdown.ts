import type DelvePlugin from '../../main';

export async function writeMarkdownFile(
  plugin: DelvePlugin,
  path: string,
  content: string
): Promise<void> {
  await plugin.app.vault.adapter.write(path, content.trimEnd() + '\n');
}
