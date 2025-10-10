"use client"

import type { HTMLAttributes } from "react"

import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import { cn } from "@/lib/utils"
import type { TaskEvent } from "@/types/chat"

type ToolState = `input-${string}` | `output-${string}` | `error-${string}` | string

function getProgressData(progress?: number): { value?: number; label?: string } {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return { value: undefined, label: undefined }
  }

  const value = Math.min(100, Math.max(0, progress))
  return { value, label: `${Math.round(value)}%` }
}

function toolStateForTask(task: TaskEvent): ToolState {
  const metaState = typeof task.meta?.toolState === "string" ? task.meta.toolState : undefined
  if (metaState) return metaState
  switch (task.status) {
    case "completed":
      return "output-available"
    case "failed":
      return "output-error"
    case "canceled":
      return "output-error"
    case "pending":
      return "input-available"
    default:
      return "input-streaming"
  }
}

function statusLabelForTask(task: TaskEvent): string {
  switch (task.status) {
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    case "canceled":
      return "canceled"
    case "pending":
      return "pending"
    default:
      return "working"
  }
}

export interface TaskListProps extends HTMLAttributes<HTMLDivElement> {
  tasks: TaskEvent[] | undefined
  itemClassName?: string
  statusClassName?: string
  progressTrackClassName?: string
  progressBarClassName?: string
}

export function TaskList({
  tasks,
  className,
  itemClassName,
  statusClassName,
  progressTrackClassName = "bg-white/15",
  progressBarClassName = "bg-white",
  ...props
}: TaskListProps) {
  if (!tasks || tasks.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {tasks.map((task) => {
        const toolState = toolStateForTask(task)
        const statusLabel = statusLabelForTask(task)
        const { value: progressValue, label: progressLabel } = getProgressData(task.progress)
        const statusCopy = typeof task.meta?.statusCopy === "string" ? task.meta.statusCopy : undefined
        const detailItems = Array.isArray(task.details)
          ? task.details.filter((detail): detail is string => typeof detail === "string" && detail.length > 0)
          : typeof task.details === "string" && task.details.length > 0
          ? [task.details]
          : []
        const files = Array.isArray(task.meta?.files) ? task.meta.files : undefined
        const hasFiles = Array.isArray(files) && files.length > 0
        const showProgress = progressValue !== undefined
        const showDetails = detailItems.length > 0
        const showStatusCopy = Boolean(statusCopy)
        const showContent = showProgress || showDetails || hasFiles || showStatusCopy

        return (
          <Tool
            key={task.id}
            className={cn(
              "rounded-xl border border-white/15 bg-white/10 text-white",
              itemClassName,
            )}
          >
            <div className="flex items-center gap-3 px-3 pt-3">
              <ToolHeader
                type="tool"
                state={toolState}
                title={task.title ?? "Tool"}
                className="flex-1 p-0 text-white"
              />
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[0.18em] text-white/70",
                  statusClassName,
                )}
              >
                {statusLabel}
              </span>
            </div>
            {showContent ? (
              <div className="space-y-2 px-3 pb-3">
                {showStatusCopy ? (
                  <p className="text-xs leading-4 text-white/70">{statusCopy}</p>
                ) : null}
                {showProgress ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/60">
                      <span>Progress</span>
                      <span>{progressLabel}</span>
                    </div>
                    <div
                      className={cn("h-1.5 w-full overflow-hidden rounded-full", progressTrackClassName)}
                      role="progressbar"
                      aria-valuenow={progressValue !== undefined ? Math.round(progressValue) : undefined}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={cn("h-full transition-[width] duration-300", progressBarClassName)}
                        style={{ width: `${progressValue ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {showDetails
                  ? detailItems.map((detail, index) => (
                      <p
                        key={index}
                        className={cn(
                          "text-sm leading-5 text-white/85",
                          task.status === "failed" ? "text-red-200" : undefined,
                        )}
                      >
                        {detail}
                      </p>
                    ))
                  : null}
                {hasFiles ? (
                  <div className="flex flex-wrap gap-2">
                    {files?.map((file, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/85"
                      >
                        {file?.name ?? "file"}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Tool>
        )
      })}
    </div>
  )
}
