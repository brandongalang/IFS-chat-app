"use client"

import type { HTMLAttributes } from "react"

import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import type { ToolHeaderProps } from "@/components/ai-elements/tool"
import { cn } from "@/lib/utils"
import type { TaskEvent } from "@/types/chat"

type ToolState = ToolHeaderProps["state"]
type ToolType = ToolHeaderProps["type"]

const TOOL_STATE_VALUES: { readonly [K in TaskEvent["status"]]: ToolState } = {
  completed: "output-available",
  failed: "output-error",
  canceled: "output-error",
  pending: "input-available",
  working: "input-streaming",
}

function normalizeToolState(rawState: unknown, fallbackStatus: TaskEvent["status"]): ToolState {
  if (typeof rawState === "string") {
    const normalized = rawState.toLowerCase()
    if (normalized === "output-error" || normalized.startsWith("error")) {
      return "output-error"
    }
    if (normalized === "output-available") {
      return "output-available"
    }
    if (normalized.startsWith("output")) {
      return "input-streaming"
    }
    if (normalized === "input-available") {
      return "input-available"
    }
    if (normalized === "input-streaming" || normalized.startsWith("input")) {
      return "input-streaming"
    }
  }

  return TOOL_STATE_VALUES[fallbackStatus] ?? "input-streaming"
}

function slugifyToolSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function typeForTask(task: TaskEvent): ToolType {
  const metaType = typeof task.meta?.toolType === "string" ? task.meta.toolType : undefined
  if (metaType && metaType.startsWith("tool-")) {
    return metaType as ToolType
  }

  const baseTitle = typeof task.title === "string" && task.title.trim().length > 0 ? task.title : "task"
  const segment = slugifyToolSegment(baseTitle)
  return (`tool-${segment || "task"}`) as ToolType
}

function getProgressData(progress?: number): { value?: number; label?: string } {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return { value: undefined, label: undefined }
  }

  const value = Math.min(100, Math.max(0, progress))
  return { value, label: `${Math.round(value)}%` }
}

function toolStateForTask(task: TaskEvent): ToolState {
  const metaState = task.meta?.toolState
  return normalizeToolState(metaState, task.status)
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
        const toolType = typeForTask(task)
        const statusLabel = statusLabelForTask(task)
        const displayTitle = typeof task.meta?.displayTitle === "string" && task.meta.displayTitle.trim().length > 0
          ? task.meta.displayTitle.trim()
          : undefined
        const subtitle = typeof task.meta?.displayNote === "string" && task.meta.displayNote.trim().length > 0
          ? task.meta.displayNote.trim()
          : undefined
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
                type={toolType}
                state={toolState}
                title={displayTitle ?? task.title ?? "Tool"}
                subtitle={subtitle}
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
