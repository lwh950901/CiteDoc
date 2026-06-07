"use client";

import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as "light" | "dark";
    if (t) setTheme(t);
  }, []);

  function toggle(next: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("docqa-theme", next);
    setTheme(next);
  }

  return (
    <div className="theme-toggle">
      <span
        className={theme === "light" ? "active" : ""}
        onClick={() => toggle("light")}
        title="亮色模式"
      >
        ☀
      </span>
      <span
        className={theme === "dark" ? "active" : ""}
        onClick={() => toggle("dark")}
        title="暗色模式"
      >
        ☾
      </span>
    </div>
  );
}
