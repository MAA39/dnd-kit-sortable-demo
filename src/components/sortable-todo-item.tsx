"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Task } from "@/db";
import { updateTask, deleteTask } from "@/actions/task";
import { useTransition } from "react";

export function SortableTodoItem({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggle = () => {
    startTransition(async () => {
      await updateTask(task.id, { completed: !task.completed });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTask(task.id);
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center text-sm gap-2 group hover:bg-gray-100 rounded-md px-2 py-2 border border-gray-200"
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={handleToggle}
        disabled={isPending}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span
        className={`flex-1 ${
          task.completed ? "line-through text-gray-400" : ""
        }`}
      >
        {task.title}
      </span>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1"
        aria-label="削除"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 text-gray-400 p-1"
        aria-label="ドラッグして並び替え"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
