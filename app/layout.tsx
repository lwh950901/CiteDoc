import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CiteDoc — Ask Documents, Get Cited Answers.",
  description:
    "CiteDoc 是一个基于 RAG（检索增强生成）的可溯源文档问答工具。上传 PDF/Word 后自由提问，AI 的每一条回答都附带精确引用角标，点击即可跳转到原文对应位置并高亮——让每一条答案都有据可查。",
  openGraph: {
    title: "CiteDoc — Ask Documents, Get Cited Answers.",
    description:
      "可溯源智能文档问答工具。上传文档，提问，追溯每一条答案的原文出处。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        {/* 防闪烁：页面加载前读取 localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){try{var t=localStorage.getItem('docqa-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
