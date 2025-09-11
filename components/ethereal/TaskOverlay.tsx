"use client"

import React, { useMemo } from "react"
import { useChat } from "@/hooks/useChat"
import type { TaskEvent } from "@/types/chat"
import { Task as TaskBase, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from "@/components/ai-elements/task"

interface MetaWithFiles {
  files: { name: string }[]
}

export function TaskOverlay() {
  const { tasksByMessage } = useChat()

  const activeTasks: TaskEvent[] = useMemo(() => {
    if (!tasksByMessage) return []
    return Object.values(tasksByMessage)
      .flat()
      .filter((t) => t.status !== "completed")
  }, [tasksByMessage])

  if (activeTasks.length === 0) return null

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-72 flex-col gap-2">
      {activeTasks.map((t) => (
        <TaskBase key={t.id} defaultOpen={false} className="pointer-events-auto">
          <TaskTrigger
            title={`${t.title}${typeof t.progress === "number" ? " · " + t.progress + "%" : ""} (${t.status})`}
          />
          {t.details ? (
            <TaskContent>
              {Array.isArray(t.details)
                ? t.details.map((d, i) => <TaskItem key={i}>{d}</TaskItem>)
                : <TaskItem>{t.details}</TaskItem>}
              {t.meta && Array.isArray((t.meta as MetaWithFiles)?.files) && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {(t.meta as MetaWithFiles).files.map((f: { name: string }, i: number) => (
                    <TaskItemFile key={i}>{f?.name ?? "file"}</TaskItemFile>
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

export default TaskOverlay
