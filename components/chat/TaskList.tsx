"use client"

import type { TaskEvent } from "@/types/chat"
import { TaskList as TaskListBase } from "@/components/tasks/TaskList"

interface TaskListProps {
  tasks: TaskEvent[] | undefined
}

export function TaskList({ tasks }: TaskListProps) {
  return <TaskListBase tasks={tasks} data-testid="task-list" />
}
