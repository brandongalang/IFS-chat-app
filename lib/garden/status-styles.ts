/**
 * Status-based styling for garden cards
 * Maps part.status to visual properties that convey lifecycle stage
 */

import type { PartStatus, PartCategory } from '@/lib/types/database'

export interface StatusStyle {
  background: string
  border: string
  emojiOpacity: string
  accentColor: string
  label: string
  description: string
}

export const statusStyles: Readonly<Record<PartStatus, StatusStyle>> = Object.freeze({
  emerging: {
    background: 'bg-card/20',
    border: 'border-border/30',
    emojiOpacity: 'opacity-60',
    accentColor: 'text-amber-300',
    label: 'Newly discovered',
    description: 'Newly discovered — learning about this part',
  },
  acknowledged: {
    background: 'bg-card/35',
    border: 'border-border/40',
    emojiOpacity: 'opacity-75',
    accentColor: 'text-blue-300',
    label: 'Learning about',
    description: 'Recognized presence — building understanding',
  },
  active: {
    background: 'bg-card/50',
    border: 'border-border/50',
    emojiOpacity: 'opacity-100',
    accentColor: 'text-emerald-300',
    label: 'Actively present',
    description: 'Actively present — part of your daily awareness',
  },
  integrated: {
    background: 'bg-card/60',
    border: 'border-border/60',
    emojiOpacity: 'opacity-100',
    accentColor: 'text-purple-300',
    label: 'Well integrated',
    description: 'Well integrated — harmonious role in the system',
  },
})

export function getStatusStyle(status: PartStatus): StatusStyle {
  return statusStyles[status]
}

export const categoryColors: Readonly<Record<PartCategory | 'unknown', string>> = Object.freeze({
  manager: 'bg-violet-900/40 text-violet-300 border-violet-700/40',
  firefighter: 'bg-red-900/40 text-red-300 border-red-700/40',
  exile: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  unknown: 'bg-gray-800/40 text-gray-400 border-gray-700/40',
})

export function getCategoryColor(category: PartCategory | 'unknown'): string {
  return categoryColors[category] || categoryColors.unknown
}
