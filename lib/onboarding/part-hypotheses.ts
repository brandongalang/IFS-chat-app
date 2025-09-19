import type { OnboardingQuestion, PartTone } from './types'

export interface PartHypothesis {
  id: string
  name: string
  tone: PartTone
  focus: string
  intention: string
  evidence: string
}

interface PartBase {
  name: string
  tone: PartTone
  focus: string
}

const PART_BASES: Record<string, PartBase> = {
  S2_Q1: { name: 'Achiever', tone: 'manager', focus: 'Drive & ambition' },
  S2_Q2: { name: 'Inner Critic', tone: 'manager', focus: 'Standards & protection' },
  S2_Q3: { name: 'Caretaker', tone: 'manager', focus: 'Belonging & care' },
  S2_Q4: { name: 'Sentinel', tone: 'manager', focus: 'Safety & control' },
  S2_Q5: { name: 'Distractor', tone: 'firefighter', focus: 'Avoiding overload' },
  S2_Q6: { name: 'Gatekeeper', tone: 'manager', focus: 'Guarding vulnerability' },
  S2_Q7: { name: 'Soother', tone: 'firefighter', focus: 'Dampening overwhelm' },
  S2_Q8: { name: 'Solo Strategist', tone: 'manager', focus: 'Self-reliance' },
  S2_Q9: { name: 'After-Action Reviewer', tone: 'manager', focus: 'Learning from mistakes' },
  S2_Q10: { name: 'Rescuer', tone: 'manager', focus: 'Supporting others' },
  S2_Q11: { name: 'Taskmaster', tone: 'manager', focus: 'Constant momentum' },
  S2_Q12: { name: 'Peacemaker', tone: 'manager', focus: 'Keeping harmony' },
}

const PART_INTENTIONS: Record<string, Record<string, string>> = {
  S2_Q1: {
    love_challenge: 'Keeps you leaning into growth because challenge feels energizing.',
    prove_worth: 'Pushes to prove you are worthy in the eyes of yourself and others.',
    others_counting: 'Drives you to deliver because people are counting on you.',
    intolerance_mediocrity: 'Insists on excellence to prevent anything that feels mediocre.',
  },
  S2_Q2: {
    protect_judgment: 'Tries to shield you from judgment by spotting flaws first.',
    prevent_complacency: 'Warns against easing up so standards never slip.',
    fullest_potential: 'Demands you live up to your fullest potential every time.',
    prevent_catastrophe: 'Scans for catastrophe so nothing disastrous can happen.',
  },
  S2_Q3: {
    genuine_harmony: 'Nurtures genuine harmony so everyone feels connected.',
    everyone_included: 'Makes sure everyone feels seen and included.',
    avoid_conflict: 'Steps in to avoid conflict or disapproval at any cost.',
    feel_needed: 'Longs to feel needed and valued by the people around you.',
  },
  S2_Q4: {
    protect_pain: 'Plans ahead to protect you from future pain or disappointment.',
    protect_others: 'Carefully anticipates risks so others are kept safe.',
    maintain_control: 'Maintains order and control to keep situations manageable.',
    prevent_embarrassment: 'Prevents failure or embarrassment before it can land.',
  },
  S2_Q5: {
    needed_break: 'Throws up distractions so you can breathe before diving back in.',
    avoid_threatening: 'Stalls to dodge feelings that seem threatening or overwhelming.',
    rebel_expectations: 'Rebels when outside expectations feel too rigid or heavy.',
    conserve_energy: 'Conserves energy because the task ahead feels too big to face right now.',
  },
  S2_Q6: {
    relief: 'Savors the relief yet still stays alert in case letting go feels risky.',
    suspicion: 'Checks for hidden strings before fully trusting the support.',
    discomfort_burden: 'Worries about being a burden even as help arrives.',
    urge_repay: 'Looks for how to repay the help immediately to stay even.',
  },
  S2_Q7: {
    analyze_rationalize: 'Analyzes the emotion so it feels more rational and contained.',
    numb_shutdown: 'Numbs sensations so the wave of emotion does not crash as hard.',
    express_anger: 'Lets anger take the wheel so softer feelings stay protected.',
    seek_comfort: 'Grabs quick comfort so the system can settle for a moment.',
  },
  S2_Q8: {
    dont_trust_others: 'Convinces you that doing it yourself is the safest path.',
    avoid_vulnerability: 'Keeps tasks close so you do not feel exposed or dependent.',
    only_understand: 'Prefers to handle it because you understand every moving part.',
    fear_weakness: 'Avoids asking for help so no one can perceive weakness.',
  },
  S2_Q9: {
    motivate_better: 'Motivates you to do better next time by being blunt.',
    protect_judgment: 'Beats others to the punch so their criticism cannot sting.',
    express_disappointment: 'Vents disappointment that you missed your mark.',
    punish_failure: 'Comes down hard to prevent a similar mistake later.',
  },
  S2_Q10: {
    genuine_empathy: 'Moves quickly because empathy wants suffering to ease.',
    discomfort_pain: 'Acts so you do not have to sit with someone else’s pain.',
    responsible_wellbeing: 'Believes you are responsible for everyone’s wellbeing.',
    feel_useful: 'Leaps in to feel useful and needed by others.',
  },
  S2_Q11: {
    prove_worth: 'Equates constant productivity with proving your worth.',
    avoid_feelings: 'Keeps you busy so difficult feelings stay out of view.',
    stay_ahead: 'Stays two steps ahead so responsibilities never catch you off guard.',
    feel_control: 'Maintains momentum so you feel solidly in control.',
  },
  S2_Q12: {
    preserve_connection: 'Smooths tension to preserve connection and avoid abandonment.',
    maintain_image: 'Keeps the “easy” image so no one is disappointed.',
    avoid_discomfort: 'Eases distress quickly so emotional discomfort does not escalate.',
    keep_safe: 'Dials things down to keep everyone emotionally safe.',
  },
}

export function getPartHypothesis(
  question: OnboardingQuestion | undefined,
  optionValue: string,
): PartHypothesis | null {
  if (!question || question.stage !== 2 || question.type !== 'single_choice') return null

  const base = PART_BASES[question.id]
  if (!base) return null

  const option = question.options.find(opt => opt.value === optionValue)
  if (!option) return null

  const intentionMap = PART_INTENTIONS[question.id] ?? {}
  const intention = intentionMap[optionValue] ?? `Keeps you oriented toward ${option.label.toLowerCase()}.`

  return {
    id: `${question.id}:${optionValue}`,
    name: base.name,
    tone: base.tone,
    focus: base.focus,
    intention,
    evidence: option.label,
  }
}
