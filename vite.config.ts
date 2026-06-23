import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if running on Vercel
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  // On Vercel: always use "/"
  // On GitHub Pages: use VITE_BASE_PATH or "/school-attendence/"
  // Locally: use "/"
  base: isVercel ? "/" : (process.env.VITE_BASE_PATH || "/"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/database"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
