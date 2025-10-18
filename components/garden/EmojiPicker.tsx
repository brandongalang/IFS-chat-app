'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const QUICK_EMOJIS = [
  '😊', '😠', '😢', '😱', '🔥', '💪',
  '🤝', '🎭', '🛡️', '👹', '🌱', '✨',
  '🚀', '🎯', '💎', '🌊'
]

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  label?: string
}

export function EmojiPicker({ value, onChange, label }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="space-y-3">
      {label && <div className="text-sm font-medium">{label}</div>}
      
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div className="text-5xl">{value || '🤗'}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPicker(!showPicker)}
          className="ml-auto"
        >
          {showPicker ? 'Hide' : 'Pick'} Emoji
        </Button>
      </div>

      {/* Quick Select Grid */}
      {showPicker && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          <div className="grid grid-cols-4 gap-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji)
                  setShowPicker(false)
                }}
                className={cn(
                  'h-10 rounded-lg border transition-all duration-150 flex items-center justify-center text-2xl',
                  'hover:border-primary hover:bg-primary/10',
                  value === emoji ? 'border-primary bg-primary/20' : 'border-border/40'
                )}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Manual Input */}
          <div className="space-y-2 border-t pt-3">
            <label className="text-xs font-medium text-muted-foreground">
              Or paste custom emoji:
            </label>
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value.trim().slice(0, 2))}
              placeholder="Paste emoji here"
              maxLength={2}
              className="text-center"
            />
          </div>
        </div>
      )}
    </div>
  )
}
