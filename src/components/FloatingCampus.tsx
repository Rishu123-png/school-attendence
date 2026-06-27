import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Pencil, School } from "lucide-react";

export default function FloatingCampus() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.18),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(236,72,153,0.16),transparent_26%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.10),transparent_30%)]" />

      <motion.div
        className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl"
        animate={{
          x: [0, 80, 20, 0],
          y: [0, 40, 90, 0],
          scale: [1, 1.15, 0.95, 1]
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <motion.div
        className="absolute -right-28 bottom-12 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl"
        animate={{
          x: [0, -70, -20, 0],
          y: [0, -50, 20, 0],
          scale: [1, 0.9, 1.18, 1]
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <motion.div
        className="absolute left-[8%] top-[18%] rounded-2xl border border-white/50 bg-white/55 p-3 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-gray-900/45"
        animate={{
          y: [0, -18, 0],
          rotate: [-4, 4, -4]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <GraduationCap className="h-7 w-7 text-primary-600" />
      </motion.div>

      <motion.div
        className="absolute right-[10%] top-[24%] rounded-2xl border border-white/50 bg-white/55 p-3 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-gray-900/45"
        animate={{
          y: [0, 16, 0],
          rotate: [5, -5, 5]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Pencil className="h-7 w-7 text-accent-600" />
      </motion.div>

      <motion.div
        className="absolute bottom-[22%] left-[14%] rounded-2xl border border-white/50 bg-white/55 p-3 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-gray-900/45"
        animate={{
          y: [0, 14, 0],
          x: [0, 8, 0]
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <BookOpen className="h-7 w-7 text-emerald-600" />
      </motion.div>

      <motion.div
        className="absolute bottom-[18%] right-[18%] rounded-2xl border border-white/50 bg-white/55 p-3 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-gray-900/45"
        animate={{
          y: [0, -12, 0],
          rotate: [-3, 3, -3]
        }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <School className="h-7 w-7 text-blue-600" />
      </motion.div>

      <motion.svg
        className="absolute left-0 top-[62%] h-16 w-28 text-primary-500/40"
        viewBox="0 0 120 60"
        fill="none"
        animate={{
          x: ["-20vw", "110vw"]
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <path d="M8 38h88l14-16H25L8 38Z" fill="currentColor" />
        <circle cx="34" cy="43" r="6" fill="currentColor" opacity="0.65" />
        <circle cx="84" cy="43" r="6" fill="currentColor" opacity="0.65" />
        <path
          d="M31 25h16M55 25h16M79 25h16"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.65"
        />
      </motion.svg>

      <motion.div
        className="absolute inset-0 opacity-[0.08] dark:opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }}
        animate={{
          backgroundPosition: ["0px 0px", "56px 56px"]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}