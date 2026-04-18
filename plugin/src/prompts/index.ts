// @ts-ignore — .md files are loaded as text strings by esbuild (loader: { '.md': 'text' })
import stage0Md from './stage0-taxonomy.md';
// @ts-ignore
import stage1Md from './stage1-concepts.md';
// @ts-ignore
import stage3Md from './stage3-curriculum.md';
// @ts-ignore
import stage4Md from './stage4-lesson.md';

const BUILT_IN: Record<string, string> = {
  'stage0-taxonomy': stage0Md as string,
  'stage1-concepts': stage1Md as string,
  'stage3-curriculum': stage3Md as string,
  'stage4-lesson': stage4Md as string,
};

export type PromptKey = keyof typeof BUILT_IN;

/** Returns the user override if provided, otherwise the built-in prompt template. */
export function loadPrompt(name: PromptKey, override?: string): string {
  if (override?.trim()) return override;
  const prompt = BUILT_IN[name];
  if (!prompt) throw new Error(`Unknown prompt key: ${name}`);
  return prompt;
}
