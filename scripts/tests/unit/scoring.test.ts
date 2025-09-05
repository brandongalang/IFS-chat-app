import { computeStage1Scores } from '../../../lib/onboarding/scoring';
import type { QuestionResponse } from '../../../lib/onboarding/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function test_scores_are_normalized() {
  const answers: Record<string, QuestionResponse> = {
    S1_Q1: { type: 'single_choice', value: 'methodical_checking' },
    S1_Q2: { type: 'single_choice', value: 'analyze_wrong' },
    S1_Q3: { type: 'single_choice', value: 'review_actions' },
  };

  const scores = computeStage1Scores(answers);

  // Expected themes have some activation
  const expected = ['perfectionism', 'anxiety', 'self_criticism'] as const;
  assert(expected.some(t => scores[t] > 0), 'expected themes should be activated');

  // All themes within [0,1]
  for (const key in scores) {
    const val = (scores as any)[key];
    assert(val >= 0 && val <= 1, `score out of range for ${key}: ${val}`);
  }

  console.log('Scoring unit test passed.');
}

async function test_max_score_reaches_one() {
  console.log('Running test: test_max_score_reaches_one');
  // These answers maximize the 'perfectionism' score.
  const answers: Record<string, QuestionResponse> = {
    'S1_Q1': { type: 'single_choice', value: 'methodical_checking' }, // perfectionism: 0.9
    'S1_Q2': { type: 'single_choice', value: 'analyze_wrong' },       // perfectionism: 0.5
    'S1_Q3': { type: 'single_choice', value: 'give_space' },          // perfectionism: 0
    'S1_Q4': { type: 'single_choice', value: 'ensure_perfect' },      // perfectionism: 0.9
    'S1_Q5': { type: 'single_choice', value: 'push_down_busy' },      // perfectionism: 0
  };

  const scores = computeStage1Scores(answers);

  // With the bug, perfectionism score is (0.9 + 0.5 + 0.9) / 4.5 = 0.5111
  // After the fix, it should be 1.0
  assert(scores.perfectionism === 1, `Perfectionism score should be 1.0, but was ${scores.perfectionism}`);
  console.log('test_max_score_reaches_one passed.');
}

async function main() {
  await test_scores_are_normalized();
  await test_max_score_reaches_one();
}

main().catch((err) => {
  console.error('Scoring unit test failed:', err);
  process.exit(1);
});

