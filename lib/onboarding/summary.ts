import type { SupabaseClient } from '@supabase/supabase-js'

import questionsConfig from '@/config/onboarding-questions.json'

import {
  computeStage1Scores,
  summarizeScores,
} from './scoring'
import { getPartHypothesis } from './part-hypotheses'
import { QuestionResponse as QuestionResponseSchema } from './types'
import type {
  CompletionSummary,
  OnboardingQuestion,
  QuestionResponse,
  Theme,
} from './types'
import type { Database } from '@/lib/types/database'

const THEME_LABELS: Record<Theme, string> = {
  achievement: 'Achievement energy',
  perfectionism: 'Refinement & precision',
  self_criticism: 'Inner critic vigilance',
  relational: 'Relational attunement',
  conflict_avoidance: 'Harmony seeking',
  caretaking: 'Caretaking instinct',
  safety: 'Safety planning',
  control: 'Control & preparedness',
  anxiety: 'Anxiety signals',
  avoidance: 'Avoidance impulse',
  overwhelm: 'Overwhelm sensitivity',
  independence: 'Independence streak',
  restlessness: 'Restless drive',
  shame: 'Shame sensitivity',
}

const questionMap = new Map<string, OnboardingQuestion>(
  (questionsConfig.questions as OnboardingQuestion[]).map(q => [q.id, q])
)

const FALLBACK_SUMMARY: CompletionSummary = {
  sentences: [
    'Thank you for sharing your onboarding reflections. We will keep integrating what you offered.',
  ],
  themes: [],
  parts: [],
  somatic: [],
  core_belief: null,
  mistake_reflex: null,
  least_trusted_feeling: null,
}

export async function buildOnboardingSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CompletionSummary> {
  try {
    const { data: responses, error } = await supabase
      .from('onboarding_responses')
      .select('question_id, stage, response')
      .eq('user_id', userId)
      .in('stage', [1, 2, 3])

    if (error || !responses) {
      console.warn('buildOnboardingSummary: failed to fetch responses', error)
      return FALLBACK_SUMMARY
    }

    const stage1Snapshot: Record<string, QuestionResponse> = {}
    const stage2: Array<{ question_id: string; response: QuestionResponse }> = []
    const stage3: Record<string, QuestionResponse> = {}

    for (const row of responses) {
      if (!row || typeof row !== 'object') continue

      const record = row as Record<string, unknown>
      const questionId = typeof record.question_id === 'string' ? record.question_id : null
      const stage = typeof record.stage === 'number' ? record.stage : null
      const parsedResponse = QuestionResponseSchema.safeParse(record.response)

      if (!questionId || stage === null || !parsedResponse.success) {
        console.warn('buildOnboardingSummary: skipping malformed response row', {
          question_id: questionId,
          stage,
        })
        continue
      }

      const response = parsedResponse.data

      if (stage === 1) {
        stage1Snapshot[questionId] = response
      } else if (stage === 2) {
        stage2.push({ question_id: questionId, response })
      } else if (stage === 3) {
        stage3[questionId] = response
      }
    }

    const stage1Scores = computeStage1Scores(stage1Snapshot)
    const summaryMeta = summarizeScores(stage1Scores)

    const themes = summaryMeta.top_themes.map(theme => ({
      id: theme,
      label: THEME_LABELS[theme],
      score: Math.round(stage1Scores[theme] * 100),
    }))

    const partInsights = stage2
      .map(({ question_id: questionId, response }) => {
        if (!questionId || response.type !== 'single_choice') return null
        const question = questionMap.get(questionId)
        return getPartHypothesis(question, response.value)
      })
      .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight))

    const somaticLabels = (() => {
      const somatic = stage3['S3_Q1']
      if (!somatic || somatic.type !== 'multi_select') return []
      const question = questionMap.get('S3_Q1')
      if (!question) return somatic.values
      return somatic.values
        .map(value => question.options.find(opt => opt.value === value)?.label || value)
    })()

    const coreBelief = (() => {
      const item = stage3['S3_Q2']
      return item && item.type === 'free_text' && item.text.trim().length > 0
        ? item.text.trim()
        : null
    })()

    const mistakeReflex = (() => {
      const item = stage3['S3_Q3']
      return item && item.type === 'free_text' && item.text.trim().length > 0
        ? item.text.trim()
        : null
    })()

    const leastTrustedFeeling = (() => {
      const item = stage3['S3_Q4']
      if (!item || item.type !== 'single_choice') return null
      const question = questionMap.get('S3_Q4')
      if (!question) return item.value
      return question.options.find(opt => opt.value === item.value)?.label || item.value
    })()

    const sentences = buildSummarySentences(themes, partInsights)

    return {
      sentences,
      themes,
      parts: partInsights,
      somatic: somaticLabels,
      core_belief: coreBelief,
      mistake_reflex: mistakeReflex,
      least_trusted_feeling: leastTrustedFeeling,
    }
  } catch (error) {
    console.warn('buildOnboardingSummary: unexpected failure', error)
    return FALLBACK_SUMMARY
  }
}

function buildSummarySentences(
  themes: CompletionSummary['themes'],
  parts: CompletionSummary['parts'],
): string[] {
  const sentences: string[] = []

  const themePhrase = formatThemePhrase(themes)
  if (themePhrase) {
    sentences.push(
      `Thank you for pausing with us. Your responses show ${themePhrase} moving in your system today.`,
    )
  } else {
    sentences.push('Thank you for pausing with us. Your system offered thoughtful signals to work with.')
  }

  if (parts.length > 0) {
    const partNames = unique(parts.map(part => part.name))
    const partList = formatList(partNames)
    const firstIntention = parts[0]?.intention
    const intentionSuffix = firstIntention ? ` — ${firstIntention}` : ''
    sentences.push(
      `We noticed protectors like ${partList} doing their best${intentionSuffix}.`,
    )
  }

  sentences.push('We will keep integrating these insights together with curiosity and compassion.')

  return sentences.slice(0, 3)
}

function formatThemePhrase(themes: CompletionSummary['themes']): string | null {
  if (!themes.length) return null
  const meaningful = themes.filter(theme => theme.score >= 20)
  const toUse = meaningful.length > 0 ? meaningful : themes.slice(0, 2)
  const labels = toUse.map(theme => theme.label.toLowerCase())
  if (!labels.length) return null
  const phrase = `${formatList(labels)} energy`.replace('energy energy', 'energy')
  return phrase
}

function formatList(items: string[]): string {
  const uniqueItems = unique(items)
  if (uniqueItems.length === 0) return ''
  if (uniqueItems.length === 1) return uniqueItems[0]
  if (uniqueItems.length === 2) return `${uniqueItems[0]} and ${uniqueItems[1]}`
  return `${uniqueItems.slice(0, -1).join(', ')}, and ${uniqueItems[uniqueItems.length - 1]}`
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}
