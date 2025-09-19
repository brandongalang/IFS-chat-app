import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ProgressUpdateRequest,
  ProgressUpdateResponse,
  UserOnboardingState,
  OnboardingQuestion
} from '@/lib/onboarding/types';
import { computeStage1Scores, hasCompleteStage1 } from '@/lib/onboarding/scoring';
import { selectStage2Questions } from '@/lib/onboarding/selector';
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response';

/**
 * POST /api/onboarding/progress
 * 
 * Handles autosave of individual question responses with intelligent stage progression.
 * Features:
 * - Optimistic concurrency control via version field
 * - Automatic Stage 1 scoring and Stage 2 question selection 
 * - Response validation and persistence
 * - Progress tracking and analytics
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // Parse and validate request
    const body = await request.json();
    const validation = ProgressUpdateRequest.safeParse(body);
    
    if (!validation.success) {
      return jsonResponse({
        error: 'Invalid request',
        details: validation.error.issues
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const { stage, questionId, response, version } = validation.data;

    // Get or create user onboarding state
    const fetchResult = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();
    let userState = fetchResult.data;
    const fetchError = fetchResult.error;

    if (fetchError && fetchError.code === 'PGRST116') {
      // User doesn't have onboarding state yet, create it
      const { data: newState, error: createError } = await supabase
        .from('user_onboarding')
        .insert({
          user_id: user.id,
          stage: 'stage1',
          status: 'in_progress'
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user onboarding state:', createError);
        return errorResponse('Failed to initialize onboarding', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }

      userState = newState;
    } else if (fetchError) {
      console.error('Error fetching user onboarding state:', fetchError);
      return errorResponse('Failed to load onboarding state', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Version conflict check for optimistic concurrency
    if (userState!.version !== version) {
      return jsonResponse({
        error: 'Version conflict - state has been updated',
        current_version: userState!.version
      }, HTTP_STATUS.CONFLICT);
    }

    // Upsert the individual response
    const stageNum = stage === 'stage1' ? 1 : stage === 'stage2' ? 2 : 3;
    const { error: responseError } = await supabase
      .from('onboarding_responses')
      .upsert({
        user_id: user.id,
        question_id: questionId,
        stage: stageNum,
        response
      }, {
        onConflict: 'user_id,question_id'
      });

    if (responseError) {
      console.error('Error upserting response:', responseError);
      return errorResponse('Failed to save response', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Update answers snapshot
    const updatedAnswers = {
      ...userState!.answers_snapshot,
      [questionId]: response
    };

    // Prepare update payload
    const updateData: Partial<UserOnboardingState> = {
      answers_snapshot: updatedAnswers,
      last_saved_at: new Date().toISOString()
    };

    // If this is a Stage 1 response, recompute scores and potentially select Stage 2 questions
    if (stage === 'stage1') {
      const stage1Scores = computeStage1Scores(updatedAnswers);
      updateData.stage1_scores = stage1Scores;

      // If Stage 1 is complete and we haven't selected Stage 2 questions yet, do selection
      if (hasCompleteStage1(updatedAnswers) && 
          (!userState!.stage2_selected_questions || userState!.stage2_selected_questions.length === 0)) {
        
        // Fetch Stage 2 question bank
        const { data: questionBank } = await supabase
          .from('onboarding_questions')
          .select('*')
          .eq('stage', 2)
          .eq('active', true)
          .order('order_hint');

        if (questionBank && questionBank.length >= 4) {
          const selection = selectStage2Questions(stage1Scores, questionBank as OnboardingQuestion[]);
          updateData.stage2_selected_questions = selection.ids;

          if (userState!.stage === 'stage1') {
            updateData.stage = 'stage2';
          }
        }
      }
    }

    if (stage === 'stage2' && userState!.stage !== 'complete') {
      const selectedQuestions = userState!.stage2_selected_questions || [];
      if (selectedQuestions.length > 0 && (userState!.stage === 'stage2' || userState!.stage === 'stage1')) {
        const allAnswered = selectedQuestions.every((id: string) => Boolean(updatedAnswers[id]));
        if (allAnswered) {
          updateData.stage = 'stage3';
        }
      }
    }

    // Update user onboarding state with optimistic concurrency
    const { data: updatedState, error: updateError } = await supabase
      .from('user_onboarding')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('version', version)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user onboarding state:', updateError);
      return errorResponse('Failed to update progress', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Prepare response
    const responseData: ProgressUpdateResponse = {
      ok: true,
      state: updatedState as UserOnboardingState
    };

    // If we just completed Stage 1, provide Stage 2 questions in response
    if (stage === 'stage1' && 
        updatedState.stage2_selected_questions && 
        updatedState.stage2_selected_questions.length > 0) {
      
      const { data: stage2Questions } = await supabase
        .from('onboarding_questions')
        .select('*')
        .in('id', updatedState.stage2_selected_questions)
        .order('order_hint');

      if (stage2Questions) {
        responseData.next = {
          stage: 'stage2',
          questions: stage2Questions as OnboardingQuestion[]
        };
      }
    }

    return jsonResponse(responseData);

  } catch (error) {
    console.error('Unexpected error in progress route:', error);
    return errorResponse('Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
