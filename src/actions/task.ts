"use server";

import { db, tasks, Task } from "@/db";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";

export async function getTasks(): Promise<Task[]> {
  return await db.select().from(tasks).orderBy(asc(tasks.index));
}

export async function createTask(title: string): Promise<Task> {
  const allTasks = await getTasks();
  const lastTask = allTasks[allTasks.length - 1];
  const newIndex = generateKeyBetween(lastTask?.index ?? null, null);

  const id = crypto.randomUUID();
  const [newTask] = await db
    .insert(tasks)
    .values({
      id,
      title,
      index: newIndex,
    })
    .returning();

  revalidatePath("/");
  return newTask;
}

export async function updateTask(
  id: string,
  data: Partial<Pick<Task, "title" | "completed" | "index">>
): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set(data)
    .where(eq(tasks.id, id))
    .returning();

  revalidatePath("/");
  return updated ?? null;
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/");
}
