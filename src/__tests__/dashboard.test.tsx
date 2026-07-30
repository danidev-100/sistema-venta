import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "@/pages/DashboardPage";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStores() {
  useAppStore.setState({
    page: "dashboard",
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
    selectedCustomer: null,
    selectedCartItemId: null,
  });
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
}

function loginAsAdmin() {
  useAuthStore.setState({
    currentUser: {
      id: 999,
      name: "admin",
      passwordHash: "hash",
      role: "admin",
      permissions: ["ventas", "caja", "productos", "clientes", "proveedores", "pedidos", "facturacion", "comprobantes", "gastos", "estadisticas", "admin", "usuarios"],
      active: true,
      createdAt: new Date().toISOString(),
    },
    _hydrated: true,
  });
}

beforeEach(() => {
  resetStores();
  loginAsAdmin();
});

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("DashboardPage", () => {
  it("2.1/2.2 — renders 12 module cards as buttons", () => {
    render(<DashboardPage />);
    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(12);
  });

  it("2.1 — each card displays its label text", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Ventas")).toBeInTheDocument();
    expect(screen.getByText("Caja")).toBeInTheDocument();
    expect(screen.getByText("Inventario")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Proveedores")).toBeInTheDocument();
    expect(screen.getByText("Pedidos")).toBeInTheDocument();
    expect(screen.getByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Comprobantes")).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toBeInTheDocument();
    expect(screen.getByText("Estadísticas")).toBeInTheDocument();
    expect(screen.getByText("Configuración")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
  });

  it("2.1 — clicking Ventas navigates to pos page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Ventas"));
    expect(useAppStore.getState().page).toBe("pos");
  });

  it("2.1 — clicking Inventario navigates to products page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Inventario"));
    expect(useAppStore.getState().page).toBe("products");
  });

  it("2.1 — clicking Clientes navigates to customers page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Clientes"));
    expect(useAppStore.getState().page).toBe("customers");
  });

  it("2.1 — clicking Estadísticas navigates to stats page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Estadísticas"));
    expect(useAppStore.getState().page).toBe("stats");
  });

  it("2.1 — clicking Configuración navigates to admin page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Configuración"));
    expect(useAppStore.getState().page).toBe("admin");
  });

  it("2.1 — clicking Usuarios navigates to user-management page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Usuarios"));
    expect(useAppStore.getState().page).toBe("user-management");
  });

  it("2.1 — clicking Proveedores navigates to proveedores page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Proveedores"));
    expect(useAppStore.getState().page).toBe("proveedores");
  });

  it("2.1 — clicking Pedidos navigates to pedidos page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText("Pedidos"));
    expect(useAppStore.getState().page).toBe("pedidos");
  });

  it("2.1 — all 12 cards are enabled (none disabled)", () => {
    render(<DashboardPage />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(12);

    for (const btn of buttons) {
      expect(btn).toBeEnabled();
    }
  });

  it("2.2 — page renders header title Panel Principal", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Panel Principal")).toBeInTheDocument();
  });
});
