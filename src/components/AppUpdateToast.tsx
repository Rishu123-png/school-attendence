import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";

export default function AppUpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onUpdateReady = (event: Event) => {
      const customEvent = event as CustomEvent<ServiceWorker>;
      setWaitingWorker(customEvent.detail ?? null);
      setShow(true);
    };

    window.addEventListener("schoolos:update-ready", onUpdateReady);
    return () => window.removeEventListener("schoolos:update-ready", onUpdateReady);
  }, []);

  const refreshApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          className="fixed bottom-20 left-4 right-4 z-[9999] mx-auto max-w-md rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-primary-900/60 dark:bg-gray-900/95 sm:bottom-6 sm:left-auto sm:right-6"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 text-white shadow-lg shadow-primary-500/20">
              <RefreshCw className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">New update available</h3>
              <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-300">
                A fresh version of School OS is ready. Refresh to use the latest fixes and UI.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={refreshApp}
                  className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-700 active:scale-95"
                >
                  Refresh now
                </button>
                <button
                  onClick={() => setShow(false)}
                  className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  Later
                </button>
              </div>
            </div>

            <button
              onClick={() => setShow(false)}
              className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label="Dismiss update message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}