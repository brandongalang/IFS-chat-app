'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// The user-facing labels and their corresponding values.
const ratingOptions: { value: number; id: string; label: string }[] = [
  { value: 1, id: 'strongly_disagree', label: 'Strongly Disagree' },
  { value: 2, id: 'somewhat_disagree', label: 'Somewhat Disagree' },
  { value: 3, id: 'somewhat_agree', label: 'Somewhat Agree' },
  { value: 4, id: 'strongly_agree', label: 'Strongly Agree' },
]

export interface RatingControlProps {
  // The currently selected rating value (1-4).
  value?: number
  // Callback invoked when the user selects a new rating.
  onChange: (value: number) => void
}

export function RatingControl({ value, onChange }: RatingControlProps) {
  // The `onValueChange` from RadioGroup provides a string, so we parse it.
  const handleValueChange = (stringValue: string) => {
    const numericValue = parseInt(stringValue, 10)
    if (!isNaN(numericValue)) {
      onChange(numericValue)
    }
  }

  return (
    <RadioGroup
      value={value?.toString()}
      onValueChange={handleValueChange}
      className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4"
      aria-label="Insight Rating"
    >
      {ratingOptions.map((option) => (
        <div key={option.id} className="flex items-center space-x-2">
          <RadioGroupItem value={option.value.toString()} id={option.id} />
          <Label htmlFor={option.id} className="cursor-pointer">
            {option.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}
