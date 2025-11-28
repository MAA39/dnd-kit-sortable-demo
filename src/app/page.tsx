import { getTasks } from "@/actions/task";
import { AddTaskForm } from "@/components/add-task-form";
import { SortableTodoList } from "@/components/sortable-todo-list";

export default async function Home() {
  const tasks = await getTasks();

  return (
    <main className="max-w-md mx-auto p-6 pt-12">
      <h1 className="text-2xl font-bold mb-6">📝 Sortable Todo</h1>
      <div className="space-y-4">
        <AddTaskForm />
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            タスクがありません。追加してみましょう！
          </p>
        ) : (
          <SortableTodoList tasks={tasks} />
        )}
      </div>
    </main>
  );
}
