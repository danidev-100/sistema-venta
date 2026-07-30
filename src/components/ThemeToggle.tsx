import { useAdminStore } from "@/store/admin";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ThemeToggleProps = {
  /** When true, renders as a compact icon button (for the NavBar).
   *  Defaults to false (full-width switch for the Settings panel). */
  compact?: boolean;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const theme = useAdminStore((s) => s.theme);
  const toggleTheme = useAdminStore((s) => s.toggleTheme);

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target"
        aria-label={
          theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"
        }
        title={theme === "light" ? "Modo Oscuro" : "Modo Claro"}
      >
        {theme === "light" ? (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        )}
      </button>
    );
  }

  // ── Full-width switch for Settings panel ──
  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center justify-between p-3 bg-pos-background/50 rounded-xl border border-pos-muted/10 touch-target hover:bg-pos-background/80 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">
          {theme === "light" ? "☀️" : "🌙"}
        </span>
        <span className="text-sm font-medium text-pos-text">
          {theme === "light" ? "Modo Claro" : "Modo Oscuro"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-pos-muted">Claro</span>
        <div
          className={`w-10 h-6 rounded-full transition-colors ${
            theme === "dark"
              ? "bg-pos-secondary"
              : "bg-pos-muted/30"
          } relative`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
              theme === "dark"
                ? "translate-x-[18px]"
                : "translate-x-0.5"
            }`}
          />
        </div>
        <span className="text-xs text-pos-muted">Oscuro</span>
      </div>
    </button>
  );
}
