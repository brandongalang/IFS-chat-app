import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStage1Scores, getTopThemes } from './scoring';
import type {
  QuestionResponse,
  OnboardingResponseRecord,
  OnboardingQuestion,
  QuestionOption,
} from './types';
import questionsConfig from '@/config/onboarding-questions.json';
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold';
import { userOverviewPath } from '@/lib/memory/snapshots/fs-helpers';
import { editMarkdownSection } from '@/lib/memory/markdown/editor';
import type { Database } from '@/lib/types/database';

export async function synthesizeOnboardingMemories(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ success: boolean; didEdit: boolean }> {
  try {
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
        stage2.push(responseRecord as OnboardingResponseRecord);
      } else if (responseRecord.stage === 3) {
        stage3.push(responseRecord as OnboardingResponseRecord);
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
