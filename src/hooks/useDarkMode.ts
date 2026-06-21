import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

export function useDarkMode() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("schoolos-theme") as Theme) || "system";
  });

  const [isDark, setIsDark] = useState(false);

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    const dark =
      t === "dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    setIsDark(dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0f172a" : "#4f46e5");
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, applyTheme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("schoolos-theme", t);
  };

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return { theme, isDark, setTheme, toggle };
}