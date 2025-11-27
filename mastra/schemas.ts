import { z } from 'zod';

export const ProfileSchema = z.object({
  userId: z.string().uuid().optional(),
}).passthrough().nullable();

export const AgentRuntimeConfigSchema = z.object({
  modelId: z.string(),
  baseURL: z.string().url().optional(),
  temperature: z.number().min(0).max(1),
});

export const AgentModelConfigSchema = z.object({
  modelId: z.string().optional(),
  baseURL: z.string().url().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const AgentRunOptionsSchema = z.object({
  input: z.string(),
  context: z.record(z.unknown()).optional(),
});

export const UnifiedInboxAgentConfigSchema = AgentModelConfigSchema.extend({
  requestId: z.string().optional(),
  runId: z.string().optional(),
  maxOutputItems: z.number().int().min(1).max(10).optional(),
});

export const SearchResultSchema = z.object({
  content: z.string(),
  role: z.string(),
  sessionId: z.string().uuid(),
  sessionCreatedAt: z.string(),
});

export const SessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.unknown()).nullable(),
});

export const PartSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.string().nullable(),
  description: z.string().nullable(),
});

export const RelationshipSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  source_part_id: z.string().uuid(),
  target_part_id: z.string().uuid(),
  type: z.string(),
  description: z.string().nullable(),
  strength: z.number().nullable(),
});

export const InsightSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string(),
  status: z.string(),
  content: z.record(z.unknown()),
  rating: z.number().nullable(),
  feedback: z.string().nullable(),
  revealed_at: z.string().nullable(),
  actioned_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
