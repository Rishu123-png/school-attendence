/** Reusable Tailwind class-string constants — avoids Tailwind v4 custom-utility issues */

export const S = {
  /* ── inputs ─────────────────────────────────────── */
  input:
    "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100",

  /* ── buttons ────────────────────────────────────── */
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]",

  /* ── cards ──────────────────────────────────────── */
  card:
    "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all",
  cardHover:
    "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-200 cursor-pointer",

  /* ── badges ─────────────────────────────────────── */
  badgeGreen:  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700",
  badgeRed:    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700",
  badgeYellow: "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700",
  badgeBlue:   "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700",
  badgePurple: "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700",
} as const;
