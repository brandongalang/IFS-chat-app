import { selectStage2Questions, validateStage2Selection } from '../../../lib/onboarding/selector';
import type { OnboardingQuestion, ThemeScores } from '../../../lib/onboarding/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function makeScores(partial: Partial<ThemeScores>): ThemeScores {
  const base: any = {
    achievement: 0,
    perfectionism: 0,
    self_criticism: 0,
    relational: 0,
    conflict_avoidance: 0,
    caretaking: 0,
    safety: 0,
    control: 0,
    anxiety: 0,
    avoidance: 0,
    overwhelm: 0,
    independence: 0,
    restlessness: 0,
    shame: 0,
  };
  return { ...base, ...partial } as ThemeScores;
}

const bank: OnboardingQuestion[] = [
  {
    id: 'S2_Q1', stage: 2, type: 'single_choice', prompt: 'Q1', helper: null, options: [], active: true, locale: 'en', order_hint: 1,
    theme_weights: { anxiety: 0.8, perfectionism: 0.6 },
  },
  {
    id: 'S2_Q2', stage: 2, type: 'single_choice', prompt: 'Q2', helper: null, options: [], active: true, locale: 'en', order_hint: 2,
    theme_weights: { self_criticism: 0.9 },
  },
  {
    id: 'S2_Q3', stage: 2, type: 'single_choice', prompt: 'Q3', helper: null, options: [], active: true, locale: 'en', order_hint: 3,
    theme_weights: { relational: 0.7, caretaking: 0.5 },
  },
  {
    id: 'S2_Q4', stage: 2, type: 'single_choice', prompt: 'Q4', helper: null, options: [], active: true, locale: 'en', order_hint: 4,
    theme_weights: { control: 0.6, safety: 0.4 },
  },
  {
    id: 'S2_Q5', stage: 2, type: 'single_choice', prompt: 'Q5', helper: null, options: [], active: true, locale: 'en', order_hint: 5,
    theme_weights: { achievement: 0.8, restlessness: 0.4 },
  },
];

async function main() {
  const scores = makeScores({ anxiety: 0.9, perfectionism: 0.8, self_criticism: 0.6, relational: 0.4 });
  const result = selectStage2Questions(scores, bank);

  // Basic properties
  assert(Array.isArray(result.ids), 'ids should be array');
  assert(result.ids.length === 4, `should select 4 ids, got ${result.ids.length}`);
  assert(new Set(result.ids).size === result.ids.length, 'ids should be unique');
  assert(result.rationale.top_themes.length > 0, 'rationale.top_themes should be non-empty');

  // Validate selection
  const validation = validateStage2Selection(result.ids, bank, scores);
  assert(validation.valid, `selection invalid: ${validation.issues.join(', ')}`);
  assert(validation.coverage_score > 0, 'coverage_score should be > 0');

  console.log('Selector unit test passed:', result);
}

main().catch((err) => {
  console.error('Selector unit test failed:', err);
  process.exit(1);
});

