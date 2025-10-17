import { NextRequest } from 'next/server';
import questionsConfig from '@/config/onboarding-questions.json';
import { getUserClient } from '@/lib/supabase/clients';
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response';
import { validateCompletionRequest } from '@/lib/onboarding/validate-completion-request';
import { completeOnboardingState } from '@/lib/onboarding/complete-state';
// Removed markdown synthesis in favor of PRD observation write
import { buildCompletionResponse } from '@/lib/onboarding/build-completion-response';
import { buildOnboardingSummary } from '@/lib/onboarding/summary';
import { enqueueMemoryUpdate } from '@/lib/memory/queue';
import { track } from '@/lib/analytics';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { recordObservation } from '@/lib/data/schema/server';
import {
  QuestionResponse as QuestionResponseSchema,
  OnboardingQuestion as OnboardingQuestionSchema,
  type OnboardingQuestion,
  type QuestionResponse,
} from '@/lib/onboarding/types';

const onboardingRequirements: Record<string, string[]> =
  (questionsConfig as { requirements?: Record<string, string[]> }).requirements ?? {};

const onboardingQuestions: OnboardingQuestion[] = OnboardingQuestionSchema.array().parse(
  (questionsConfig as { questions?: unknown }).questions ?? []
);

const onboardingQuestionsById = new Map<string, OnboardingQuestion>(
  onboardingQuestions.map(question => [question.id, question])
);

const getRequiredQuestionIds = (stage: number): string[] => onboardingRequirements[String(stage)] ?? [];

/**
 * POST /api/onboarding/complete
 *
 * Completes the onboarding process with comprehensive validation.
 * Features:
 * - Validates all required responses are present (5 + 4 + 4 = 13 total)
 * - Updates user state to completed
 * - Triggers user memory synthesis (placeholder for now)
 * - Returns redirect to / (not /chat per requirements)
 * - Idempotent operation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = validateCompletionRequest(body);

    if (!validationResult.success) {
      return jsonResponse({
        error: 'Invalid request',
        details: validationResult.issues,
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const { version } = validationResult.data;

    // Get user's onboarding state
    const { data: userState, error: stateError } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (stateError) {
      console.error('Error fetching user onboarding state:', stateError);
      return errorResponse('Onboarding state not found', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if already completed
    if (userState.status === 'completed') {
      const completedAt = userState.completed_at ?? new Date().toISOString();
      const summary = await buildOnboardingSummary(supabase, user.id);
      return buildCompletionResponse(completedAt, { setCompletionCookie: false, summary });
    }

    // Version conflict check
    if (userState.version !== version) {
      return jsonResponse({
        error: 'Version conflict - state has been updated',
        current_version: userState.version
      }, HTTP_STATUS.CONFLICT);
    }

    // Validate completion requirements
    const completionValidation = await validateOnboardingCompletion(supabase, user.id);
    if (!completionValidation.valid) {
      return jsonResponse({
        error: 'Onboarding not complete',
        missing: completionValidation.missing
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Mark as completed
    const completionResult = await completeOnboardingState(supabase, user.id, version);

    if (!completionResult.success) {
      console.error('Error completing onboarding:', completionResult.error);
      return errorResponse('Failed to complete onboarding', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const onboardingRefId = typeof userState.id === 'string' ? userState.id : user.id;
    const enqueueResult = await enqueueMemoryUpdate({
      userId: user.id,
      kind: 'onboarding',
      refId: onboardingRefId,
      payload: {
        onboardingId: onboardingRefId,
        completedAt: completionResult.completedAt,
      },
      metadata: { source: 'onboarding_complete' },
    });
    if (!enqueueResult.inserted && enqueueResult.error) {
      console.warn('[onboarding] failed to enqueue memory update', {
        userId: user.id,
        onboardingId: onboardingRefId,
        error: enqueueResult.error,
      });
    }

    track('onboarding_completed', {
      userId: user.id,
      onboardingId: onboardingRefId,
      stageVersion: version,
    });

    // Build summary strings and persist a PRD observation (type 'note').
    // This replaces legacy markdown edits during onboarding completion.
    const summary = await buildOnboardingSummary(supabase, user.id);
    const questionAnswers = await loadQuestionAnswerEntries(supabase, user.id);
    try {
      const contentLines: string[] = [
        'Onboarding completion summary',
        '',
        ...summary.sentences,
        '',
        'Stage 1 themes:',
        ...(summary.themes.length
          ? summary.themes.map(theme => `- ${theme.label} (${theme.score}%)`)
          : ['- none recorded']),
        '',
        'Stage 2 protector hypotheses:',
        ...(summary.parts.length
          ? summary.parts.map(part => `- ${part.name}: ${part.evidence} — ${part.intention}`)
          : ['- none recorded']),
        '',
        'Stage 3 reflections:',
        `Somatic signals: ${summary.somatic.length ? summary.somatic.join(', ') : '—'}`,
        `Core belief: ${summary.core_belief ?? '—'}`,
        `Mistake reflex: ${summary.mistake_reflex ?? '—'}`,
        `Least trusted feeling: ${summary.least_trusted_feeling ?? '—'}`,
        '',
        'Question responses:',
      ];

      for (const entry of questionAnswers) {
        const answerLine = entry.answer_text.length > 0 ? entry.answer_text : '—';
        contentLines.push(`- [Stage ${entry.stage} | ${entry.id}] ${entry.prompt}`);
        contentLines.push(`  Answer: ${answerLine}`);
      }

      await recordObservation(
        {
          type: 'note',
          content: contentLines.join('\n'),
          metadata: {
            source: 'onboarding',
            version,
            summary: {
              sentences: summary.sentences,
              themes: summary.themes,
              parts: summary.parts,
              somatic: summary.somatic,
              core_belief: summary.core_belief,
              mistake_reflex: summary.mistake_reflex,
              least_trusted_feeling: summary.least_trusted_feeling,
            },
            question_answers: questionAnswers,
          },
          entities: [],
        },
        { userId: user.id }
      );
    } catch (obsError) {
      console.warn('[onboarding] failed to record PRD observation', obsError);
      // Non-fatal: do not block completion response
    }

    return buildCompletionResponse(completionResult.completedAt, { summary });

  } catch (error) {
    console.error('Unexpected error in completion route:', error);
    return errorResponse('Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

type ObservationQuestionAnswerEntry = {
  id: string;
  stage: number;
  prompt: string;
  helper: string | null;
  order_hint: number | null;
  answer_text: string;
  answer_labels: string[];
  response: QuestionResponse;
};

async function loadQuestionAnswerEntries(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ObservationQuestionAnswerEntry[]> {
  try {
    const { data, error } = await supabase
      .from('onboarding_responses')
      .select('question_id, stage, response')
      .eq('user_id', userId)
      .in('stage', [1, 2, 3]);

    if (error || !data) {
      if (error) {
        console.warn('[onboarding] failed to fetch question responses for observation metadata', error);
      }
      return [];
    }

    const entries: ObservationQuestionAnswerEntry[] = [];

    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const questionId = typeof row.question_id === 'string' ? row.question_id : null;
      const stage = typeof row.stage === 'number' ? row.stage : null;
      const parsed = QuestionResponseSchema.safeParse((row as Record<string, unknown>).response);

      if (!questionId || stage === null || !parsed.success) {
        console.warn('[onboarding] skipping malformed response row', { questionId, stage });
        continue;
      }

      const question = onboardingQuestionsById.get(questionId);
      const { text, labels } = formatAnswerForObservation(question, parsed.data);

      entries.push({
        id: questionId,
        stage,
        prompt: question?.prompt ?? questionId,
        helper: question?.helper ?? null,
        order_hint: typeof question?.order_hint === 'number' ? question.order_hint : null,
        answer_text: text,
        answer_labels: labels,
        response: parsed.data,
      });
    }

    entries.sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage;
      const orderA = a.order_hint ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_hint ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });

    return entries;
  } catch (error) {
    console.warn('[onboarding] failed to load onboarding responses for observation', error);
    return [];
  }
}

function formatAnswerForObservation(
  question: OnboardingQuestion | undefined,
  response: QuestionResponse
): { text: string; labels: string[] } {
  switch (response.type) {
    case 'single_choice': {
      const label = resolveOptionLabel(question, response.value);
      return { text: label, labels: label ? [label] : [] };
    }
    case 'multi_select': {
      if (response.values.length === 0) {
        return { text: '', labels: [] };
      }
      const labels = response.values.map(value => resolveOptionLabel(question, value)).filter(Boolean);
      const text = labels.length ? labels.join(', ') : response.values.join(', ');
      return { text, labels };
    }
    case 'free_text': {
      const trimmed = response.text.trim();
      return { text: trimmed, labels: trimmed ? [trimmed] : [] };
    }
    case 'likert5': {
      const valueText = response.value.toString();
      return { text: valueText, labels: [valueText] };
    }
    default:
      return { text: '', labels: [] };
  }
}

function resolveOptionLabel(question: OnboardingQuestion | undefined, value: string): string {
  if (!question?.options) return value;
  const option = question.options.find(opt => opt.value === value);
  return option?.label ?? value;
}

/**
 * Validates that all required onboarding responses are present
 */
async function validateOnboardingCompletion(
  supabase: SupabaseClient<Database>, 
  userId: string
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  try {
    // Check Stage 1 responses (config-defined requirements)
    const { data: stage1Responses, error: s1Error } = await supabase
      .from('onboarding_responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('stage', 1);

    if (s1Error) {
      console.error('Error checking Stage 1 responses:', s1Error);
      missing.push('stage1_responses_check_failed');
    } else {
      const requiredS1 = getRequiredQuestionIds(1);
      const existingS1 = (stage1Responses ?? []).map((r: { question_id: string }) => r.question_id);
      const missingS1 = requiredS1.filter(qId => !existingS1.includes(qId));
      missing.push(...missingS1);
    }

    // Check Stage 2 responses (config-defined or minimum requirement)
    const { data: stage2Responses, error: s2Error } = await supabase
      .from('onboarding_responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('stage', 2);

    if (s2Error) {
      console.error('Error checking Stage 2 responses:', s2Error);
      missing.push('stage2_responses_check_failed');
    } else {
      const requiredS2 = getRequiredQuestionIds(2);
      if (requiredS2.length > 0) {
        const existingS2 = (stage2Responses ?? []).map((r: { question_id: string }) => r.question_id);
        const missingS2 = requiredS2.filter(qId => !existingS2.includes(qId));
        missing.push(...missingS2);
      } else {
        const responseCount = stage2Responses?.length ?? 0;
        if (responseCount < 4) {
          missing.push(`stage2_incomplete_${responseCount}_of_4`);
        }
      }
    }

    // Check Stage 3 responses (config-defined requirements)
    const { data: stage3Responses, error: s3Error } = await supabase
      .from('onboarding_responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('stage', 3);

    if (s3Error) {
      console.error('Error checking Stage 3 responses:', s3Error);
      missing.push('stage3_responses_check_failed');
    } else {
      const requiredS3 = getRequiredQuestionIds(3);
      const existingS3 = (stage3Responses ?? []).map((r: { question_id: string }) => r.question_id);
      const missingS3 = requiredS3.filter(qId => !existingS3.includes(qId));
      missing.push(...missingS3);
    }

  } catch (error) {
    console.error('Error in completion validation:', error);
    missing.push('validation_failed');
  }

  return {
    valid: missing.length === 0,
    missing
  };
}
