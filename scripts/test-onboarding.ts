import { computeStage1Scores, summarizeScores } from '../lib/onboarding/scoring';
import type { QuestionResponse } from '../lib/onboarding/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  // Minimal Stage 1 answers snapshot
  const answers: Record<string, QuestionResponse> = {
    S1_Q1: { type: 'single_choice', value: 'methodical_checking' }, // perfectionism/anxiety
    S1_Q3: { type: 'single_choice', value: 'review_actions' }, // self_criticism/anxiety
  };

  const scores = computeStage1Scores(answers);

  // Basic invariants
  for (const [theme, val] of Object.entries(scores)) {
    assert(val >= 0 && val <= 1, `Score out of range for ${theme}: ${val}`);
  }

  // Expected activations present
  assert(scores.perfectionism > 0 || scores.self_criticism > 0 || scores.anxiety > 0, 'Expected themes not activated');

  const summary = summarizeScores(scores);
  assert(Array.isArray(summary.top_themes), 'summary.top_themes should be array');

  console.log('Onboarding scoring smoke test passed. Top themes:', summary.top_themes);
}

main().catch((err) => {
  console.error('Onboarding scoring smoke test failed:', err);
  process.exit(1);
});

