import { motion } from "framer-motion";

export default function PageBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-primary-400/10 blur-3xl dark:bg-primary-500/10"
        animate={{ x: [0, 60, 20, 0], y: [0, 30, 70, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-12rem] right-[-10rem] h-96 w-96 rounded-full bg-accent-400/10 blur-3xl dark:bg-accent-500/10"
        animate={{ x: [0, -50, -20, 0], y: [0, -40, 20, 0], scale: [1, 0.92, 1.15, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
        animate={{ backgroundPosition: ["0px 0px", "60px 60px"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}