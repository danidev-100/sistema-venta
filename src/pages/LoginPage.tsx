import { useState } from "react";
import { useAppStore } from "@/store";
import { useAuthStore, type Permission } from "@/store/auth";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setPage = useAppStore((s) => s.setPage);
  const login = useAuthStore((s) => s.login);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(name, password);
      if (result.success) {
        // If user only has "ventas" permission, go straight to POS
        const user = useAuthStore.getState().currentUser;
        const perms = user?.permissions ?? [];
        const hasOnlyVentas =
          perms.length === 1 && perms[0] === "ventas";
        setPage(hasOnlyVentas ? "pos" : "dashboard");
      } else {
        setError(result.error ?? "Error desconocido");
      }
    } catch {
      setError("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-pos-background">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8">
        {/* Logo / Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-pos-secondary/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-pos-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-bold text-center text-pos-text mb-1">
          Iniciar Sesión
        </h1>
        <p className="text-sm text-center text-pos-muted mb-6">
          Ingresá tus credenciales para acceder al sistema
        </p>

        {/* Error message */}
        {error && (
          <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-4 py-2 mb-4">
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-name"
              className="block text-sm font-medium text-pos-text mb-1"
            >
              Usuario
            </label>
            <input
              id="login-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de usuario"
              autoFocus
              className="w-full border border-pos-muted/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface text-pos-text"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-pos-text mb-1"
            >
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full border border-pos-muted/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface text-pos-text"
            />
          </div>

          <button
            type="submit"
            disabled={!name || !password || loading}
            className="w-full px-4 py-2.5 bg-pos-secondary text-white rounded-lg font-medium touch-target hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
