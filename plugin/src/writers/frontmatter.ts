export function buildFrontmatter(data: Record<string, string | string[] | boolean>): string {
  const lines = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${escapeYaml(item)}`);
      }
      continue;
    }

    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value ? 'true' : 'false'}`);
      continue;
    }

    lines.push(`${key}: ${escapeYaml(value)}`);
  }

  lines.push('---');
  return lines.join('\n');
}

function escapeYaml(value: string): string {
  if (value === '') return '""';
  if (/^[a-zA-Z0-9_.\/:-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
