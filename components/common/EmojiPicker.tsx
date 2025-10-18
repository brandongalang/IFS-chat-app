'use client'

import { cn } from '@/lib/utils'

interface EmojiPickerProps {
  selectedEmoji: string
  onSelect: (emoji: string) => void
}

const curatedEmojis = [
  '🤗', '🛡️', '😥', '💡', '❤️‍🩹', '😠', 'ängstlich', '👶',
  '🤔', '🧐', '🥰', '😴', '🤯', '😑', '😮', '😨',
  '😡', '🤡', '🤖', '👻', '👑', '💎', '💪', '🙏',
]

export function EmojiPicker({ selectedEmoji, onSelect }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {curatedEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className={cn(
            'text-2xl p-2 rounded-md hover:bg-accent',
            selectedEmoji === emoji ? 'bg-accent ring-2 ring-primary' : 'bg-transparent'
          )}
          aria-label={`Select emoji: ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
