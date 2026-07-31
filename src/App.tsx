import { useEffect } from "react";
import { useAppStore, type Page } from "@/store";
import { useAdminStore } from "@/store/admin";
import { useAuthStore } from "@/store/auth";
import { usePermission } from "@/hooks/usePermission";
import { StoreProvider } from "@/store/context";
import { initAllStores } from "@/lib/init-stores";
import AdminRoute from "@/components/AdminRoute";
import NavigationBar from "@/components/NavigationBar";

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
// [ACTIVATION BYPASS] Import preserved for later uncomment
// import ActivationPage from "@/pages/ActivationPage";

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
// App shell
// ──────────────────────────────────────────────

export default function App() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const theme = useAdminStore((s) => s.theme);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasAccess = usePermission(page);

  // Check stored token on mount
  useEffect(() => {
    initAllStores();
  }, []);

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

  return (
    <StoreProvider initialStoreId="store_1">
      {isAuthenticated ? (
        <div className="flex h-screen w-screen overflow-hidden">
          <NavigationBar />
          <main className="flex-1 overflow-auto p-4">
            {needsAdminGate ? (
              <AdminRoute>
                <PageComponent />
              </AdminRoute>
            ) : (
              <PageComponent />
            )}
          </main>
        </div>
      ) : (
        <LoginPage />
      )}
    </StoreProvider>
  );
}
