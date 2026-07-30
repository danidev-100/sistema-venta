import { useState, useEffect, useCallback } from "react";
import { useAppStore, useAuthStore, type Page } from "@/store";
import { useExpensesStore } from "@/store/expenses";
import { useComprobantesStore } from "@/store/comprobantes";
import { useProductsStore } from "@/store/products";
import { useCashClosingStore } from "@/store/cash-closing";
import { type Permission } from "@/store/auth";
import { getSyncState, triggerSync } from "@/hooks/useSync";
import ThemeToggle from "@/components/ThemeToggle";
import ConfirmModal from "@/components/ConfirmModal";

declare const __APP_VERSION__: string;

// ──────────────────────────────────────────────
// Page definitions
// ──────────────────────────────────────────────

type PageDef = {
  id: Page;
  label: string;
  icon: string;
  permission?: Permission;
};

const MAIN_PAGES: PageDef[] = [
  { id: "dashboard", label: "Inicio", icon: "🏠" },
  { id: "pos", label: "POS", icon: "🛒", permission: "ventas" },
  { id: "cash-closing", label: "Caja", icon: "💰", permission: "caja" },
];

const CONFIG_PAGES: PageDef[] = [
  { id: "products", label: "Productos", icon: "📦", permission: "productos" },
  { id: "customers", label: "Clientes", icon: "👥", permission: "clientes" },
  { id: "proveedores", label: "Proveedores", icon: "🏭", permission: "proveedores" },
  { id: "pedidos", label: "Pedidos", icon: "📋", permission: "pedidos" },
  { id: "billing", label: "Facturación", icon: "🧾", permission: "facturacion" },
  { id: "comprobantes", label: "Comprobantes", icon: "📄", permission: "comprobantes" },
  { id: "expenses", label: "Gastos", icon: "💸", permission: "gastos" },
  { id: "stats", label: "Estadísticas", icon: "📊", permission: "estadisticas" },
  { id: "admin", label: "Admin", icon: "🔒", permission: "admin" },
];

// ──────────────────────────────────────────────
// Sidebar component
// ──────────────────────────────────────────────

export default function NavigationBar() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useAuthStore((s) => s.logout);
  const [configOpen, setConfigOpen] = useState(true); // open by default in sidebar
  const [clock, setClock] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const visibleMain = MAIN_PAGES.filter((p) => {
    if (!p.permission) return true;
    return hasPermission(p.permission);
  });

  const visibleConfig = CONFIG_PAGES.filter((p) => {
    if (!p.permission) return true;
    return hasPermission(p.permission);
  });

  const isInConfig = visibleConfig.some((p) => p.id === page);

  const handleSync = useCallback(() => { triggerSync(); }, []);

  const syncState = getSyncState();
  const syncStatus = syncState.status;
  const syncError = syncState.error;
  const lastSync = syncState.lastSyncedAt
    ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const syncIcon =
    syncStatus === "syncing" ? "🔄"
    : syncStatus === "success" ? "☁️"
    : syncStatus === "error" ? "⚠️" : "☁️";

  function handleLogout() {
    setShowLogoutConfirm(true);
  }

  function isActive(id: Page): boolean {
    if (visibleMain.some((p) => p.id === id)) return page === id;
    return page === id;
  }

  return (
    <aside className="w-56 lg:w-60 h-full bg-pos-primary/95 backdrop-blur-sm text-white flex flex-col shadow-lg shrink-0">
      {/* Logo / App title */}
      <div className="px-4 py-4 border-b border-white/10">
        <h1 className="text-sm font-bold tracking-wide">Sistema Ventas</h1>
        <p className="text-[10px] text-white/50 mt-0.5">POS v{__APP_VERSION__}</p>
      </div>

      {/* Live clock */}
      <div className="px-4 py-3 border-b border-white/10 text-center">
        <p className="text-xl font-bold font-mono tabular-nums tracking-wider text-white">
          {clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <p className="text-xs text-white/50 mt-1 capitalize tabular-nums leading-relaxed">
          {clock.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {/* Main pages */}
        {visibleMain.map((p) => (
          <button
            key={p.id}
            onClick={() => setPage(p.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              isActive(p.id) && !isInConfig
                ? "bg-pos-secondary/20 text-white"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <span className="text-lg shrink-0">{p.icon}</span>
            <span>{p.label}</span>
            {isActive(p.id) && !isInConfig && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pos-secondary" />
            )}
          </button>
        ))}

        {/* Divider */}
        {visibleMain.length > 0 && visibleConfig.length > 0 && (
          <div className="border-t border-white/10 my-2" />
        )}

        {/* Config section */}
        {visibleConfig.length > 0 && (
          <div>
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left text-white/50 hover:text-white hover:bg-white/10"
            >
              <span className="text-lg shrink-0">⚙️</span>
              <span>Configuración</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-3.5 h-3.5 ml-auto transition-transform ${configOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {configOpen && (
              <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                {visibleConfig.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPage(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      page === p.id
                        ? "text-white bg-pos-secondary/15 font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="text-base shrink-0">{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom: user + sync + theme */}
      <div className="border-t border-white/10 px-3 py-3 space-y-2">
        {/* Sync */}
        <button
          onClick={handleSync}
          className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10"
          title={syncStatus === "error" ? `Error: ${syncError}` : "Sincronizar ahora"}
        >
          <span>{syncIcon}</span>
          <span className="text-xs">
            {syncStatus === "syncing" ? "Sincronizando..."
            : syncStatus === "success" ? "Sincronizado"
            : syncStatus === "error" ? "Error de sincro"
            : "Sincronizar"}
          </span>
        </button>

        {/* User */}
        {currentUser && (
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-pos-secondary/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-white/70 truncate">{currentUser.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-white/40 hover:text-white transition-colors shrink-0 px-1.5 py-1 rounded hover:bg-white/10"
              title="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}

        {/* Theme */}
        <div className="flex justify-center">
          <ThemeToggle compact />
        </div>

        {/* Persistence status */}
        <div className="px-3 py-2 border-t border-white/10">
          <button
            onClick={() => {
              const sales = useAppStore.getState().completedSales.length;
              const exps = useExpensesStore.getState().expenses.length;
              const comps = useComprobantesStore.getState().comprobantes.length;
              const prods = useProductsStore.getState().products.length;
              const shifts = useCashClosingStore.getState().shifts.length;
              useAppStore.getState().showNotification(
                `📊 Ventas:${sales} Gastos:${exps} Comp:${comps} Prod:${prods} Turnos:${shifts}`
              );
            }}
            className="w-full text-[9px] text-white/30 hover:text-white/60 transition-colors text-center"
            title="Ver conteo de datos cargados"
          >
            v{__APP_VERSION__} — tocar para diagnóstico
          </button>
        </div>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <ConfirmModal
          title="Cerrar sesión"
          message="¿Estás seguro de que querés cerrar sesión? Se te redirigirá a la pantalla de inicio."
          confirmText="Sí, cerrar sesión"
          cancelText="Cancelar"
          onConfirm={() => {
            logout();
            setPage("login");
            setShowLogoutConfirm(false);
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </aside>
  );
}
