"use client"

import React from 'react'
import type { TaskEvent } from '@/types/chat'

interface TaskListProps {
  tasks: TaskEvent[] | undefined
}

export function TaskList({ tasks }: TaskListProps) {
  const [TaskComp, setTaskComp] = React.useState<any | null>(null)

  React.useEffect(() => {
    let mounted = true
    import('ai/elements')
      .then((mod: any) => {
        if (!mounted) return
        setTaskComp(() => mod.Task || null)
      })
      .catch(() => setTaskComp(null))
    return () => {
      mounted = false
    }
  }, [])

  if (!tasks || tasks.length === 0) return null

  if (!TaskComp) {
    // Fallback renderer if AI Elements Task is not available
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

  return (
    <div className="space-y-2" data-testid="task-list">
      {tasks.map((t) => (
        <TaskComp key={t.id} title={t.title} status={t.status} progress={t.progress} details={t.details} meta={t.meta} />
      ))}
    </div>
  )
}

