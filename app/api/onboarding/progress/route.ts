import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ProgressUpdateRequest,
  ProgressUpdateResponse,
  UserOnboardingState,
} from '@/lib/onboarding/types';
import { computeStage1Scores, hasCompleteStage1 } from '@/lib/onboarding/scoring';

/**
 * POST /api/onboarding/progress
 *
 * Handles autosave of individual question responses.
 * Features:
 * - Optimistic concurrency control via version field
 * - Automatic Stage 1 scoring
 * - Response validation and persistence
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
    const validation = ProgressUpdateRequest.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.error.issues,
      }, { status: 400 });
    }

    const { stage, questionId, response, version } = validation.data;

    // Get or create user onboarding state
    const { data: userState, error: fetchError } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code === 'PGRST116') {
      // This should ideally not happen if client initializes state first,
      // but handle gracefully.
      return NextResponse.json({ error: 'Onboarding not initialized' }, { status: 400 });
    } else if (fetchError) {
      console.error('Error fetching user onboarding state:', fetchError);
      return NextResponse.json({ error: 'Failed to load onboarding state' }, { status: 500 });
    }

    // Version conflict check
    if (userState.version !== version) {
      return NextResponse.json({
        error: 'Version conflict - state has been updated',
        current_version: userState.version,
      }, { status: 409 });
    }

    // Upsert the individual response
    const stageNum = stage === 'stage1' ? 1 : stage === 'stage2' ? 2 : 3;
    const { error: responseError } = await supabase
      .from('onboarding_responses')
      .upsert({
        user_id: user.id,
        question_id: questionId,
        stage: stageNum,
        response,
      }, {
        onConflict: 'user_id,question_id',
      });

    if (responseError) {
      console.error('Error upserting response:', responseError);
      // Non-fatal, but log it
    }

    // Update answers snapshot
    const updatedAnswers = {
      ...(userState.answers_snapshot || {}),
      [questionId]: response,
    };

    // Prepare update payload
    const updateData: Partial<UserOnboardingState> = {
      answers_snapshot: updatedAnswers,
      last_saved_at: new Date().toISOString(),
    };

    let nextStage: 'stage2' | null = null;

    // If this is a Stage 1 response, recompute scores
    if (stage === 'stage1') {
      const stage1Scores = computeStage1Scores(updatedAnswers);
      updateData.stage1_scores = stage1Scores;

      if (hasCompleteStage1(updatedAnswers) && userState.stage !== 'stage2') {
        updateData.stage = 'stage2';
        nextStage = 'stage2';
      }
    }

    // Update user onboarding state
    const { data: updatedState, error: updateError } = await supabase
      .from('user_onboarding')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('version', version)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user onboarding state:', updateError);
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }

    // Prepare response
    const responseData: ProgressUpdateResponse = {
      ok: true,
      state: updatedState,
      next: nextStage ? { stage: nextStage } : undefined,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Unexpected error in progress route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
