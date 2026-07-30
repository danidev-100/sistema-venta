import { useAuthStore, type Permission } from "@/store/auth";
import type { Page } from "@/store";

// ──────────────────────────────────────────────
// Page → Permission mapping
// ──────────────────────────────────────────────

const PAGE_PERMISSIONS: Partial<Record<Page, Permission>> = {
  pos: "ventas",
  "cash-closing": "caja",
  customers: "clientes",
  stats: "estadisticas",
  products: "productos",
  billing: "facturacion",
  admin: "admin",
  expenses: "gastos",
  "user-management": "usuarios",
  proveedores: "proveedores",
  pedidos: "pedidos",
  comprobantes: "comprobantes",
};

// Pages that require no permission (just needs auth)
const PUBLIC_PAGES: Page[] = ["dashboard", "login"];

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function usePermission(page: Page): boolean {
  const currentUser = useAuthStore((s) => s.currentUser);

  // Login page always accessible
  if (page === "login") return true;

  // Public pages: just need to be authenticated
  if (PUBLIC_PAGES.includes(page)) {
    return currentUser !== null;
  }

  // Permission-gated pages
  const requiredPermission = PAGE_PERMISSIONS[page];
  if (!requiredPermission) return false;

  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return currentUser.permissions.includes(requiredPermission);
}
