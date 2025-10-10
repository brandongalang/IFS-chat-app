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
      className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
      itemClassName="border-white/20 bg-white/12"
      statusClassName="text-white/80"
      progressTrackClassName="bg-white/20"
      progressBarClassName="bg-white"
    />
  )
}
