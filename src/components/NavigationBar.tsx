import { useState, useEffect, useRef, type ReactNode } from "react";
import { useAppStore, useAuthStore, type Page } from "@/store";
import { useExpensesStore } from "@/store/expenses";
import { useComprobantesStore } from "@/store/comprobantes";
import { useProductsStore } from "@/store/products";
import { useCashClosingStore } from "@/store/cash-closing";
import { useStoresStore } from "@/store/stores";
import { useActiveStore } from "@/store/context";
import { type Permission, type Role } from "@/store/auth";
import ConfirmModal from "@/components/ConfirmModal";

declare const __APP_VERSION__: string;

// ──────────────────────────────────────────────
// Inline SVG line icons (strokeWidth 1.75, currentColor)
// ──────────────────────────────────────────────

function NavIcon({ children, className = "w-5 h-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const HomeIcon = () => (
  <NavIcon>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </NavIcon>
);

const CartIcon = () => (
  <NavIcon>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </NavIcon>
);

const CashIcon = () => (
  <NavIcon>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01" />
    <path d="M18 12h.01" />
  </NavIcon>
);

const BoxIcon = () => (
  <NavIcon>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </NavIcon>
);

const UsersIcon = () => (
  <NavIcon>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </NavIcon>
);

const TruckIcon = () => (
  <NavIcon>
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </NavIcon>
);

const ClipboardIcon = () => (
  <NavIcon>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
  </NavIcon>
);

const ReceiptIcon = () => (
  <NavIcon>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
    <path d="M8 7h8" />
    <path d="M8 11h6" />
    <path d="M8 15h4" />
  </NavIcon>
);

const FileTextIcon = () => (
  <NavIcon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </NavIcon>
);

const WalletIcon = () => (
  <NavIcon>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </NavIcon>
);

const ChartIcon = () => (
  <NavIcon>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </NavIcon>
);

const ShieldIcon = () => (
  <NavIcon>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </NavIcon>
);

const SettingsIcon = () => (
  <NavIcon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </NavIcon>
);

const StoreIcon = () => (
  <NavIcon>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M4 9h16v12H4z" />
    <path d="M9 21v-6h6v6" />
    <path d="M3 9h18" />
  </NavIcon>
);

// ──────────────────────────────────────────────
// Store selector — cambia el punto de venta activo.
// Visible para todos los roles (cajero incluido).
// ──────────────────────────────────────────────

function StoreSelector() {
  const { storeId, setStoreId } = useActiveStore();
  const activeStores = useStoresStore((s) => s.activeStores);
  const loading = useStoresStore((s) => s.loading);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentName =
    activeStores.find((s) => s.id === storeId)?.name ?? storeId;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-control bg-pos-background hover:bg-pos-muted/10 border border-pos-muted/15 text-[13px] text-pos-text transition-colors text-left touch-target"
        title="Cambiar punto de venta"
        aria-label="Cambiar punto de venta"
      >
        <span className="shrink-0 text-pos-muted"><StoreIcon /></span>
        <span className="flex-1 min-w-0 truncate">{currentName}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3.5 h-3.5 text-pos-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-30 rounded-control border border-pos-muted/15 bg-pos-surface shadow-xl overflow-hidden">
          {activeStores.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-pos-muted">
              {loading ? "Cargando…" : "No hay puntos de venta activos"}
            </div>
          ) : (
            activeStores.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStoreId(s.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  s.id === storeId
                    ? "bg-pos-secondary/10 text-pos-secondary font-semibold"
                    : "text-pos-muted hover:bg-pos-background hover:text-pos-text"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-pos-secondary" />
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Page definitions
// ──────────────────────────────────────────────

type PageDef = {
  id: Page;
  label: string;
  icon: ReactNode;
  permission?: Permission;
};

const MAIN_PAGES: PageDef[] = [
  { id: "dashboard", label: "Inicio", icon: <HomeIcon /> },
  { id: "pos", label: "POS", icon: <CartIcon />, permission: "ventas" },
  { id: "cash-closing", label: "Caja", icon: <CashIcon />, permission: "caja" },
];

const CONFIG_PAGES: PageDef[] = [
  { id: "products", label: "Productos", icon: <BoxIcon />, permission: "productos" },
  { id: "customers", label: "Clientes", icon: <UsersIcon />, permission: "clientes" },
  { id: "proveedores", label: "Proveedores", icon: <TruckIcon />, permission: "proveedores" },
  { id: "pedidos", label: "Pedidos", icon: <ClipboardIcon />, permission: "pedidos" },
  { id: "billing", label: "Facturación", icon: <ReceiptIcon />, permission: "facturacion" },
  { id: "comprobantes", label: "Comprobantes", icon: <FileTextIcon />, permission: "comprobantes" },
  { id: "expenses", label: "Gastos", icon: <WalletIcon />, permission: "gastos" },
  { id: "stats", label: "Estadísticas", icon: <ChartIcon />, permission: "estadisticas" },
  { id: "admin", label: "Admin", icon: <ShieldIcon />, permission: "admin" },
];

// ──────────────────────────────────────────────
// Page titles for the app topbar
// Derived from the nav labels above so both never drift apart.
// ──────────────────────────────────────────────

export const PAGE_LABELS: Partial<Record<Page, string>> = [
  ...MAIN_PAGES,
  ...CONFIG_PAGES,
  // Reached from Dashboard ("Usuarios" tile) and Admin, not listed in the nav.
  { id: "user-management" as Page, label: "Usuarios" },
  { id: "login" as Page, label: "Iniciar Sesión" },
].reduce<Partial<Record<Page, string>>>((acc, p) => {
  acc[p.id] = p.label;
  return acc;
}, {});

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  custom: "Personalizado",
};

/** Initials for the user avatar: "Martina Ríos" → "MR", "admin" → "A". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

// ──────────────────────────────────────────────
// Sidebar component
// ──────────────────────────────────────────────

export default function NavigationBar() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useAuthStore((s) => s.logout);
  const [configOpen, setConfigOpen] = useState(true); // open by default in sidebar
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer
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

  function handleLogout() {
    setShowLogoutConfirm(true);
  }

  function isActive(id: Page): boolean {
    if (visibleMain.some((p) => p.id === id)) return page === id;
    return page === id;
  }

  // Nav item styling — 40px tall blocks, flat surfaces, indigo active state.
  function navItemClass(active: boolean): string {
    return `w-full flex items-center gap-3 h-10 px-3 rounded-control text-[13.5px] transition-colors text-left ${
      active
        ? "bg-pos-secondary/10 text-pos-secondary font-semibold"
        : "text-pos-muted hover:bg-pos-background hover:text-pos-text font-medium"
    }`;
  }

  function navIconClass(active: boolean): string {
    return active ? "shrink-0" : "shrink-0 text-pos-muted";
  }

  // Shared sidebar content (desktop aside + mobile drawer). Selecting a page
  // always closes the mobile drawer.
  const sidebarContent = (
    <>
      {/* Header block — brand mark + app name (static header, not a dropdown) */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-[10px] bg-gradient-to-br from-pos-accent to-pos-accent-2 flex items-center justify-center text-[12px] font-bold text-white">
            SV
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold leading-tight text-pos-text truncate">
              Sistema Ventas
            </p>
            <p className="text-[11px] text-pos-muted truncate">Release v{__APP_VERSION__}</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-pos-muted/10" />

      {/* Live clock + store selector */}
      <div className="px-3 py-3 space-y-2">
        <div className="rounded-control bg-pos-background px-3 py-2 text-center">
          <p className="text-[15px] font-semibold font-mono tabular-nums text-pos-text">
            {clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-[10.5px] text-pos-muted mt-0.5 capitalize tabular-nums">
            {clock.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-pos-muted font-medium px-1">
          Punto de venta
        </p>
        <StoreSelector />
      </div>

      <div className="h-px bg-pos-muted/10" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-[3px]">
        {/* Main pages */}
        {visibleMain.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPage(p.id); setMobileOpen(false); }}
            className={navItemClass(isActive(p.id) && !isInConfig)}
          >
            <span className={navIconClass(isActive(p.id) && !isInConfig)}>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}

        {/* Divider */}
        {visibleMain.length > 0 && visibleConfig.length > 0 && (
          <div className="h-px bg-pos-muted/10 my-2" />
        )}

        {/* Config section */}
        {visibleConfig.length > 0 && (
          <div>
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="w-full flex items-center gap-3 h-10 px-3 rounded-control text-[13.5px] font-medium text-pos-muted hover:bg-pos-background hover:text-pos-text transition-colors text-left"
            >
              <span className="shrink-0 text-pos-muted"><SettingsIcon /></span>
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
              <div className="ml-2 mt-[3px] space-y-[3px] border-l border-pos-muted/10 pl-2">
                {visibleConfig.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPage(p.id); setMobileOpen(false); }}
                    className={navItemClass(page === p.id)}
                  >
                    <span className={navIconClass(page === p.id)}>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom: user card + logout (the theme toggle lives in the topbar) */}
      <div className="h-px bg-pos-muted/10" />
      {currentUser && (
        <div className="p-2.5">
          <div className="flex items-center gap-2.5 rounded-control bg-pos-background p-2.5">
            <div className="w-[30px] h-[30px] shrink-0 rounded-full bg-pos-text text-white flex items-center justify-center text-[11px] font-bold">
              {initialsOf(currentUser.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-pos-text truncate">{currentUser.name}</p>
              <p className="text-[10.5px] text-pos-muted truncate">{ROLE_LABELS[currentUser.role]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 p-1.5 rounded-lg text-pos-muted hover:text-pos-danger hover:bg-pos-danger/10 transition-colors"
              title="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile top bar — visible only below lg */}
      <header className="lg:hidden flex items-center gap-3 px-3 h-14 shrink-0 bg-pos-surface border-b border-pos-muted/15 text-pos-text z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-control text-pos-muted hover:bg-pos-background hover:text-pos-text transition-colors touch-target"
          title="Abrir menú"
          aria-label="Abrir menú"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="w-7 h-7 shrink-0 rounded-[10px] bg-gradient-to-br from-pos-accent to-pos-accent-2 flex items-center justify-center text-[11px] font-bold text-white">
          SV
        </div>
        <h1 className="text-[13.5px] font-semibold tracking-wide">Sistema Ventas</h1>
      </header>

      {/* Desktop sidebar — identical behavior to before, hidden below lg */}
      <aside
        className={`hidden lg:flex flex-col h-full bg-pos-surface text-pos-text shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out ${
          sidebarOpen
            ? "w-[248px] border-r border-pos-muted/15"
            : "w-0 border-r-0"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Reopen strip — desktop only; reserves layout space when the sidebar is collapsed so it never overlaps the view content */}
      {!sidebarOpen && (
        <div className="hidden lg:flex w-12 h-full shrink-0 justify-center pt-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-control bg-pos-surface text-pos-muted border border-pos-muted/15 shadow-sm hover:bg-pos-background hover:text-pos-text transition-colors"
            title="Abrir menú (F4)"
            aria-label="Abrir menú lateral"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile drawer + backdrop — overlay, hidden below lg */}
      <div
        className={`lg:hidden fixed inset-0 z-40 ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        {/* Drawer */}
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-pos-surface text-pos-text flex flex-col shadow-2xl transition-transform duration-200 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Menú de navegación"
        >
          {sidebarContent}
        </aside>
      </div>

      {/* Logout confirmation modal — kept outside the drawer so its fixed positioning is viewport-relative */}
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
    </>
  );
}
