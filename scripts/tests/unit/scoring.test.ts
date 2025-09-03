import { computeStage1Scores } from '../../../lib/onboarding/scoring';
import type { QuestionResponse } from '../../../lib/onboarding/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
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

main().catch((err) => {
  console.error('Scoring unit test failed:', err);
  process.exit(1);
});

