# dnd-kit Sortable Demo

Next.js + dnd-kit + Fractional Indexing でドラッグ&ドロップ並べ替えを実装するデモアプリです。

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **DnD**: dnd-kit
- **順序管理**: fractional-indexing
- **ORM**: Drizzle ORM
- **DB**: SQLite (better-sqlite3)

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/MAA39/dnd-kit-sortable-demo.git
cd dnd-kit-sortable-demo

# 依存関係をインストール
pnpm install

# DBマイグレーションを実行
pnpm db:generate
pnpm db:migrate

# 開発サーバーを起動
pnpm dev
```

http://localhost:3000 にアクセス！

## 主な機能

- ✅ タスクの追加・削除・完了切り替え
- 🔀 ドラッグ&ドロップで並べ替え
- ⚡ 楽観的更新 (useOptimistic)
- 🎯 Fractional Indexing で効率的な順序管理

## Fractional Indexing とは？

連番ではなく、特殊な文字列で並び順を管理する手法です。

**メリット**:
- 並び替え時に更新するのは移動した1アイテムだけ
- 連番だと全アイテムの再番号付けが必要になるケースを回避

## ディレクトリ構成

```
src/
├── actions/
│   └── task.ts          # Server Actions (CRUD)
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── add-task-form.tsx
│   ├── sortable-todo-item.tsx
│   └── sortable-todo-list.tsx
└── db/
    ├── index.ts         # Drizzle client
    └── schema.ts        # Task schema
```

## License

MIT
