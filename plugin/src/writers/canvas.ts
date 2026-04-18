// Stage 4 — Obsidian Canvas writer
// TODO: generate a .canvas JSON file visualising the course structure and prerequisite graph
import type { Curriculum } from '../interfaces';

export async function writeCanvas(
  _curriculum: Curriculum,
  _outputDir: string,
): Promise<void> {
  throw new Error('Canvas writer not yet implemented');
}
