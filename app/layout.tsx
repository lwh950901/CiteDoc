import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocQATracer - 文档问答溯源工具",
  description:
    "上传 PDF/Word 文档，AI 答案中每条事实可点击跳转到原文位置并高亮显示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
