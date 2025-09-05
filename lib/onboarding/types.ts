import { z } from 'zod';

// Stage enum
export const OnboardingStage = z.enum(['stage1', 'stage2', 'stage3', 'complete']);
export type OnboardingStage = z.infer<typeof OnboardingStage>;

// Question types
export const QuestionType = z.enum(['likert5', 'single_choice', 'multi_select', 'free_text']);
export type QuestionType = z.infer<typeof QuestionType>;

// Theme constants for scoring and selection
export const THEMES = [
  'achievement',
  'perfectionism', 
  'self_criticism',
  'relational',
  'conflict_avoidance',
  'caretaking',
  'safety',
  'control',
  'anxiety',
  'avoidance',
  'overwhelm',
  'independence',
  'restlessness',
  'shame'
] as const;

export type Theme = (typeof THEMES)[number];
export type ThemeScores = Record<Theme, number>;

// Option for single/multi choice questions
export const QuestionOption = z.object({
  value: z.string(),
  label: z.string(),
});
export type QuestionOption = z.infer<typeof QuestionOption>;

// Question schema
export const OnboardingQuestion = z.object({
  id: z.string(), // e.g., 'S1_Q1', 'S2_Q5', 'S3_Q2'
  stage: z.number().int().min(1).max(3),
  type: QuestionType,
  prompt: z.string(),
  helper: z.string().nullable(),
  options: z.array(QuestionOption),
  active: z.boolean().default(true),
  locale: z.string().default('en'),
  order_hint: z.number().int().default(0),
  theme_weights: z.record(z.number()).default({}), // Theme -> weight for Stage 2 selection
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});
export type OnboardingQuestion = z.infer<typeof OnboardingQuestion>;

// Response schemas by question type
export const LikertResponse = z.object({
  type: z.literal('likert5'),
  value: z.number().int().min(1).max(5),
});

export const SingleChoiceResponse = z.object({
  type: z.literal('single_choice'),
  value: z.string(),
});

export const MultiSelectResponse = z.object({
  type: z.literal('multi_select'),
  values: z.array(z.string()).min(0),
});

export const FreeTextResponse = z.object({
  type: z.literal('free_text'),
  text: z.string().max(500), // Reasonable length limit
});

export const QuestionResponse = z.discriminatedUnion('type', [
  LikertResponse,
  SingleChoiceResponse,
  MultiSelectResponse,
  FreeTextResponse,
]);
export type QuestionResponse = z.infer<typeof QuestionResponse>;

// Individual response record
export const OnboardingResponseRecord = z.object({
  id: z.number().optional(),
  user_id: z.string().uuid(),
  question_id: z.string(),
  stage: z.number().int().min(1).max(3),
  response: QuestionResponse,
  created_at: z.string().datetime().optional(),
});
export type OnboardingResponseRecord = z.infer<typeof OnboardingResponseRecord>;

// User onboarding state
export const UserOnboardingState = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  feature_version: z.string().default('v1'),
  stage: OnboardingStage,
  status: z.enum(['in_progress', 'completed']).default('in_progress'),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  last_saved_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  version: z.number().int().default(0),
  
  // Derived fields
  stage1_scores: z.record(z.number()).default({}), // ThemeScores
  stage2_selected_questions: z.array(z.string()).default([]),
  answers_snapshot: z.record(QuestionResponse).default({}), // questionId -> response
});
export type UserOnboardingState = z.infer<typeof UserOnboardingState>;

// API request/response schemas
export const ProgressUpdateRequest = z.object({
  stage: OnboardingStage,
  questionId: z.string(),
  response: QuestionResponse,
  version: z.number().int().nonnegative(),
});
export type ProgressUpdateRequest = z.infer<typeof ProgressUpdateRequest>;

export const ProgressUpdateResponse = z.object({
  ok: z.boolean(),
  state: UserOnboardingState,
  next: z.object({
    stage: OnboardingStage.optional(),
    questions: z.array(OnboardingQuestion).optional(),
  }).optional(),
});
export type ProgressUpdateResponse = z.infer<typeof ProgressUpdateResponse>;

export const QuestionsResponse = z.object({
  questions: z.array(OnboardingQuestion),
  stage: z.number().int().min(1).max(3),
  selected_for_user: z.boolean().default(false), // true for Stage 2 adaptive questions
});
export type QuestionsResponse = z.infer<typeof QuestionsResponse>;

export const CompletionRequest = z.object({
  version: z.number().int().nonnegative(),
});
export type CompletionRequest = z.infer<typeof CompletionRequest>;

export const CompletionResponse = z.object({
  ok: z.boolean(),
  redirect: z.string().url(),
  completed_at: z.string().datetime(),
});
export type CompletionResponse = z.infer<typeof CompletionResponse>;

// Stage 2 selection metadata
export const Stage2SelectionResult = z.object({
  ids: z.array(z.string()),
  rationale: z.object({
    top_themes: z.array(z.string()),
    theme_coverage: z.record(z.number()),
    selection_method: z.string(),
  }),
});
export type Stage2SelectionResult = z.infer<typeof Stage2SelectionResult>;

// Analytics event schemas
export const OnboardingAnalyticsEvent = z.object({
  event: z.string(),
  user_id: z.string().uuid(),
  properties: z.record(z.any()).default({}),
  timestamp: z.string().datetime().optional(),
});
export type OnboardingAnalyticsEvent = z.infer<typeof OnboardingAnalyticsEvent>;

// Helper type for stage 1 question IDs
export type Stage1QuestionId = 'S1_Q1' | 'S1_Q2' | 'S1_Q3' | 'S1_Q4' | 'S1_Q5';

export function getQuestionsByStage(questions: OnboardingQuestion[], stage: number): OnboardingQuestion[] {
  return questions
    .filter(q => q.stage === stage && q.active)
    .sort((a, b) => a.order_hint - b.order_hint);
}

export function validateResponseForQuestion(
  question: OnboardingQuestion, 
  response: QuestionResponse
): boolean {
  // Type match
  if (question.type !== response.type) return false;
  
  // Additional validation by type
  switch (question.type) {
    case 'single_choice':
      if (response.type !== 'single_choice') return false;
      return question.options.some(opt => opt.value === response.value);
      
    case 'multi_select':
      if (response.type !== 'multi_select') return false;
      return response.values.every(val => 
        question.options.some(opt => opt.value === val)
      );
      
    case 'free_text':
      if (response.type !== 'free_text') return false;
      return response.text.length > 0 && response.text.length <= 500;
      
    case 'likert5':
      if (response.type !== 'likert5') return false;
      return response.value >= 1 && response.value <= 5;
      
    default:
      return false;
  }
}
