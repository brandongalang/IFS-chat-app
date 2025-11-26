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
    background: 'bg-orange-50',
    border: 'border-orange-200',
    emojiOpacity: 'opacity-60',
    accentColor: 'text-amber-600',
    label: 'Newly discovered',
    description: 'Newly discovered — learning about this part',
  },
  acknowledged: {
    background: 'bg-blue-50',
    border: 'border-blue-200',
    emojiOpacity: 'opacity-75',
    accentColor: 'text-blue-600',
    label: 'Learning about',
    description: 'Recognized presence — building understanding',
  },
  active: {
    background: 'bg-emerald-50',
    border: 'border-emerald-200',
    emojiOpacity: 'opacity-100',
    accentColor: 'text-emerald-600',
    label: 'Actively present',
    description: 'Actively present — part of your daily awareness',
  },
  integrated: {
    background: 'bg-purple-50',
    border: 'border-purple-200',
    emojiOpacity: 'opacity-100',
    accentColor: 'text-purple-600',
    label: 'Well integrated',
    description: 'Well integrated — harmonious role in the system',
  },
})

export function getStatusStyle(status: PartStatus): StatusStyle {
  return statusStyles[status]
}

export const categoryColors: Readonly<Record<PartCategory | 'unknown', string>> = Object.freeze({
  manager: 'bg-violet-100 text-violet-700 border-violet-300',
  firefighter: 'bg-red-100 text-red-700 border-red-300',
  exile: 'bg-blue-100 text-blue-700 border-blue-300',
  unknown: 'bg-gray-100 text-gray-600 border-gray-300',
})

export function getCategoryColor(category: PartCategory | 'unknown'): string {
  return categoryColors[category] || categoryColors.unknown
}
