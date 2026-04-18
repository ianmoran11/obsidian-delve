import { z } from 'zod';
import type { TaxonomyNode } from '../interfaces';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Validation failed: ${result.error.issues.map(i => i.message).join('; ')}`,
      result.error.issues,
    );
  }
  return result.data;
}

export async function validateWithRepair<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  repair: () => Promise<unknown>,
): Promise<T> {
  const first = schema.safeParse(data);
  if (first.success) return first.data;
  const repaired = await repair();
  return validate(schema, repaired);
}

// ─── Zod schemas ──────────────────────────────────────────────────────────

export const TaxonomyNodeSchema: z.ZodType<TaxonomyNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    children: z.array(TaxonomyNodeSchema).optional(),
  }),
);

export const TaxonomyResponseSchema = z.object({
  taxonomy: z.array(TaxonomyNodeSchema).min(1),
});

export const ConceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  sourceRefs: z.array(z.string()).optional(),
});

export const ConceptListSchema = z.object({
  concepts: z.array(ConceptSchema).min(1),
});
