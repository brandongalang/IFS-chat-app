import { NextRequest, NextResponse } from 'next/server';
import questionsConfig from '@/config/onboarding-questions.json';
import { createClient } from '@/lib/supabase/server';
import { validateCompletionRequest } from '@/lib/onboarding/validate-completion-request';
import { completeOnboardingState } from '@/lib/onboarding/complete-state';
import { synthesizeOnboardingMemories } from '@/lib/onboarding/synthesize-memories';
import { buildCompletionResponse } from '@/lib/onboarding/build-completion-response';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

const onboardingRequirements: Record<string, string[]> =
  (questionsConfig as { requirements?: Record<string, string[]> }).requirements ?? {};

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = validateCompletionRequest(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validationResult.issues,
      }, { status: 400 });
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
      return NextResponse.json({ 
        error: 'Onboarding state not found' 
      }, { status: 400 });
    }

    // Check if already completed
    if (userState.status === 'completed') {
      const completedAt = userState.completed_at ?? new Date().toISOString();
      return buildCompletionResponse(completedAt, { setCompletionCookie: false });
    }

    // Version conflict check
    if (userState.version !== version) {
      return NextResponse.json({ 
        error: 'Version conflict - state has been updated', 
        current_version: userState.version 
      }, { status: 409 });
    }

    // Validate completion requirements
    const completionValidation = await validateOnboardingCompletion(supabase, user.id);
    if (!completionValidation.valid) {
      return NextResponse.json({
        error: 'Onboarding not complete',
        missing: completionValidation.missing
      }, { status: 400 });
    }

    // Mark as completed
    const completionResult = await completeOnboardingState(supabase, user.id, version);

    if (!completionResult.success) {
      console.error('Error completing onboarding:', completionResult.error);
      return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
    }

    // Trigger user memory synthesis
    try {
      const { success: _memSuccess, didEdit: _memDidEdit } = await synthesizeOnboardingMemories(supabase, user.id);
      void _memSuccess;
      void _memDidEdit;
    } catch (memoryError) {
      console.warn('Failed to synthesize onboarding memories:', memoryError);
      // Don't fail the completion for memory synthesis issues
    }

    // TODO: Track analytics event
    // await trackEvent('onboarding_completed', { userId: user.id, duration: ... });

    return buildCompletionResponse(completionResult.completedAt);

  } catch (error) {
    console.error('Unexpected error in completion route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
