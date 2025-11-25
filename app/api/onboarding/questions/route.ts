import { NextRequest } from 'next/server';
import { getUserClient } from '@/lib/supabase/clients';
import {
  QuestionsResponse,
  OnboardingQuestion
} from '@/lib/onboarding/types';
import { computeStage1Scores } from '@/lib/onboarding/scoring';
import { selectStage2Questions } from '@/lib/onboarding/selector';
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response';

/**
 * GET /api/onboarding/questions?stage=1|2|3
 * 
 * Returns questions for the requested stage with intelligent Stage 2 selection.
 * Features:
 * - Stage 1 & 3: Returns all active questions in order
 * - Stage 2: Returns personalized 4-question selection based on Stage 1 scores
 * - Caches Stage 2 selection to ensure consistency across requests
 * - Handles missing or incomplete user state gracefully
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // Parse stage parameter
    const url = new URL(request.url);
    const stageParam = url.searchParams.get('stage');
    
    if (!stageParam || !['1', '2', '3'].includes(stageParam)) {
      return jsonResponse({
        error: 'Invalid stage parameter. Must be 1, 2, or 3'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const stage = parseInt(stageParam, 10);

    // For Stages 1 and 3, return all active questions
    if (stage === 1 || stage === 3) {
      const { data: questions, error } = await supabase
        .from('onboarding_questions')
        .select('*')
        .eq('stage', stage)
        .eq('active', true)
        .order('order_hint');

      if (error) {
        console.error(`Error fetching Stage ${stage} questions:`, error);
        return errorResponse('Failed to fetch questions', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }

      const response: QuestionsResponse = {
        questions: questions as OnboardingQuestion[],
        stage,
        selected_for_user: false
      };

      return jsonResponse(response);
    }

    // Stage 2: Personalized question selection
    if (stage === 2) {
      // Get user's onboarding state
      const { data: userState, error: stateError } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (stateError) {
        console.error('Error fetching user onboarding state:', stateError);
        return jsonResponse({
          error: 'User onboarding state not found. Complete Stage 1 first.'
        }, HTTP_STATUS.BAD_REQUEST);
      }

      // If we already have selected Stage 2 questions, return them
      if (userState.stage2_selected_questions && userState.stage2_selected_questions.length > 0) {
        const { data: selectedQuestions, error: questionsError } = await supabase
          .from('onboarding_questions')
          .select('*')
          .in('id', userState.stage2_selected_questions)
          .eq('active', true)
          .order('order_hint');

        if (questionsError) {
          console.error('Error fetching selected Stage 2 questions:', questionsError);
          return errorResponse('Failed to fetch selected questions', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }

        const response: QuestionsResponse = {
          questions: selectedQuestions as OnboardingQuestion[],
          stage: 2,
          selected_for_user: true
        };

        return jsonResponse(response);
      }

      // No Stage 2 questions selected yet - need to compute selection
      if (!userState.stage1_scores || Object.keys(userState.stage1_scores).length === 0) {
        // Try to compute scores from answers snapshot
        const stage1Scores = computeStage1Scores(userState.answers_snapshot || {});
        
        if (Object.keys(stage1Scores).length === 0) {
          return jsonResponse({
            error: 'Stage 1 not complete. Cannot select Stage 2 questions.'
          }, HTTP_STATUS.BAD_REQUEST);
        }

        // Update scores in database for future use
        await supabase
          .from('user_onboarding')
          .update({ stage1_scores: stage1Scores })
          .eq('user_id', user.id);

        userState.stage1_scores = stage1Scores;
      }

      // Fetch full Stage 2 question bank
      const { data: questionBank, error: bankError } = await supabase
        .from('onboarding_questions')
        .select('*')
        .eq('stage', 2)
        .eq('active', true)
        .order('order_hint');

      if (bankError) {
        console.error('Error fetching Stage 2 question bank:', bankError);
        return errorResponse('Failed to fetch question bank', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }

      if (!questionBank || questionBank.length < 4) {
        return jsonResponse({
          error: 'Insufficient questions in Stage 2 bank'
        }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }

      // Perform Stage 2 selection
      try {
        const selection = selectStage2Questions(userState.stage1_scores, questionBank as OnboardingQuestion[]);
        
        // Save selection to user state
        const { error: updateError } = await supabase
          .from('user_onboarding')
          .update({ stage2_selected_questions: selection.ids })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error saving Stage 2 selection:', updateError);
          // Continue anyway - selection is still valid for this request
        }

        // Return selected questions
        const selectedQuestions = questionBank.filter((question: OnboardingQuestion) =>
          selection.ids.includes(question.id)
        );
        
        const response: QuestionsResponse = {
          questions: selectedQuestions as OnboardingQuestion[],
          stage: 2,
          selected_for_user: true
        };

        return jsonResponse(response);

      } catch (selectionError) {
        console.error('Error in Stage 2 question selection:', selectionError);
        return errorResponse('Failed to select personalized questions', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }
    }

    return errorResponse('Invalid stage', HTTP_STATUS.BAD_REQUEST);

  } catch (error) {
    console.error('Unexpected error in questions route:', error);
    return errorResponse('Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
