import { useEffect, useState } from "react";
import { useAppStore, type Page } from "@/store";
import { useAdminStore } from "@/store/admin";
import { useAuthStore } from "@/store/auth";
import { usePermission } from "@/hooks/usePermission";
import { StoreProvider, useActiveStore } from "@/store/context";
import AdminRoute from "@/components/AdminRoute";
import NavigationBar, { MobileMenuButton, PAGE_LABELS } from "@/components/NavigationBar";
import ThemeToggle from "@/components/ThemeToggle";

// Pages
import DashboardPage from "@/pages/DashboardPage";
import POSPage from "@/pages/POSPage";
import CashClosingPage from "@/pages/CashClosingPage";
import ProductsPage from "@/pages/ProductsPage";
import CustomersPage from "@/pages/CustomersPage";
import ProveedoresPage from "@/pages/ProveedoresPage";
import PedidosPage from "@/pages/PedidosPage";
import BillingPage from "@/pages/BillingPage";
import ComprobantesPage from "@/pages/ComprobantesPage";
import ExpensesPage from "@/pages/ExpensesPage";
import StatsPage from "@/pages/StatsPage";
import AdminPage from "@/pages/AdminPage";
import UserManagementPage from "@/pages/UserManagementPage";
import LoginPage from "@/pages/LoginPage";

// ──────────────────────────────────────────────
// Page router — maps enum to component
// ──────────────────────────────────────────────

const PAGE_COMPONENTS: Record<Page, () => JSX.Element> = {
  dashboard: DashboardPage,
  expenses: ExpensesPage,
  pos: POSPage,
  products: ProductsPage,
  "cash-closing": CashClosingPage,
  billing: BillingPage,
  customers: CustomersPage,
  stats: StatsPage,
  admin: AdminPage,
  login: LoginPage,
  "user-management": UserManagementPage,
  proveedores: ProveedoresPage,
  pedidos: PedidosPage,
  comprobantes: ComprobantesPage,
};

// ──────────────────────────────────────────────
// Pages that require admin permission
// ──────────────────────────────────────────────

const ADMIN_PAGES: Page[] = ["admin", "user-management", "cash-closing"];

// ──────────────────────────────────────────────
// Sales loader — hydrates completedSales from the server
// ──────────────────────────────────────────────

function SalesLoader() {
  const { storeId } = useActiveStore();
  const loadSales = useAppStore((s) => s.loadSales);
  useEffect(() => {
    loadSales(storeId).catch(console.error);
  }, [storeId, loadSales]);
  return null;
}

// ──────────────────────────────────────────────
// App shell
// ──────────────────────────────────────────────

export default function App() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const theme = useAdminStore((s) => s.theme);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasAccess = usePermission(page);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // F4 toggles the sidebar (collapse/expand) in every view
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F4") {
        e.preventDefault();
        useAppStore.getState().toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync theme class on mount and on change
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Warn before leaving with items in cart
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const { items } = useAppStore.getState();
      if (items.length > 0) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Permission gate: redirect unpermitted pages to dashboard
  useEffect(() => {
    if (currentUser !== null && !hasAccess && page !== "login") {
      setPage("dashboard");
    }
  }, [currentUser, hasAccess, page, setPage]);

  // ── Render ──

  const isAuthenticated = currentUser !== null;
  const PageComponent = PAGE_COMPONENTS[page];
  const needsAdminGate = ADMIN_PAGES.includes(page);
  const pageTitle = PAGE_LABELS[page] ?? "";

  return (
    <StoreProvider>
      {isAuthenticated ? (
        <div className="app-shell flex flex-col w-full overflow-hidden lg:flex-row">
          <SalesLoader />
          <NavigationBar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            {/* Topbar — single bar on every breakpoint: menu (mobile), page title, theme toggle */}
            <header className="h-14 lg:h-16 shrink-0 flex items-center gap-2 lg:gap-3 px-3 lg:px-6 bg-pos-surface border-b border-pos-muted/15">
              <MobileMenuButton onClick={() => setMobileNavOpen(true)} />
              <h1 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-pos-text lg:flex-none lg:text-[15px]">
                {pageTitle}
              </h1>
              {/* ThemeToggle compact styles its own button for the old dark
                  sidebar; these variants re-tone it for the light topbar. */}
              <div className="ml-auto flex shrink-0 items-center [&>button]:text-pos-muted [&>button:hover]:bg-pos-background [&>button:hover]:text-pos-text">
                <ThemeToggle compact />
              </div>
            </header>
            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
              {needsAdminGate ? (
                <AdminRoute>
                  <PageComponent />
                </AdminRoute>
              ) : (
                <PageComponent />
              )}
            </main>
          </div>
        </div>
      ) : (
        <LoginPage />
      )}
    </StoreProvider>
  );
}
