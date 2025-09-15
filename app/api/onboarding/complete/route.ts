import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  CompletionRequest,
  CompletionResponse,
  QuestionResponse,
  OnboardingQuestion,
  QuestionOption,
  OnboardingResponseRecord,
} from '@/lib/onboarding/types';
import { computeStage1Scores, getTopThemes } from '@/lib/onboarding/scoring';
import questionsConfig from '@/config/onboarding-questions.json';
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold';
import { userOverviewPath } from '@/lib/memory/snapshots/fs-helpers';
import { editMarkdownSection } from '@/lib/memory/markdown/editor';

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
        redirect: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
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

    // Trigger user memory synthesis
    try {
      const { success: _memSuccess, didEdit: _memDidEdit } = await synthesizeOnboardingMemories(user.id);
      void _memSuccess;
      void _memDidEdit;
    } catch (memoryError) {
      console.warn('Failed to synthesize onboarding memories:', memoryError);
      // Don't fail the completion for memory synthesis issues
    }

    // TODO: Track analytics event
    // await trackEvent('onboarding_completed', { userId: user.id, duration: ... });

    const response: CompletionResponse = {
      ok: true,
      redirect: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
      completed_at: now
    };

    // Also set a lightweight cookie hint so middleware/UX can skip the DB check
    const res = NextResponse.json(response)
    try {
      res.cookies.set('ifs_onb', '0', {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: true,
      })
    } catch {}

    return res;

  } catch (error) {
    console.error('Unexpected error in completion route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Validates that all required onboarding responses are present
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

async function validateOnboardingCompletion(
  supabase: SupabaseClient<Database>, 
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
 */
async function synthesizeOnboardingMemories(userId: string): Promise<{ success: boolean; didEdit: boolean }> {
  try {
    const supabase = await createClient();
    const { data: responses, error } = await supabase
      .from('onboarding_responses')
      .select('question_id, stage, response')
      .eq('user_id', userId)
      .in('stage', [1, 2, 3]);

    if (error || !responses) {
      console.warn('Failed to fetch onboarding responses:', error);
      return { success: false, didEdit: false };
    }

    const stage1Snapshot: Record<string, QuestionResponse> = {};
    const stage2: OnboardingResponseRecord[] = [];
    const stage3: OnboardingResponseRecord[] = [];

    for (const responseRecord of responses) {
      if (responseRecord.stage === 1) {
        stage1Snapshot[responseRecord.question_id] = responseRecord.response as QuestionResponse;
      } else if (responseRecord.stage === 2) {
        stage2.push(responseRecord);
      } else if (responseRecord.stage === 3) {
        stage3.push(responseRecord);
      }
    }

    const scores = computeStage1Scores(stage1Snapshot);
    const topThemes = getTopThemes(scores);
    const themesMd = topThemes
      .map(theme => `- ${theme}: ${(scores[theme] * 100).toFixed(0)}%`)
      .join('\n');

    const questionMap = new Map<string, OnboardingQuestion>(
      (questionsConfig.questions as OnboardingQuestion[]).map((q: OnboardingQuestion) => [q.id, q])
    );

    const protectionsMd = stage2
      .map((row): string | null => {
        const question = questionMap.get(row.question_id);
        if (!question || row.response.type !== 'single_choice') return null;
        const response = row.response;
        const option = question.options.find((opt: QuestionOption) => opt.value === response.value);
        return `- ${question.prompt} ${option ? option.label : response.value}`;
      })
      .filter((line): line is string => Boolean(line))
      .join('\n');

    let somaticMd = '';
    const somatic = stage3.find(row => row.question_id === 'S3_Q1');
    if (somatic && somatic.response.type === 'multi_select') {
      const q = questionMap.get('S3_Q1');
      somaticMd = somatic.response.values
        .map((value: string) => q?.options.find((opt: QuestionOption) => opt.value === value)?.label || value)
        .join(', ');
    }

    let beliefsMd = '';
    const belief = stage3.find(row => row.question_id === 'S3_Q2');
    if (belief && belief.response.type === 'free_text') beliefsMd = belief.response.text;

    let selfCompMd = '';
    const selfComp = stage3.find(row => row.question_id === 'S3_Q3');
    if (selfComp && selfComp.response.type === 'free_text') selfCompMd = selfComp.response.text;

    let emotionsMd = '';
    const emotion = stage3.find(row => row.question_id === 'S3_Q4');
    if (emotion && emotion.response.type === 'single_choice') {
      const q = questionMap.get('S3_Q4');
      const response = emotion.response;
      emotionsMd =
        q?.options.find((o: QuestionOption) => o.value === response.value)?.label ||
        response.value;
    }

    await ensureOverviewExists(userId);
    const path = userOverviewPath(userId);

    let didEdit = false;
    let success = true;
    const sections = [
      { anchor: 'onboarding:v1:themes', text: themesMd },
      { anchor: 'onboarding:v1:somatic', text: somaticMd },
      { anchor: 'onboarding:v1:protections', text: protectionsMd },
      { anchor: 'onboarding:v1:beliefs', text: beliefsMd },
      { anchor: 'onboarding:v1:self_compassion', text: selfCompMd },
      { anchor: 'onboarding:v1:emotions', text: emotionsMd },
    ];

    for (const { anchor, text } of sections) {
      try {
        const result = await editMarkdownSection(path, anchor, { replace: text });
        if (result.beforeHash !== result.afterHash) didEdit = true;
      } catch (err) {
        success = false;
        console.warn('Failed to edit markdown section', anchor, err);
      }
    }

    return { success, didEdit };
  } catch (err) {
    console.error('synthesizeOnboardingMemories error', err);
    return { success: false, didEdit: false };
  }
}
