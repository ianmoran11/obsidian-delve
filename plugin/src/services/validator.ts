import { z } from 'zod';
import type { LlmService } from './openrouter';
import type { Curriculum, LessonSpec, ModuleSpec, TaxonomyNode } from '../interfaces';

export async function validateAndRepair<T>(
  data: unknown,
  schema: z.ZodType<T>,
  llm: LlmService,
  repairHint: string
): Promise<T> {
  const first = schema.safeParse(data);
  if (first.success) return first.data;

  const issues = first.error.issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ');

  const repairPrompt = [
    'The following JSON failed schema validation:',
    '',
    JSON.stringify(data, null, 2),
    '',
    `Validation errors: ${issues}`,
    '',
    repairHint,
    '',
    'Return ONLY the corrected JSON, no explanation.',
  ].join('\n');

  const repaired = await llm.callJson<T>(repairPrompt, {});
  return schema.parse(repaired);
}

export const TaxonomyNodeSchema: z.ZodType<TaxonomyNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    children: z.array(TaxonomyNodeSchema).optional(),
  })
);

export const Stage0ResponseSchema = z.object({
  taxonomy: z.array(TaxonomyNodeSchema).min(1),
});

export const DisaggregateResponseSchema = z.object({
  nodes: z.array(TaxonomyNodeSchema).min(2).max(6),
});

export const ExpandResponseSchema = z.object({
  children: z.array(TaxonomyNodeSchema).min(2).max(6),
});

export const SuggestRelatedResponseSchema = z.object({
  topics: z.array(TaxonomyNodeSchema).min(1).max(5),
});

export const ConceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  sourceRefs: z.array(z.string()).optional(),
});

export const Stage1ResponseSchema = z.object({
  concepts: z.array(ConceptSchema).min(1),
});

export const LessonSpecSchema: z.ZodType<LessonSpec> = z.object({
  lessonId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  prerequisites: z.array(z.string()),
});

export const ModuleSpecSchema: z.ZodType<ModuleSpec> = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  lessons: z.array(LessonSpecSchema).min(1),
});

export const CurriculumSchema: z.ZodType<Curriculum> = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  modules: z.array(ModuleSpecSchema).min(1),
});

export const Stage3ResponseSchema = z.object({
  curriculum: CurriculumSchema,
});
