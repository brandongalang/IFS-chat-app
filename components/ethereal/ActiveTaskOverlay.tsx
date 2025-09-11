"use client"

import type { TaskEvent } from "@/types/chat"
import { Task as TaskBase, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from "@/components/ai-elements/task"

interface ActiveTaskOverlayProps {
  tasks: TaskEvent[] | undefined
}

export function ActiveTaskOverlay({ tasks }: ActiveTaskOverlayProps) {
  if (!tasks || tasks.length === 0) return null

  return (
    <div className="space-y-2 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
      {tasks.map((t) => (
        <TaskBase key={t.id} defaultOpen={t.status !== "completed"}>
          <TaskTrigger title={`${t.title}${typeof t.progress === "number" ? " · " + t.progress + "%" : ""} (${t.status})`} />
          {t.details ? (
            <TaskContent>
              {Array.isArray(t.details) ? (
                t.details.map((d, i) => <TaskItem key={i}>{d}</TaskItem>)
              ) : (
                <TaskItem>{t.details}</TaskItem>
              )}
              {t.meta && Array.isArray((t.meta as any)?.files) && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {(t.meta as any).files.map((f: { name: string }, i: number) => (
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

