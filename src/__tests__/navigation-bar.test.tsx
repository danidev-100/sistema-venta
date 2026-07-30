import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import { StoreProvider } from "@/store/context";
import NavigationBar from "@/components/NavigationBar";

function renderNav() {
  return render(
    <StoreProvider initialStoreId="store_1">
      <NavigationBar />
    </StoreProvider>,
  );
}

describe("NavigationBar — dashboard integration", () => {
  beforeEach(() => {
    useAppStore.setState({ page: "dashboard" });
  });

  it("shows Inicio button as a navigation item", () => {
    renderNav();
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });

  it("clicking Inicio navigates to dashboard page", async () => {
    const user = userEvent.setup();
    // Start on a different page
    useAppStore.setState({ page: "pos" });
    renderNav();

    await user.click(screen.getByText("Inicio"));
    expect(useAppStore.getState().page).toBe("dashboard");
  });
});

// ──────────────────────────────────────────────
// Permission-based navigation filtering (Task 3.3)
// ──────────────────────────────────────────────

describe("NavigationBar — permission filtering", () => {
  beforeEach(async () => {
    useAuthStore.setState({
      users: [],
      currentUser: null,
      _hydrated: false,
    });
    localStorage.removeItem("auth_users");
    localStorage.removeItem("auth_current_user_id");
    useAppStore.setState({ page: "dashboard" });
  });

  it("shows all pages for admin user with all permissions", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    renderNav();

    // Sidebar: main pages visible (POS appears in subtitle + nav button)
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getAllByText("POS").length).toBeGreaterThan(0);
    expect(screen.getByText("Caja")).toBeInTheDocument();

    // Config section is visible (open by default in sidebar)
    expect(screen.getByText("Configuración")).toBeInTheDocument();
    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.getByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Estadísticas")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("hides stats page when user lacks estadisticas permission", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas", "caja", "productos", "clientes", "proveedores", "pedidos", "facturacion", "comprobantes", "gastos", "admin", "usuarios"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    renderNav();

    // Config section open by default — Estadísticas NOT in sidebar
    expect(screen.queryByText("Estadísticas")).toBeNull();
    // Other pages should be visible
    expect(screen.getByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("hides customers page when user lacks clientes permission", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas", "caja", "productos", "proveedores", "pedidos", "facturacion", "comprobantes", "gastos", "estadisticas", "admin", "usuarios"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    renderNav();

    expect(screen.queryByText("Clientes")).toBeNull();
    expect(screen.getByText("Estadísticas")).toBeInTheDocument();
    expect(screen.getByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("hides admin page when user lacks admin permission", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas", "caja", "productos"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    renderNav();

    // Admin should NOT appear (no admin permission)
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("shows only Inicio when user has no permissions", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: [],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    renderNav();

    // Dashboard is the only unconditional page
    expect(screen.getByText("Inicio")).toBeInTheDocument();

    // All permission-gated main pages should be hidden
    // "POS" appears only as sidebar subtitle (1 element), not as nav button
    const posElements = screen.queryAllByText("POS");
    expect(posElements.length).toBe(1); // just the subtitle
    expect(screen.queryByText("Caja")).toBeNull();

    // Config dropdown should not exist (no permitted sub-pages)
    expect(screen.queryByText("Configuración")).toBeNull();
  });
});

// ──────────────────────────────────────────────
// User info display and logout (Task 3.3)
// ──────────────────────────────────────────────

describe("NavigationBar — user info", () => {
  beforeEach(async () => {
    useAuthStore.setState({
      users: [],
      currentUser: null,
      _hydrated: false,
    });
    localStorage.removeItem("auth_users");
    localStorage.removeItem("auth_current_user_id");
    useAppStore.setState({ page: "dashboard" });
  });

  it("shows current user name", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    renderNav();

    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows logout button", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    renderNav();

    // Sidebar: user avatar with initial + logout icon
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByTitle("Cerrar sesión")).toBeInTheDocument();
  });

  it("logout button logs out and navigates to login page", async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    renderNav();

    await user.click(screen.getByTitle("Cerrar sesión"));

    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().page).toBe("login");
  });
});

