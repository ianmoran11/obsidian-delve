import type DelvePlugin from '../../main';
import type { ModuleSpec } from '../interfaces';
import { writeMarkdownFile } from './markdown';

export async function writeModuleMoc(
  plugin: DelvePlugin,
  path: string,
  module: ModuleSpec,
  courseIndexLink: string,
  lessonLinks: string[]
): Promise<void> {
  const content = [
    `# ${module.title}`,
    '',
    `Back to ${courseIndexLink}`,
    '',
    module.description,
    '',
    '## Lessons',
    '',
    ...lessonLinks.map(link => `- ${link}`),
  ].join('\n');

  await writeMarkdownFile(plugin, path, content);
}
