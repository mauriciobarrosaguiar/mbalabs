"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "mba-platform-theme";

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.mbaTheme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initialTheme = isTheme(saved) ? saved : "dark";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  const nextLabel = theme === "dark" ? "modo claro" : "modo escuro";

  return (
    <button
      aria-label={`Ativar ${nextLabel}`}
      className={`mba-theme-toggle ${compact ? "mba-theme-toggle-compact" : ""}`}
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true" className="mba-theme-toggle-icon">
        {theme === "dark" ? "☀" : "☾"}
      </span>
      {compact ? null : <span>{theme === "dark" ? "Claro" : "Escuro"}</span>}
    </button>
  );
}