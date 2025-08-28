"use client"

import React from 'react'
import type { TaskEvent } from '@/types/chat'

// Attempt to import the AI Elements Task component. If types differ, we treat it as any.
// This assumes the AI SDK exposes the Task element; if not, we can later swap this to the
// installed AI Elements component via the registry.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let ImportedTask: any
try {
  // @ts-ignore - runtime import; types may not be available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ImportedTask = require('ai/elements').Task
} catch {
  ImportedTask = null
}

interface TaskListProps {
  tasks: TaskEvent[] | undefined
}

export function TaskList({ tasks }: TaskListProps) {
  if (!tasks || tasks.length === 0) return null

  // Fallback renderer if AI Elements Task is not available
  if (!ImportedTask) {
    return (
      <div className="space-y-2" data-testid="task-list-fallback">
        {tasks.map((t) => (
          <div key={t.id} className="border border-border rounded-md p-2 text-sm bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-muted-foreground">{t.status}{typeof t.progress === 'number' ? ` · ${t.progress}%` : ''}</span>
            </div>
            {t.details ? (
              <div className="mt-1 text-muted-foreground text-xs">
                {Array.isArray(t.details) ? t.details.join(' ') : t.details}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  const TaskComp = ImportedTask as any

  return (
    <div className="space-y-2" data-testid="task-list">
      {tasks.map((t) => (
        <TaskComp key={t.id} title={t.title} status={t.status} progress={t.progress} details={t.details} meta={t.meta} />
      ))}
    </div>
  )
}

