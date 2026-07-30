import { type ReactNode, useEffect } from "react";
import { useAuthStore, type Permission } from "@/store/auth";
import { useAppStore, type Page } from "@/store";

// ──────────────────────────────────────────────
// Page → permission mapping for admin pages
// ──────────────────────────────────────────────

const ADMIN_PAGE_PERMISSION: Partial<Record<Page, Permission>> = {
  admin: "admin",
  "user-management": "usuarios",
  "cash-closing": "caja",
};

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type AdminRouteProps = {
  children: ReactNode;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function AdminRoute({ children }: AdminRouteProps) {
  const page = useAppStore((s) => s.page);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const setPage = useAppStore((s) => s.setPage);

  const required = ADMIN_PAGE_PERMISSION[page] ?? "admin";

  useEffect(() => {
    if (!hasPermission(required)) {
      setPage("dashboard");
    }
  }, [required, hasPermission, setPage]);

  if (!hasPermission(required)) {
    return null;
  }

  return <>{children}</>;
}
