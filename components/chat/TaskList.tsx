"use client"

import React from 'react'
import type { TaskEvent } from '@/types/chat'
import { Task as TaskBase, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from '@/components/ai-elements/task'

interface TaskListProps {
  tasks: TaskEvent[] | undefined
}

export function TaskList({ tasks }: TaskListProps) {
  if (!tasks || tasks.length === 0) return null

  return (
    <div className="space-y-2" data-testid="task-list">
      {tasks.map((t) => (
        <TaskBase key={t.id} defaultOpen={t.status !== 'completed'}>
          <TaskTrigger title={`${t.title}${typeof t.progress === 'number' ? ` · ${t.progress}%` : ''} (${t.status})`} />
          {t.details ? (
            <TaskContent>
              {Array.isArray(t.details) ? (
                t.details.map((d, i) => (
                  <TaskItem key={i}>{d}</TaskItem>
                ))
              ) : (
                <TaskItem>{t.details}</TaskItem>
              )}
              {t.meta && Array.isArray((t.meta as any).files) && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {((t.meta as any).files as Array<{ name: string }>).map((f, i) => (
                    <TaskItemFile key={i}>{f.name}</TaskItemFile>
                  ))}
                </div>
              )}
            </TaskContent>
          ) : null}
        </TaskBase>
      ))}
    </div>
  )
}

