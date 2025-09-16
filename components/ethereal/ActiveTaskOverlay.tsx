"use client"

import type { TaskEvent } from "@/types/chat"
import { TaskList as TaskListBase } from "@/components/tasks/TaskList"

interface ActiveTaskOverlayProps {
  tasks: TaskEvent[] | undefined
}

export function ActiveTaskOverlay({ tasks }: ActiveTaskOverlayProps) {
  return (
    <TaskListBase
      tasks={tasks}
      className="space-y-2 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
      progressTrackClassName="bg-white/20"
      progressBarClassName="bg-white"
    />
  )
}
