"use client"

import type { HTMLAttributes } from "react"

import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import type { ToolHeaderProps } from "@/components/ai-elements/tool"
import { cn } from "@/lib/utils"
import type { TaskEvent, TaskEventMeta, ToolActivityEntry } from "@/types/chat"

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

function mergeActivityLog(entries: ToolActivityEntry[] = []): ToolActivityEntry[] {
  const sorted = [...entries].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  const unique: ToolActivityEntry[] = []
  const seenKeys = new Set<string>()

  for (const entry of sorted) {
    const key = `${entry.toolTitle ?? ''}|${entry.status}|${entry.text ?? ''}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    unique.push(entry)
    if (unique.length === 5) break
  }

  return unique
}

function reduceTasks(tasks: TaskEvent[]): TaskEvent {
  if (tasks.length === 1) return tasks[0]
  return tasks.reduce((acc, task) => {
    const meta: TaskEventMeta = {
      ...(acc.meta ?? {}),
      ...(task.meta ?? {}),
    }
    const activityLog = mergeActivityLog([...(acc.meta?.activityLog ?? []), ...(task.meta?.activityLog ?? [])])
    if (activityLog.length > 0) meta.activityLog = activityLog
    if ((task.meta?.displayNote ?? '').trim()) meta.displayNote = task.meta?.displayNote
    if ((task.meta?.displayTitle ?? '').trim()) meta.displayTitle = task.meta?.displayTitle
    if ((task.meta?.statusCopy ?? '').trim()) meta.statusCopy = task.meta?.statusCopy
    if ((task.meta?.toolState ?? '').trim()) meta.toolState = task.meta?.toolState
    if ((task.meta?.toolType ?? '').trim()) meta.toolType = task.meta?.toolType
    return {
      ...acc,
      id: task.id,
      title: task.title || acc.title,
      status: task.status,
      progress: task.progress ?? acc.progress,
      details: task.details ?? acc.details,
      meta,
    }
  })
}

export function TaskList({
  tasks,
  className,
  itemClassName,
  statusClassName,
  progressTrackClassName = "bg-gray-200",
  progressBarClassName = "bg-orange-500",
  ...props
}: TaskListProps) {
  if (!tasks || tasks.length === 0) return null

  const byType = tasks.reduce<Record<string, TaskEvent[]>>((acc, task) => {
    const type = typeForTask(task)
    acc[type] = acc[type] ? [...acc[type], task] : [task]
    return acc
  }, {})

  const combined = Object.entries(byType).map(([type, list]) => {
    return { type: type as ToolType, task: reduceTasks(list) }
  })

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {combined.map(({ type, task }) => {
        const toolState = toolStateForTask(task)
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
        const activityLog = task.meta?.activityLog ?? []
        const showActivity = activityLog.length > 0
        const showContent = showProgress || showDetails || hasFiles || showStatusCopy || showActivity

        return (
          <Tool
            key={type}
            className={cn(
              "rounded-xl border border-gray-200 bg-gray-50 text-gray-900",
              itemClassName,
            )}
          >
            <div className="flex items-center gap-3 px-3 pt-3">
              <ToolHeader
                type={type}
                state={toolState}
                title={displayTitle ?? task.title ?? "Tool"}
                subtitle={subtitle}
                className="flex-1 p-0 text-gray-900"
              />
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[0.18em] text-gray-500",
                  statusClassName,
                )}
              >
                {statusLabel}
              </span>
            </div>
            {showContent ? (
              <div className="space-y-2 px-3 pb-3">
                {showActivity ? (
                  <div className="space-y-1 text-xs text-gray-500">
                    {activityLog.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2">
                        <span className="inline-flex size-1.5 rounded-full bg-orange-400" />
                        <span className="leading-4">{entry.text}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {showStatusCopy ? (
                  <p className="text-xs leading-4 text-gray-500">{statusCopy}</p>
                ) : null}
                {showProgress ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-gray-400">
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
                          "text-sm leading-5 text-gray-700",
                          task.status === "failed" ? "text-red-600" : undefined,
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
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
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
