# CLAUDE.md - dnd-kit + Fractional Indexing 実装ガイド

このドキュメントは、React/Next.js でドラッグ&ドロップによる並べ替え機能を実装する際のリファレンスです。

---

## 技術選定

### dnd-kit を選ぶ理由

| ライブラリ | 状態 | 備考 |
|-----------|------|------|
| **dnd-kit** | ✅ 推奨 | 現在のスタンダード、モダンな設計 |
| react-beautiful-dnd | ❌ メンテ終了 | 2024年にAtlassianがメンテナンス終了宣言 |
| react-dnd | △ 使用可 | 設計が古め、学習コスト高い |
| @atlaskit/pragmatic-drag-and-drop | ✅ 代替候補 | Atlassianの新作 |

### dnd-kit のモジュール構成

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers
```

| パッケージ | 用途 |
|-----------|------|
| `@dnd-kit/core` | 基本機能（DndContext, useDraggable, useDroppable） |
| `@dnd-kit/sortable` | 並べ替え特化（SortableContext, useSortable, arrayMove） |
| `@dnd-kit/utilities` | ヘルパー（CSS.Transform など） |
| `@dnd-kit/modifiers` | 動きの制限（縦のみ、横のみ、グリッドなど） |

---

## Fractional Indexing とは

### 問題: 連番方式の非効率性

```
タスクA: index = 1
タスクB: index = 2
タスクC: index = 3
タスクD: index = 4
タスクE: index = 5
```

タスクE を先頭に移動すると：

```sql
-- 5件全部 UPDATE が必要 😱
UPDATE tasks SET index = 1 WHERE id = 'E';
UPDATE tasks SET index = 2 WHERE id = 'A';
UPDATE tasks SET index = 3 WHERE id = 'B';
UPDATE tasks SET index = 4 WHERE id = 'C';
UPDATE tasks SET index = 5 WHERE id = 'D';
```

### 解決策: Fractional Indexing

```bash
pnpm add fractional-indexing
```

文字列の辞書順（lexicographic order）で順序を表現：

```
タスクA: index = "a0"
タスクB: index = "a1"
タスクC: index = "a2"
タスクD: index = "a3"
タスクE: index = "a4"
```

タスクE を先頭に移動：

```sql
-- 1件だけ UPDATE 🎉
UPDATE tasks SET index = 'Zz' WHERE id = 'E';
```

### generateKeyBetween の使い方

```typescript
import { generateKeyBetween } from "fractional-indexing";

// 最初のアイテム（前も後もない）
generateKeyBetween(null, null)     // → "a0"

// 末尾に追加（前はあるが後はない）
generateKeyBetween("a0", null)     // → "a1"
generateKeyBetween("a1", null)     // → "a2"

// 間に挿入（前後両方ある）
generateKeyBetween("a0", "a1")     // → "a0V"
generateKeyBetween("a0", "a0V")    // → "a0G"

// 先頭に挿入（前はないが後はある）
generateKeyBetween(null, "a0")     // → "Zz"
generateKeyBetween(null, "Zz")     // → "Zy"
```

### なぜ大文字が小文字より前に来るのか

ASCIIコードの順番による：

```
A-Z: 65-90
a-z: 97-122

→ "Z" (90) < "a" (97)
```

だから辞書順ソートで：

```
"Zv" < "Zw" < "Zx" < "a0" < "a1"
```

これにより：
- **前に挿入** → 大文字側（Z, Y, X...）に伸びる
- **後に挿入** → 小文字側（a, b, c...）に伸びる
- **前後どちらにも無限に挿入可能**

---

## 実装の全体像

### ディレクトリ構成

```
src/
├── actions/
│   └── task.ts              # Server Actions (CRUD + revalidate)
├── components/
│   ├── sortable-todo-list.tsx   # DndContext + SortableContext
│   ├── sortable-todo-item.tsx   # useSortable で各アイテムをラップ
│   └── add-task-form.tsx        # タスク追加フォーム
├── db/
│   ├── schema.ts            # Drizzle スキーマ（index は text 型）
│   └── index.ts             # DB クライアント
└── app/
    └── page.tsx             # Server Component でデータ取得
```

### データフロー

```
┌─────────────────────────────────────────────────────────┐
│  1. ユーザーがドラッグ&ドロップ                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. DndContext の onDragEnd が発火                       │
│     - active: ドラッグしたアイテム                        │
│     - over: ドロップ先のアイテム                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. handleDragEnd で処理                                 │
│     - arrayMove で配列を並べ替え（UI用）                   │
│     - generateKeyBetween で新しい index を計算            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. useOptimistic で即座にUI更新（楽観的更新）             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  5. Server Action (updateTask) でDB更新                  │
│     - 移動したアイテム1件だけ UPDATE                      │
│     - revalidatePath("/") で再検証                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  6. ページ再描画                                         │
│     - getTasks() で ORDER BY index ASC                  │
│     - 正しい順序でレンダリング                            │
└─────────────────────────────────────────────────────────┘
```

---

## コード詳細

### 1. DB スキーマ

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  index: text("index").notNull(),  // ← Fractional Index（text型）
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**ポイント**: `index` は `text` 型。文字列の辞書順でソートする。

### 2. Server Actions

```typescript
// src/actions/task.ts
"use server";

import { db, tasks, Task } from "@/db";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";

// 取得: index でソート
export async function getTasks(): Promise<Task[]> {
  return await db.select().from(tasks).orderBy(asc(tasks.index));
}

// 作成: 末尾に追加
export async function createTask(title: string): Promise<Task> {
  const allTasks = await getTasks();
  const lastTask = allTasks[allTasks.length - 1];
  
  // 最後のタスクの後ろに新しい index を生成
  const newIndex = generateKeyBetween(lastTask?.index ?? null, null);

  const id = crypto.randomUUID();
  const [newTask] = await db
    .insert(tasks)
    .values({ id, title, index: newIndex })
    .returning();

  revalidatePath("/");
  return newTask;
}

// 更新: index の更新もここで行う
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

// 削除
export async function deleteTask(id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/");
}
```

### 3. SortableTodoList（親コンポーネント）

```typescript
// src/components/sortable-todo-list.tsx
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
  
  // 楽観的更新: サーバー応答を待たずにUIを更新
  const [optimisticTasks, updateOptimisticTasks] = useOptimistic(
    tasks,
    (_state, newTasks: Task[]) => newTasks
  );

  // センサー設定: マウス + キーボード対応
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ドラッグ終了時の処理
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 元の位置と新しい位置を計算
      const oldIndex = optimisticTasks.findIndex(
        (task) => task.id === active.id
      );
      const newIndex = optimisticTasks.findIndex(
        (task) => task.id === over.id
      );

      // 配列を並べ替え
      const newTasks = arrayMove(optimisticTasks, oldIndex, newIndex);

      startTransition(async () => {
        // 1. 楽観的更新（即座にUIに反映）
        updateOptimisticTasks(newTasks);

        // 2. 新しい index を計算
        const prevTask = newIndex > 0 ? newTasks[newIndex - 1] : null;
        const nextTask =
          newIndex < newTasks.length - 1 ? newTasks[newIndex + 1] : null;

        const newIndexValue = generateKeyBetween(
          prevTask?.index ?? null,
          nextTask?.index ?? null
        );

        // 3. サーバーに保存（1件だけ UPDATE）
        await updateTask(active.id as string, { index: newIndexValue });
      });
    }
  }

  // hydration エラー対策: サーバーとクライアントで同じIDを使う
  const id = useId();

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}  // 縦方向のみに制限
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
```

**重要ポイント**:

1. **DndContext**: ドラッグ&ドロップの親コンテキスト
2. **SortableContext**: 並べ替え可能なアイテムのリストを管理
3. **useOptimistic**: 楽観的更新でサクサクUX
4. **useId**: SSR/CSR間のhydrationエラー防止
5. **restrictToVerticalAxis**: 縦方向のみのドラッグに制限

### 4. SortableTodoItem（子コンポーネント）

```typescript
// src/components/sortable-todo-item.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Task } from "@/db";
import { updateTask, deleteTask } from "@/actions/task";
import { useTransition } from "react";

export function SortableTodoItem({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  
  // useSortable: このアイテムを並べ替え可能にする
  const {
    attributes,    // アクセシビリティ属性
    listeners,     // ドラッグイベントリスナー
    setNodeRef,    // DOM参照
    transform,     // 現在の移動量
    transition,    // アニメーション
    isDragging,    // ドラッグ中かどうか
  } = useSortable({ id: task.id });

  // ドラッグ中のスタイル
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded-md"
    >
      {/* チェックボックス、タイトルなど */}
      
      {/* ドラッグハンドル */}
      <button
        {...attributes}  // アクセシビリティ属性を展開
        {...listeners}   // ドラッグリスナーを展開
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
```

**重要ポイント**:

1. **useSortable**: 並べ替え可能にするフック
2. **setNodeRef**: DOM要素への参照を設定
3. **attributes + listeners**: ドラッグハンドルに適用
4. **CSS.Transform**: dnd-kit のtransformをCSSに変換

---

## よくあるカスタマイズ

### 横方向のみに制限

```typescript
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

<DndContext modifiers={[restrictToHorizontalAxis]}>
```

### グリッド内でのドラッグ

```typescript
import { rectSortingStrategy } from "@dnd-kit/sortable";

<SortableContext strategy={rectSortingStrategy}>
```

### ドラッグ中のオーバーレイ

```typescript
import { DragOverlay } from "@dnd-kit/core";

const [activeId, setActiveId] = useState<string | null>(null);

<DndContext
  onDragStart={(event) => setActiveId(event.active.id)}
  onDragEnd={() => setActiveId(null)}
>
  {/* ... */}
  <DragOverlay>
    {activeId ? <Item id={activeId} /> : null}
  </DragOverlay>
</DndContext>
```

### 複数リスト間の移動

```typescript
import { useDroppable } from "@dnd-kit/core";

function DroppableColumn({ id, items }) {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef}>
      <SortableContext items={items}>
        {/* items */}
      </SortableContext>
    </div>
  );
}
```

---

## トラブルシューティング

### hydration エラー

**問題**: `Warning: Prop 'id' did not match`

**解決**: `useId()` を使ってサーバー/クライアントで同じIDを使う

```typescript
const id = useId();
<DndContext id={id}>
```

### ドラッグ中に画面がガタつく

**解決**: `CSS.Transform.toString()` を使う

```typescript
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};
```

### index の衝突

**問題**: 同じ index が複数のアイテムに設定される

**原因**: 楽観的更新と実際の状態がずれた

**解決**: `revalidatePath()` で最新状態を取得 + エラーハンドリング

---

## 参考リンク

- [dnd-kit 公式ドキュメント](https://docs.dndkit.com/)
- [fractional-indexing GitHub](https://github.com/rocicorp/fractional-indexing)
- [Figma の順序管理についての記事](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)

---

## この実装を使っているサービス（参考）

- Notion
- Linear
- Figma
- Trello

これらのサービスも Fractional Indexing または類似の手法を使って、リアルタイムコラボレーションでの並べ替えを効率化している。
