import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  CompletionRequest, 
  CompletionResponse 
} from '@/lib/onboarding/types';

/**
 * POST /api/onboarding/complete
 * 
 * Completes the onboarding process with comprehensive validation.
 * Features:
 * - Validates all required responses are present (5 + 4 + 4 = 13 total)
 * - Updates user state to completed
 * - Triggers user memory synthesis (placeholder for now)
 * - Returns redirect to /today (not /chat per requirements)
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
    const validation = CompletionRequest.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const { version } = validation.data;

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
      const response: CompletionResponse = {
        ok: true,
        redirect: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/today`,
        completed_at: userState.completed_at!
      };
      return NextResponse.json(response);
    }

    // Version conflict check
    if (userState.version !== version) {
      return NextResponse.json({ 
        error: 'Version conflict - state has been updated', 
        current_version: userState.version 
      }, { status: 409 });
    }

    // Validate completion requirements
    const validationResult = await validateOnboardingCompletion(supabase, user.id);
    if (!validationResult.valid) {
      return NextResponse.json({ 
        error: 'Onboarding not complete', 
        missing: validationResult.missing 
      }, { status: 400 });
    }

    // Mark as completed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('user_onboarding')
      .update({
        status: 'completed',
        stage: 'complete',
        completed_at: now
      })
      .eq('user_id', user.id)
      .eq('version', version)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing onboarding:', updateError);
      return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
    }

    // TODO: Trigger user memory synthesis
    // This will be implemented in a future task
    try {
      await synthesizeOnboardingMemories(user.id);
    } catch (memoryError) {
      console.warn('Failed to synthesize onboarding memories:', memoryError);
      // Don't fail the completion for memory synthesis issues
    }

    // TODO: Track analytics event
    // await trackEvent('onboarding_completed', { userId: user.id, duration: ... });

    const response: CompletionResponse = {
      ok: true,
      redirect: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/today`,
      completed_at: now
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in completion route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Validates that all required onboarding responses are present
 */
async function validateOnboardingCompletion(
  supabase: any, 
  userId: string
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  try {
    // Check Stage 1 responses (5 required)
    const { data: stage1Responses, error: s1Error } = await supabase
      .from('onboarding_responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('stage', 1);

    if (s1Error) {
      console.error('Error checking Stage 1 responses:', s1Error);
      missing.push('stage1_responses_check_failed');
    } else {
      const requiredS1 = ['S1_Q1', 'S1_Q2', 'S1_Q3', 'S1_Q4', 'S1_Q5'];
      const existingS1 = stage1Responses.map((r: { question_id: string }) => r.question_id);
      const missingS1 = requiredS1.filter(qId => !existingS1.includes(qId));
      missing.push(...missingS1);
    }

    // Check Stage 2 responses (4 required, but personalized)
    const { data: stage2Responses, error: s2Error } = await supabase
      .from('onboarding_responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('stage', 2);

    if (s2Error) {
      console.error('Error checking Stage 2 responses:', s2Error);
      missing.push('stage2_responses_check_failed');
    } else if (stage2Responses.length < 4) {
      missing.push(`stage2_incomplete_${stage2Responses.length}_of_4`);
    }

    // Check Stage 3 responses (4 required)
    const { data: stage3Responses, error: s3Error } = await supabase
      .from('onboarding_responses')
      .select('question_id')
      .eq('user_id', userId)
      .eq('stage', 3);

    if (s3Error) {
      console.error('Error checking Stage 3 responses:', s3Error);
      missing.push('stage3_responses_check_failed');
    } else {
      const requiredS3 = ['S3_Q1', 'S3_Q2', 'S3_Q3', 'S3_Q4'];
      const existingS3 = stage3Responses.map((r: { question_id: string }) => r.question_id);
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

/**
 * Synthesizes onboarding responses into user memory entries
 * Placeholder implementation - will be expanded in future task
 */
async function synthesizeOnboardingMemories(userId: string): Promise<void> {
  // TODO: Implement user memory synthesis
  // This will read the user's responses and create memory entries like:
  // - onboarding:v1:themes (top themes with scores)
  // - onboarding:v1:somatic (body stress locations)
  // - onboarding:v1:protections (what parts are protecting from)
  // - onboarding:v1:beliefs (core beliefs from free text)
  // - onboarding:v1:self_compassion (supportive message to parts)
  
  console.log(`TODO: Synthesize onboarding memories for user ${userId}`);
}
