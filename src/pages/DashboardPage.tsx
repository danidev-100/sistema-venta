import { useAppStore, type Page } from "@/store";
import { useAuthStore, type Permission } from "@/store/auth";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ModuleConfig = {
  label: string;
  icon: React.ReactNode;
  target: Page | null;
  permission?: Permission;
};

// ──────────────────────────────────────────────
// Inline SVG icon components — each unique
// ──────────────────────────────────────────────

function PosIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M7 8h10" />
      <path d="M7 11h7" />
      <circle cx="16" cy="11" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="2" y="7" width="20" height="12" rx="2" />
      <circle cx="12" cy="13" r="3" />
      <path d="M18 7V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" />
      <line x1="10" y1="13" x2="10.01" y2="13" strokeWidth="2" />
      <line x1="14" y1="13" x2="14.01" y2="13" strokeWidth="2" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
      <path d="M7 6.5l10 5.8" opacity="0.4" />
    </svg>
  );
}

function ClientIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SupplierIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
      <line x1="8" y1="7" x2="11" y2="7" strokeWidth="2" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
      <circle cx="16" cy="13" r="3" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <path d="M8 7h8" strokeWidth="2" />
      <path d="M8 11h6" strokeWidth="2" />
      <path d="M8 15h4" strokeWidth="2" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <rect x="8" y="12" width="8" height="2" rx="1" />
      <rect x="8" y="16" width="5" height="2" rx="1" />
      <line x1="16" y1="12" x2="18" y2="12" strokeWidth="2" />
    </svg>
  );
}

function ExpenseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12" />
      <path d="M8 10l4-4 4 4" />
      <path d="M8 14l4 4 4-4" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="10" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" />
    </svg>
  );
}

// ──────────────────────────────────────────────
// Module definitions
// ──────────────────────────────────────────────

type ModuleMeta = {
  category: "primary" | "management" | "docs" | "finance" | "system";
};

const MODULE_META: Record<string, ModuleMeta> = {
  Ventas:        { category: "primary" },
  Caja:          { category: "primary" },
  Inventario:    { category: "management" },
  Clientes:      { category: "management" },
  Proveedores:   { category: "management" },
  Pedidos:       { category: "management" },
  Facturación:   { category: "docs" },
  Comprobantes:  { category: "docs" },
  Gastos:        { category: "finance" },
  Estadísticas:  { category: "finance" },
  Configuración: { category: "system" },
  Usuarios:      { category: "system" },
};

const CATEGORY_STYLES: Record<string, { accent: string; bg: string; text: string }> = {
  primary:    { accent: "#14b8a6",  bg: "bg-teal-500/8",  text: "text-teal-600" },
  management: { accent: "#10b981",  bg: "bg-emerald-500/8",   text: "text-emerald-600" },
  docs:       { accent: "#f59e0b",  bg: "bg-amber-500/8",     text: "text-amber-600" },
  finance:    { accent: "#8b5cf6",  bg: "bg-violet-500/8",    text: "text-violet-600" },
  system:     { accent: "#0ea5e9",  bg: "bg-sky-500/8",       text: "text-sky-600" },
};

const MODULES: ModuleConfig[] = [
  // ── Principal ──
  { label: "Ventas",       icon: <PosIcon />,       target: "pos",              permission: "ventas" },
  { label: "Caja",         icon: <CashIcon />,       target: "cash-closing",    permission: "caja" },

  // ── Gestión ──
  { label: "Inventario",   icon: <ProductIcon />,    target: "products",        permission: "productos" },
  { label: "Clientes",     icon: <ClientIcon />,     target: "customers",       permission: "clientes" },
  { label: "Proveedores",  icon: <SupplierIcon />,   target: "proveedores",     permission: "proveedores" },
  { label: "Pedidos",      icon: <OrderIcon />,      target: "pedidos",         permission: "pedidos" },

  // ── Documentos ──
  { label: "Facturación",  icon: <BillingIcon />,    target: "billing",         permission: "facturacion" },
  { label: "Comprobantes", icon: <ReceiptIcon />,    target: "comprobantes",    permission: "comprobantes" },

  // ── Finanzas ──
  { label: "Gastos",       icon: <ExpenseIcon />,    target: "expenses",        permission: "gastos" },
  { label: "Estadísticas", icon: <StatsIcon />,      target: "stats",           permission: "estadisticas" },

  // ── Sistema ──
  { label: "Configuración",icon: <SettingsIcon />,   target: "admin",           permission: "admin" },
  { label: "Usuarios",     icon: <UsersIcon />,      target: "user-management", permission: "usuarios" },
];

// ──────────────────────────────────────────────
// ModuleCard sub-component
// ──────────────────────────────────────────────

function ModuleCard({ label, icon, target }: ModuleConfig) {
  const setPage = useAppStore((s) => s.setPage);
  const meta = MODULE_META[label] ?? { category: "primary" };
  const styles = CATEGORY_STYLES[meta.category];
  const isDisabled = target === null;

  if (isDisabled) {
    return (
      <button
        disabled
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-pos-muted/10 bg-pos-surface p-5 opacity-50 cursor-not-allowed transition-colors"
      >
        <span className={styles.text}>{icon}</span>
        <span className="text-sm font-medium text-pos-text">{label}</span>
        <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold uppercase tracking-wide text-pos-muted bg-pos-background px-1.5 py-0.5 rounded">
          Próximamente
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setPage(target)}
      className="relative w-full flex flex-col items-center justify-center gap-3 rounded-xl border border-pos-muted/10 bg-pos-surface p-6 md:p-7 shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-200 cursor-pointer group overflow-hidden"
    >
      {/* Top accent bar */}
      <span
        className="absolute top-0 left-0 right-0 h-1 opacity-80 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: styles.accent }}
      />

      {/* Icon circle */}
      <span className={`flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl ${styles.bg} ${styles.text} group-hover:scale-105 transition-transform duration-200`}>
        <span className="md:scale-110">{icon}</span>
      </span>

      {/* Label */}
      <span className="text-sm md:text-base font-semibold text-pos-text tracking-tight">
        {label}
      </span>

      {/* Subtle hover glow */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-xl"
        style={{ backgroundColor: styles.accent }}
      />
    </button>
  );
}

// ──────────────────────────────────────────────
// Dashboard page
// ──────────────────────────────────────────────

export default function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Filter modules by permission
  const visibleModules = MODULES.filter((mod) => {
    // Disabled placeholders (Proveedores, Pedidos) always show
    if (mod.target === null) return true;
    // Modules without permission requirement always show (Inventario)
    if (!mod.permission) return true;
    // Check if user has the required permission
    return currentUser !== null && hasPermission(mod.permission);
  });

  return (
    <div className="flex flex-col gap-6 h-full p-4 md:p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-pos-text">Panel Principal</h1>
        <p className="text-sm text-pos-muted mt-1">
          Seleccioná un módulo para comenzar
        </p>
      </div>

      {/* Responsive card grid — 3 per row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        {visibleModules.map((mod, i) => (
          <div key={mod.label} className="card-enter w-full" style={{ animationDelay: `${i * 0.04}s` }}>
            <ModuleCard {...mod} />
          </div>
        ))}
      </div>
    </div>
  );
}
