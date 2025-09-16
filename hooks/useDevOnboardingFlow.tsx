"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { OnboardingQuestion, QuestionResponse } from "@/lib/onboarding/types"
import { ANSWER_PRESETS, DEV_STAGE_2_QUESTION_BANK } from "@/lib/dev/fixtures"

const STAGE_1_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "S1_Q1",
    stage: 1,
    type: "single_choice",
    prompt: "When you share your work publicly, what typically comes up for you first?",
    helper: "Think about the immediate feelings or thoughts that arise",
    options: [
      { value: "surge_energy", label: "A surge of energy and excitement about reaching people" },
      { value: "methodical_checking", label: "Methodical checking and rechecking before posting" },
      { value: "wondering_reception", label: "Wondering how it will be received by others" },
      { value: "noticing_improvement", label: "Noticing everything that could be improved" },
    ],
    active: true,
    locale: "en",
    order_hint: 1,
    theme_weights: {},
  },
  {
    id: "S1_Q2",
    stage: 1,
    type: "single_choice",
    prompt: "When your plans get disrupted unexpectedly, what happens inside you?",
    helper: "Consider your inner response to sudden changes",
    options: [
      { value: "energized_possibilities", label: "I feel energized by new possibilities opening up" },
      { value: "protect_secure", label: "I need to protect what feels secure and familiar" },
      { value: "check_affected", label: "I check on others who might be affected by the change" },
      { value: "analyze_wrong", label: "I analyze what went wrong and how to prevent it next time" },
    ],
    active: true,
    locale: "en",
    order_hint: 2,
    theme_weights: {},
  },
  {
    id: "S1_Q3",
    stage: 1,
    type: "single_choice",
    prompt: "When someone you care about seems upset with you, what do you find yourself doing?",
    helper: "Think about your automatic response pattern",
    options: [
      { value: "give_space", label: "Give them space and wait for them to come to me" },
      { value: "directly_ask", label: "Ask directly what's wrong and how to fix it" },
      { value: "review_actions", label: "Review all my recent actions to see what I might have done" },
      { value: "focus_elsewhere", label: "Focus my attention elsewhere until things settle" },
    ],
    active: true,
    locale: "en",
    order_hint: 3,
    theme_weights: {},
  },
]

const STAGE_2_QUESTIONS = DEV_STAGE_2_QUESTION_BANK.slice(0, 4)

const STAGE_3_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "S3_Q1",
    stage: 3,
    type: "free_text",
    prompt:
      "When you think about the parts of yourself that get activated under stress, what do you notice they are trying to protect you from?",
    helper: "Take a moment to reflect on what your protective parts are guarding against",
    options: [],
    active: true,
    locale: "en",
    order_hint: 1,
    theme_weights: {},
  },
  {
    id: "S3_Q2",
    stage: 3,
    type: "free_text",
    prompt: "What beliefs do you carry about yourself that might have formed during difficult times in your life?",
    helper: "These might be thoughts like \"I'm not good enough\" or \"I have to be perfect\"",
    options: [],
    active: true,
    locale: "en",
    order_hint: 2,
    theme_weights: {},
  },
  {
    id: "S3_Q3",
    stage: 3,
    type: "free_text",
    prompt: "Where in your body do you tend to feel stress, tension, or difficult emotions?",
    helper: "This could be your shoulders, stomach, chest, or anywhere else you notice sensations",
    options: [],
    active: true,
    locale: "en",
    order_hint: 3,
    theme_weights: {},
  },
  {
    id: "S3_Q4",
    stage: 3,
    type: "free_text",
    prompt: "If you could offer a compassionate message to the parts of yourself that struggle, what would you say?",
    helper: "Imagine speaking to these parts like you would to a good friend who is going through a hard time",
    options: [],
    active: true,
    locale: "en",
    order_hint: 4,
    theme_weights: {},
  },
]

const TOTAL_QUESTION_COUNT =
  STAGE_1_QUESTIONS.length + STAGE_2_QUESTIONS.length + STAGE_3_QUESTIONS.length

interface StageConfig {
  questions: OnboardingQuestion[]
  renderQuestion: (question: OnboardingQuestion) => ReactNode
}

type RecordAnswerFn = (
  question: OnboardingQuestion,
  response: QuestionResponse,
  questionCount: number
) => void

export function useDevOnboardingFlow() {
  const [currentStage, setCurrentStage] = useState(1)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({})
  const [isComplete, setIsComplete] = useState(false)

  const recordAnswer = useCallback<RecordAnswerFn>(
    (question, response, questionCount) => {
      setAnswers((prev) => ({ ...prev, [question.id]: response }))

      setTimeout(() => {
        setCurrentQuestionIndex((prevIndex) => {
          if (prevIndex < questionCount - 1) {
            return prevIndex + 1
          }

          if (currentStage === 1) {
            setCurrentStage(2)
            return 0
          }

          if (currentStage === 2) {
            setCurrentStage(3)
            return 0
          }

          setIsComplete(true)
          return prevIndex
        })
      }, 500)
    },
    [currentStage]
  )

  const stageOne = useSingleChoiceStage(STAGE_1_QUESTIONS, answers, recordAnswer)
  const stageTwo = useSingleChoiceStage(STAGE_2_QUESTIONS, answers, recordAnswer)
  const stageThree = useFreeTextStage(STAGE_3_QUESTIONS, answers, recordAnswer)

  const stageConfig = useMemo(
    () => ({
      1: stageOne,
      2: stageTwo,
      3: stageThree,
    }),
    [stageOne, stageTwo, stageThree]
  )

  const stage = stageConfig[currentStage as keyof typeof stageConfig]
  const currentQuestion = stage?.questions[currentQuestionIndex]
  const totalQuestions = stage?.questions.length ?? 0
  const questionContent = currentQuestion ? stage.renderQuestion(currentQuestion) : null

  const answeredCount = Object.keys(answers).length
  const progress = isComplete ? 100 : Math.min((answeredCount / TOTAL_QUESTION_COUNT) * 100, 100)

  const resetFlow = useCallback(() => {
    setAnswers({})
    setCurrentStage(1)
    setCurrentQuestionIndex(0)
    setIsComplete(false)
  }, [])

  const loadPreset = useCallback((presetKey: string) => {
    const preset = ANSWER_PRESETS[presetKey as keyof typeof ANSWER_PRESETS]
    if (!preset) return

    setAnswers(preset.answers)
    setCurrentStage(2)
    setCurrentQuestionIndex(0)
    setIsComplete(false)
  }, [])

  useEffect(() => {
    if (!isComplete || totalQuestions === 0) return
    setCurrentQuestionIndex((index) => Math.max(0, Math.min(index, totalQuestions - 1)))
  }, [isComplete, totalQuestions])

  return {
    currentStage,
    currentQuestionIndex,
    currentQuestion,
    totalQuestions,
    questionContent,
    answers,
    isComplete,
    progress,
    totalStages: 3,
    actions: {
      resetFlow,
      loadPreset,
    },
  }
}

function useSingleChoiceStage(
  questions: OnboardingQuestion[],
  answers: Record<string, QuestionResponse>,
  recordAnswer: RecordAnswerFn
): StageConfig {
  const handleSelect = useCallback(
    (question: OnboardingQuestion, value: string) => {
      recordAnswer(question, { type: "single_choice", value }, questions.length)
    },
    [questions.length, recordAnswer]
  )

  const renderQuestion = useCallback<StageConfig["renderQuestion"]>(
    (question) => (
      <SingleChoiceQuestion
        key={question.id}
        question={question}
        selectedValue={getSelectedValue(answers, question.id)}
        onSelect={(value) => handleSelect(question, value)}
      />
    ),
    [answers, handleSelect]
  )

  return useMemo(
    () => ({
      questions,
      renderQuestion,
    }),
    [questions, renderQuestion]
  )
}

function useFreeTextStage(
  questions: OnboardingQuestion[],
  answers: Record<string, QuestionResponse>,
  recordAnswer: RecordAnswerFn
): StageConfig {
  const handleSubmit = useCallback(
    (question: OnboardingQuestion, text: string) => {
      recordAnswer(question, { type: "free_text", text: text.trim() }, questions.length)
    },
    [questions.length, recordAnswer]
  )

  const renderQuestion = useCallback<StageConfig["renderQuestion"]>(
    (question) => (
      <FreeTextQuestion
        key={question.id}
        question={question}
        existingValue={getFreeTextValue(answers, question.id)}
        onSubmit={(text) => handleSubmit(question, text)}
      />
    ),
    [answers, handleSubmit]
  )

  return useMemo(
    () => ({
      questions,
      renderQuestion,
    }),
    [questions, renderQuestion]
  )
}

interface SingleChoiceQuestionProps {
  question: OnboardingQuestion
  selectedValue: string
  onSelect: (value: string) => void
}

function SingleChoiceQuestion({ question, selectedValue, onSelect }: SingleChoiceQuestionProps) {
  return (
    <RadioGroup value={selectedValue} onValueChange={onSelect}>
      <div className="space-y-3">
        {question.options.map((option) => (
          <div
            key={option.value}
            className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
            <Label htmlFor={`${question.id}-${option.value}`} className="cursor-pointer flex-1 leading-relaxed">
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    </RadioGroup>
  )
}

interface FreeTextQuestionProps {
  question: OnboardingQuestion
  existingValue: string
  onSubmit: (text: string) => void
}

function FreeTextQuestion({ question, existingValue, onSubmit }: FreeTextQuestionProps) {
  const [value, setValue] = useState(existingValue)

  useEffect(() => {
    setValue(existingValue)
  }, [existingValue])

  return (
    <div className="space-y-4">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Take your time to reflect and share your thoughts..."
        className="min-h-40 text-base leading-relaxed"
      />
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Take as much time as you need. There are no right or wrong answers.
        </p>
        <Button
          onClick={() => {
            if (!value.trim()) return
            onSubmit(value)
          }}
          className="ml-4"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

function getSelectedValue(answers: Record<string, QuestionResponse>, questionId: string) {
  const entry = answers[questionId]
  return entry && entry.type === "single_choice" ? entry.value : ""
}

function getFreeTextValue(answers: Record<string, QuestionResponse>, questionId: string) {
  const entry = answers[questionId]
  return entry && entry.type === "free_text" ? entry.text : ""
}

