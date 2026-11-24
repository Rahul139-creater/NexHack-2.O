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

export const submitResultSchema = z.object({
  attempt: z.number().int().min(1).default(1),
  body: z.union([z.string(), z.record(z.any())]),
  citations: z.array(z.object({
    recordId: z.string().min(1),
    rev: z.number().int().min(1)
  })).default([]),
  fencingToken: z.number().int(),
  baseRevisions: z.union([
    z.array(z.object({
      recordId: z.string().min(1),
      rev: z.number().int().min(1)
    })),
    z.record(z.number().int().min(1))
  ]).optional()
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  briefRef: z.object({
    recordId: z.string().min(1),
    rev: z.number().int().min(1)
  }),
  dependsOn: z.array(z.object({
    recordId: z.string().min(1),
    rev: z.number().int().min(1)
  })).optional()
});

