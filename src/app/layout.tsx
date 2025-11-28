import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dnd-kit Sortable Demo",
  description: "Next.js + dnd-kit + Fractional Indexing でドラッグ&ドロップ並べ替え",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
