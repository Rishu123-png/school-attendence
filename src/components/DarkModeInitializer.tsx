import { useEffect } from "react";

/**
 * This component reads the saved theme from localStorage on app load
 * and applies the dark class to <html> BEFORE React renders,
 * preventing the flash of light theme.
 */
export function DarkModeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem("schoolos-theme") || "system";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved === "dark" || (saved === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", shouldBeDark ? "#0f172a" : "#4f46e5");
  }, []);

  return null; // no visual output
}
