import type { OnboardingQuestion, QuestionResponse, ThemeScores } from '@/lib/onboarding/types';

/**
 * Shared test fixtures for dev onboarding playground and unit tests
 * This prevents drift between test data used in different contexts
 */

export const DEV_STAGE_1_ANSWERS: Record<string, QuestionResponse> = {
  S1_Q1: { type: 'single_choice', value: 'methodical_checking' },
  S1_Q2: { type: 'single_choice', value: 'analyze_wrong' },
  S1_Q3: { type: 'single_choice', value: 'review_actions' },
};

export const DEV_STAGE_2_QUESTION_BANK: OnboardingQuestion[] = [
  {
    id: 'S2_Q1', 
    stage: 2, 
    type: 'single_choice', 
    prompt: 'When facing a challenging task, I tend to:', 
    helper: null, 
    options: [
      { value: 'procrastinate', label: 'Put it off until later' },
      { value: 'dive_in', label: 'Jump right in immediately' },
      { value: 'plan_extensively', label: 'Plan extensively before starting' },
      { value: 'seek_help', label: 'Ask others for guidance' }
    ],
    active: true, 
    locale: 'en', 
    order_hint: 1,
    theme_weights: { anxiety: 0.8, perfectionism: 0.6 },
  },
  {
    id: 'S2_Q2', 
    stage: 2, 
    type: 'single_choice', 
    prompt: 'When I make a mistake, I usually:', 
    helper: 'Think about your typical emotional response', 
    options: [
      { value: 'brush_off', label: 'Brush it off and move on' },
      { value: 'learn_from_it', label: 'Try to learn from it' },
      { value: 'criticize_self', label: 'Criticize myself harshly' },
      { value: 'blame_others', label: 'Look for external causes' }
    ],
    active: true, 
    locale: 'en', 
    order_hint: 2,
    theme_weights: { self_criticism: 0.9 },
  },
  {
    id: 'S2_Q3', 
    stage: 2, 
    type: 'single_choice', 
    prompt: 'In social situations, I most often:', 
    helper: null, 
    options: [
      { value: 'lead_conversation', label: 'Take the lead in conversations' },
      { value: 'listen_support', label: 'Listen and offer support' },
      { value: 'observe_quietly', label: 'Observe quietly from the sidelines' },
      { value: 'make_people_laugh', label: 'Try to make people laugh' }
    ],
    active: true, 
    locale: 'en', 
    order_hint: 3,
    theme_weights: { relational: 0.7, caretaking: 0.5 },
  },
  {
    id: 'S2_Q4', 
    stage: 2, 
    type: 'single_choice', 
    prompt: 'When things feel out of my control:', 
    helper: 'Consider your typical coping strategies', 
    options: [
      { value: 'take_charge', label: 'I try to take charge of the situation' },
      { value: 'find_safe_space', label: 'I find a safe space to retreat to' },
      { value: 'seek_reassurance', label: 'I seek reassurance from others' },
      { value: 'distract_myself', label: 'I distract myself with other activities' }
    ],
    active: true, 
    locale: 'en', 
    order_hint: 4,
    theme_weights: { control: 0.6, safety: 0.4 },
  },
  {
    id: 'S2_Q5', 
    stage: 2, 
    type: 'single_choice', 
    prompt: 'My relationship with achievement is:', 
    helper: null, 
    options: [
      { value: 'driven_success', label: 'I am driven to succeed at all costs' },
      { value: 'balanced_effort', label: 'I put in balanced effort' },
      { value: 'avoid_failure', label: 'I often avoid situations where I might fail' },
      { value: 'restless_more', label: 'I feel restless and always want more' }
    ],
    active: true, 
    locale: 'en', 
    order_hint: 5,
    theme_weights: { achievement: 0.8, restlessness: 0.4 },
  },
];

/**
 * Preset answer combinations for quick testing
 */
export const ANSWER_PRESETS = {
  'perfectionism_anxiety': {
    name: 'Perfectionism & Anxiety',
    description: 'High scores in perfectionism, anxiety, and self-criticism themes',
    answers: DEV_STAGE_1_ANSWERS,
  },
  'relational_caretaking': {
    name: 'Relational & Caretaking', 
    description: 'Focus on relationships and taking care of others',
    answers: {
      S1_Q1: { type: 'single_choice', value: 'seek_reassurance' },
      S1_Q2: { type: 'single_choice', value: 'people_please' },
      S1_Q3: { type: 'single_choice', value: 'avoid_conflict' },
    },
  },
  'control_safety': {
    name: 'Control & Safety',
    description: 'High need for control and safety',
    answers: {
      S1_Q1: { type: 'single_choice', value: 'take_control' },
      S1_Q2: { type: 'single_choice', value: 'plan_everything' },
      S1_Q3: { type: 'single_choice', value: 'avoid_risks' },
    },
  },
} as const;

export type PresetKey = keyof typeof ANSWER_PRESETS | 'custom';

export function makeThemeScores(partial: Partial<ThemeScores>): ThemeScores {
  const base: ThemeScores = {
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
  return { ...base, ...partial };
}
