import type { ZodIssue } from 'zod';
import { CompletionRequest as CompletionRequestSchema } from './types';
import type { CompletionRequest } from './types';

export type CompletionRequestValidationResult =
  | { success: true; data: CompletionRequest }
  | { success: false; issues: ZodIssue[] };

export function validateCompletionRequest(body: unknown): CompletionRequestValidationResult {
  const parsed = CompletionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues,
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}
