import { z } from 'zod';

export const createRecordSchema = z.object({
  type: z.enum(['brief', 'decision', 'document']),
  content: z.string().min(1, 'Content cannot be empty'),
  readers: z.array(z.string()).optional(),
  writers: z.array(z.string()).optional(),
  recordId: z.string().optional()
});

export const updateRecordSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  baseRevision: z.number().int().min(1, 'baseRevision must be an integer >= 1')
});

export const recordIdParamSchema = z.object({
  id: z.string().min(1)
});

export const revisionParamSchema = z.object({
  id: z.string().min(1),
  rev: z.string().regex(/^\d+$/, 'Revision must be an integer')
});
