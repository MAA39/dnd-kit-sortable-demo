"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useId, useOptimistic, useTransition } from "react";
import { updateTask } from "@/actions/task";
import { SortableTodoItem } from "./sortable-todo-item";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Task } from "@/db";
import { generateKeyBetween } from "fractional-indexing";

export function SortableTodoList({ tasks }: { tasks: Task[] }) {
  const [, startTransition] = useTransition();
  const [optimisticTasks, updateOptimisticTasks] = useOptimistic(
    tasks,
    (_state, newTasks: Task[]) => newTasks
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = optimisticTasks.findIndex(
        (task) => task.id === active.id
      );
      const newIndex = optimisticTasks.findIndex(
        (task) => task.id === over.id
      );

      const newTasks = arrayMove(optimisticTasks, oldIndex, newIndex);

      startTransition(async () => {
        updateOptimisticTasks(newTasks);

        const prevTask = newIndex > 0 ? newTasks[newIndex - 1] : null;
        const nextTask =
          newIndex < newTasks.length - 1 ? newTasks[newIndex + 1] : null;

        const newIndexValue = generateKeyBetween(
          prevTask?.index ?? null,
          nextTask?.index ?? null
        );

        await updateTask(active.id as string, { index: newIndexValue });
      });
    }
  }

  const id = useId();

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext
        items={optimisticTasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {optimisticTasks.map((task) => (
            <SortableTodoItem key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
