"use client"

import type { HTMLAttributes } from "react"

import { Task as TaskBase, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from "@/components/ai-elements/task"
import { cn } from "@/lib/utils"
import type { TaskEvent } from "@/types/chat"

function getProgressData(progress?: number): { value?: number; label?: string } {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return { value: undefined, label: undefined }
  }

  const value = Math.min(100, Math.max(0, progress))
  return { value, label: `${Math.round(value)}%` }
}

export interface TaskListProps extends HTMLAttributes<HTMLDivElement> {
  tasks: TaskEvent[] | undefined
  progressTrackClassName?: string
  progressBarClassName?: string
}

export function TaskList({
  tasks,
  progressTrackClassName = "bg-muted",
  progressBarClassName = "bg-primary",
  className,
  ...props
}: TaskListProps) {
  if (!tasks || tasks.length === 0) return null

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {tasks.map((t) => {
        const { value: progressValue, label: progressLabel } = getProgressData(t.progress)
        const statusLabel = t.status ?? "working"
        const triggerPieces = [t.title ?? "Task"]

        if (progressLabel) triggerPieces.push(`· ${progressLabel}`)

        const triggerTitle = `${triggerPieces.join(" ")} (${statusLabel})`
        const hasDetails = Array.isArray(t.details) ? t.details.length > 0 : Boolean(t.details)
        const hasFiles = Array.isArray(t.meta?.files) && t.meta.files.length > 0
        const showContent = hasDetails || hasFiles || progressValue !== undefined

        return (
          <TaskBase key={t.id} defaultOpen={t.status !== "completed"}>
            <TaskTrigger title={triggerTitle} />
            {showContent ? (
              <TaskContent>
                {progressValue !== undefined ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Progress</span>
                      <span>{progressLabel}</span>
                    </div>
                    <div
                      className={cn(
                        "h-1.5 w-full overflow-hidden rounded-full",
                        progressTrackClassName,
                      )}
                      role="progressbar"
                      aria-valuenow={Math.round(progressValue)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={cn("h-full transition-[width] duration-300", progressBarClassName)}
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {Array.isArray(t.details)
                  ? t.details.map((d, i) => <TaskItem key={i}>{d}</TaskItem>)
                  : t.details
                  ? <TaskItem>{t.details}</TaskItem>
                  : null}
                {hasFiles ? (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {t.meta?.files?.map((f, i) => (
                      <TaskItemFile key={i}>{f?.name ?? "file"}</TaskItemFile>
                    ))}
                  </div>
                ) : null}
              </TaskContent>
            ) : null}
          </TaskBase>
        )
      })}
    </div>
  )
}

