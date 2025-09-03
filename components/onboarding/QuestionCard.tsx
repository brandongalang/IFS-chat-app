"use client"

import { useId } from 'react'
import type { OnboardingQuestion, QuestionResponse } from '@/lib/onboarding/types'

export function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: OnboardingQuestion
  value?: QuestionResponse
  onChange: (response: QuestionResponse) => void
}) {
  const baseId = useId()
  const labelId = `${baseId}-label`
  const helpId = `${baseId}-help`

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 id={labelId} className="font-medium">
            {question.prompt}
          </h3>
          {question.helper ? (
            <p id={helpId} className="mt-1 text-xs text-muted-foreground">
              {question.helper}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3" aria-labelledby={labelId} aria-describedby={question.helper ? helpId : undefined}>
        {renderInput(question, value, onChange)}
      </div>
    </div>
  )
}

function renderInput(
  question: OnboardingQuestion,
  value: QuestionResponse | undefined,
  onChange: (r: QuestionResponse) => void
) {
  switch (question.type) {
    case 'single_choice': {
      const v = value?.type === 'single_choice' ? value.value : ''
      return (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={v === opt.value}
                onChange={() => onChange({ type: 'single_choice', value: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )
    }
    case 'multi_select': {
      const selected = value?.type === 'multi_select' ? new Set(value.values) : new Set<string>()
      return (
        <div className="space-y-2">
          {question.options.map((opt) => {
            const checked = selected.has(opt.value)
            return (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`${question.id}[]`}
                  value={opt.value}
                  checked={checked}
                  onChange={() => {
                    const next = new Set(selected)
                    if (checked) next.delete(opt.value)
                    else next.add(opt.value)
                    onChange({ type: 'multi_select', values: Array.from(next) })
                  }}
                />
                <span>{opt.label}</span>
              </label>
            )
          })}
        </div>
      )
    }
    case 'likert5': {
      const v = value?.type === 'likert5' ? value.value : 0
      return (
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 5].map(n => (
            <label key={n} className="flex cursor-pointer items-center gap-1 text-sm">
              <input
                type="radio"
                name={question.id}
                value={n}
                checked={v === n}
                onChange={() => onChange({ type: 'likert5', value: n })}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
      )
    }
    case 'free_text': {
      const text = value?.type === 'free_text' ? value.text : ''
      return (
        <textarea
          className="w-full resize-y rounded border p-2 text-sm"
          rows={4}
          value={text}
          onChange={(e) => onChange({ type: 'free_text', text: e.target.value })}
          maxLength={500}
        />
      )
    }
    default:
      return null
  }
}
