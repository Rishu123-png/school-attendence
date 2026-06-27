import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("schoolos:update-ready", { detail: newWorker }));
            }
          });
        });
      })
      .catch(() => {});

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // The refresh button in AppUpdateToast already reloads the page.
      // This listener is intentionally kept quiet to avoid double reload loops.
    });
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-primary-50 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-red-950/20">
          <div className="max-w-md w-full text-center space-y-4 rounded-3xl border border-red-100 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-red-900/40 dark:bg-gray-900/90">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 mb-2 dark:bg-red-900/30">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
            <p className="text-gray-500 text-sm dark:text-gray-400">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-primary-700 transition-all"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);