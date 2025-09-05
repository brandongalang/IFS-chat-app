import { computeStage1Scores, STAGE1_RESPONSE_VALUES } from '../../../lib/onboarding/scoring';
import type { QuestionResponse, Theme } from '../../../lib/onboarding/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// This test case is designed to fail before the fix and pass after.
// It checks if a theme's score is correctly normalized to 1.0 when
// all answers are chosen to maximize that theme's score.
async function testThemeNormalization() {
  const themeToTest: Theme = 'self_criticism';

  // Find the responses that maximize the score for the theme to test
  const answers: Record<string, QuestionResponse> = {};
  for (const questionId in STAGE1_RESPONSE_VALUES) {
    let maxWeight = -1;
    let bestResponse = '';

    const responseMapping = STAGE1_RESPONSE_VALUES[questionId as keyof typeof STAGE1_RESPONSE_VALUES];
    for (const responseValue in responseMapping) {
      const weights = responseMapping[responseValue as keyof typeof responseMapping];
      const weight = (weights as Record<string, number>)[themeToTest] || 0;

      if (weight > maxWeight) {
        maxWeight = weight;
        bestResponse = responseValue;
      }
    }

    if (bestResponse) {
      answers[questionId] = { type: 'single_choice', value: bestResponse };
    }
  }

  const scores = computeStage1Scores(answers);
  const score = scores[themeToTest];

  // The score should be very close to 1.0. We allow a small tolerance for floating point inaccuracies.
  const tolerance = 1e-9;
  assert(Math.abs(1.0 - score) < tolerance, `Score for ${themeToTest} should be 1.0, but was ${score}`);

  console.log(`Normalization test passed for theme: ${themeToTest}.`);
}

async function main() {
  await testThemeNormalization();
  console.log('All new scoring tests passed.');
}

main().catch((err) => {
  console.error('New scoring test failed:', err);
  process.exit(1);
});
