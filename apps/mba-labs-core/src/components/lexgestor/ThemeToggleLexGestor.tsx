"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

export function ThemeToggleLexGestor() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("lexgestor-theme") as ThemeMode | null;
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function applyTheme(nextTheme: ThemeMode) {
    const root = document.querySelector(".lexgestor-module");
    if (!root) return;

    if (nextTheme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
    }

    window.localStorage.setItem("lexgestor-theme", nextTheme);
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button className="button secondary theme-toggle" type="button" onClick={toggleTheme}>
      {isDark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
      {isDark ? "Modo claro" : "Modo escuro"}
    </button>
  );
}
