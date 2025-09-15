import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  QuestionsResponse, 
  OnboardingQuestion
} from '@/lib/onboarding/types';
import { computeStage1Scores } from '@/lib/onboarding/scoring';
import { selectStage2Questions } from '@/lib/onboarding/selector';

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse stage parameter
    const url = new URL(request.url);
    const stageParam = url.searchParams.get('stage');
    
    if (!stageParam || !['1', '2', '3'].includes(stageParam)) {
      return NextResponse.json({ 
        error: 'Invalid stage parameter. Must be 1, 2, or 3' 
      }, { status: 400 });
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
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
      }

      const response: QuestionsResponse = {
        questions: questions as OnboardingQuestion[],
        stage,
        selected_for_user: false
      };

      return NextResponse.json(response);
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
        return NextResponse.json({ 
          error: 'User onboarding state not found. Complete Stage 1 first.' 
        }, { status: 400 });
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
          return NextResponse.json({ error: 'Failed to fetch selected questions' }, { status: 500 });
        }

        const response: QuestionsResponse = {
          questions: selectedQuestions as OnboardingQuestion[],
          stage: 2,
          selected_for_user: true
        };

        return NextResponse.json(response);
      }

      // No Stage 2 questions selected yet - need to compute selection
      if (!userState.stage1_scores || Object.keys(userState.stage1_scores).length === 0) {
        // Try to compute scores from answers snapshot
        const stage1Scores = computeStage1Scores(userState.answers_snapshot || {});
        
        if (Object.keys(stage1Scores).length === 0) {
          return NextResponse.json({ 
            error: 'Stage 1 not complete. Cannot select Stage 2 questions.' 
          }, { status: 400 });
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
        return NextResponse.json({ error: 'Failed to fetch question bank' }, { status: 500 });
      }

      if (!questionBank || questionBank.length < 4) {
        return NextResponse.json({ 
          error: 'Insufficient questions in Stage 2 bank' 
        }, { status: 500 });
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

        return NextResponse.json(response);

      } catch (selectionError) {
        console.error('Error in Stage 2 question selection:', selectionError);
        return NextResponse.json({ 
          error: 'Failed to select personalized questions' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });

  } catch (error) {
    console.error('Unexpected error in questions route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
