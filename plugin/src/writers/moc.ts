// Stage 4 — Map of Content (MOC) writer
// TODO: generate per-module MOC notes linking to all lessons within that module
import type { ModuleSpec } from '../interfaces';

export async function writeMoc(
  _module: ModuleSpec,
  _outputDir: string,
): Promise<void> {
  throw new Error('MOC writer not yet implemented');
}
