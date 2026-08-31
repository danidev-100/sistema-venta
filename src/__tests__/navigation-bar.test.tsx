import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore, type AuthUser, type Permission } from "@/store/auth";
import { StoreProvider } from "@/store/context";
import NavigationBar from "@/components/NavigationBar";

// El sidebar se renderiza dos veces (desktop aside + drawer móvil), así que
// los textos de navegación aparecen duplicados en el DOM. Usamos getAllByText.

function renderNav() {
  return render(
    <StoreProvider initialStoreId="store_1">
      <NavigationBar />
    </StoreProvider>,
  );
}

function makeUser(
  name: string,
  permissions: Permission[],
  role: "admin" | "custom" = "custom",
): AuthUser {
  return {
    id: 1,
    name,
    role,
    permissions,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function setCurrentUser(user: AuthUser | null) {
  useAuthStore.setState({ currentUser: user });
}

function resetState() {
  useAuthStore.setState({ users: [], currentUser: null });
  useAppStore.setState({ page: "dashboard" });
}

beforeEach(() => {
  resetState();
});

describe("NavigationBar — dashboard integration", () => {
  it("shows Inicio button as a navigation item", () => {
    renderNav();
    expect(screen.getAllByText("Inicio").length).toBeGreaterThan(0);
  });

  it("clicking Inicio navigates to dashboard page", async () => {
    const user = userEvent.setup();
    // Start on a different page
    useAppStore.setState({ page: "pos" });
    renderNav();

    await user.click(screen.getAllByText("Inicio")[0]);
    expect(useAppStore.getState().page).toBe("dashboard");
  });
});

// ──────────────────────────────────────────────
// Permission-based navigation filtering (Task 3.3)
// ──────────────────────────────────────────────

const ALL_PERMISSIONS: Permission[] = [
  "ventas",
  "caja",
  "productos",
  "clientes",
  "proveedores",
  "pedidos",
  "facturacion",
  "comprobantes",
  "gastos",
  "estadisticas",
  "admin",
  "usuarios",
];

describe("NavigationBar — permission filtering", () => {
  it("shows all pages for admin user with all permissions", () => {
    setCurrentUser(makeUser("admin", ALL_PERMISSIONS, "admin"));

    renderNav();

    expect(screen.getAllByText("Inicio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("POS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Caja").length).toBeGreaterThan(0);

    // Config section is visible (open by default in sidebar)
    expect(screen.getAllByText("Configuración").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Productos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Facturación").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estadísticas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("hides stats page when user lacks estadisticas permission", () => {
    setCurrentUser(
      makeUser("limited", [
        "ventas",
        "caja",
        "productos",
        "clientes",
        "proveedores",
        "pedidos",
        "facturacion",
        "comprobantes",
        "gastos",
        "admin",
        "usuarios",
      ]),
    );

    renderNav();

    expect(screen.queryAllByText("Estadísticas")).toHaveLength(0);
    expect(screen.getAllByText("Facturación").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("hides customers page when user lacks clientes permission", () => {
    setCurrentUser(
      makeUser("limited", [
        "ventas",
        "caja",
        "productos",
        "proveedores",
        "pedidos",
        "facturacion",
        "comprobantes",
        "gastos",
        "estadisticas",
        "admin",
        "usuarios",
      ]),
    );

    renderNav();

    expect(screen.queryAllByText("Clientes")).toHaveLength(0);
    expect(screen.getAllByText("Estadísticas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Facturación").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("hides admin page when user lacks admin permission", () => {
    setCurrentUser(makeUser("limited", ["ventas", "caja", "productos"]));

    renderNav();

    expect(screen.queryAllByText("Admin")).toHaveLength(0);
  });

  it("shows only Inicio when user has no permissions", () => {
    setCurrentUser(makeUser("limited", []));

    renderNav();

    expect(screen.getAllByText("Inicio").length).toBeGreaterThan(0);

    // All permission-gated pages should be hidden
    expect(screen.queryAllByText("POS")).toHaveLength(0);
    expect(screen.queryAllByText("Caja")).toHaveLength(0);

    // Config dropdown should not exist (no permitted sub-pages)
    expect(screen.queryAllByText("Configuración")).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────
// User info display and logout (Task 3.3)
// ──────────────────────────────────────────────

describe("NavigationBar — user info", () => {
  it("shows current user name", () => {
    setCurrentUser(makeUser("admin", ALL_PERMISSIONS, "admin"));

    renderNav();

    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
  });

  it("shows logout button", () => {
    setCurrentUser(makeUser("admin", ALL_PERMISSIONS, "admin"));

    renderNav();

    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Cerrar sesión").length).toBeGreaterThan(0);
  });

  it("logout button logs out and navigates to login page", async () => {
    const user = userEvent.setup();
    setCurrentUser(makeUser("admin", ALL_PERMISSIONS, "admin"));

    renderNav();

    await user.click(screen.getAllByTitle("Cerrar sesión")[0]);
    await user.click(screen.getByRole("button", { name: /sí, cerrar sesión/i }));

    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().page).toBe("login");
  });
});