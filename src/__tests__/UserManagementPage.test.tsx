import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import UserManagementPage from "@/pages/UserManagementPage";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetAll() {
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
  useAppStore.setState({ page: "dashboard" });
  localStorage.removeItem("auth_users");
  localStorage.removeItem("auth_current_user_id");
}

async function loginAsAdmin() {
  await useAuthStore.getState().init();
  await useAuthStore.getState().login("admin", "admin");
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("UserManagementPage", () => {
  beforeEach(() => {
    resetAll();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Renders user table ──

  it("renders user table with existing users", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("POS / Ventas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estadísticas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Panel Admin").length).toBeGreaterThan(0);
  });

  it("renders add user button", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    expect(screen.getByRole("button", { name: /agregar usuario/i })).toBeInTheDocument();
  });

  // ── Add User modal ──

  it("opens add user modal when clicking add button", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    expect(screen.getByText(/nuevo usuario/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/contraseña/i)).toBeInTheDocument();
  });

  it("adds a new user successfully", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText(/nombre/i), "nuevo");
    await userEvent.type(screen.getByPlaceholderText(/contraseña/i), "1234");

    // Toggle a permission checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    // Click the first permission checkbox (Ventas)
    await userEvent.click(checkboxes[0]);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getAllByText("nuevo").length).toBeGreaterThan(0);
    });
  });

  it("shows validation error for empty name", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText(/contraseña/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(screen.getByText(/nombre.*obligatorio/i)).toBeInTheDocument();
  });

  it("shows validation error for empty password on new user", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText(/nombre/i), "nuevo");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(screen.getByText(/contraseña.*obligatoria/i)).toBeInTheDocument();
  });

  it("shows validation error for duplicate name", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText(/nombre/i), "admin");
    await userEvent.type(screen.getByPlaceholderText(/contraseña/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe/i)).toBeInTheDocument();
    });
  });

  // ── Edit user ──

  it("opens edit modal when clicking edit button", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getAllByLabelText(/editar admin/i)[0]);

    expect(screen.getByText(/editar usuario/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin")).toBeInTheDocument();
  });

  it("edits user name successfully", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    // Two "✎ Editar" buttons exist (desktop table + mobile card) — click the first
    await userEvent.click(screen.getAllByLabelText(/editar admin/i)[0]);

    const nameInput = screen.getByDisplayValue("admin");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "admin_mod");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getAllByText("admin_mod").length).toBeGreaterThan(0);
    });
  });

  it("edits user permissions successfully", async () => {
    await loginAsAdmin();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });

    render(<UserManagementPage />);

    // Click edit on "limited" user — pick first between desktop table + mobile card
    await userEvent.click(screen.getAllByLabelText(/editar limited/i)[0]);

    // The edit modal should show checkboxes — find all of them
    const checkboxes = screen.getAllByRole("checkbox");

    // Uncheck POS / Ventas (the first permission checkbox)
    // Find the checkbox labeled "POS / Ventas" and uncheck it
    const ventasCheckbox = screen.getByLabelText("POS / Ventas");
    await userEvent.click(ventasCheckbox);

    // Check "Clientes"
    const clientesCheckbox = screen.getByLabelText("Clientes");
    await userEvent.click(clientesCheckbox);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      // After saving, the "limited" user should not show "POS / Ventas" badge in table
      // But admin still has POS / Ventas — use within the limited row context
      const rows = screen.getAllByRole("row");
      const limitedRow = rows.find((r) => r.textContent?.includes("limited"));
      expect(limitedRow).toBeDefined();
      expect(limitedRow!.textContent).not.toContain("POS / Ventas");
      expect(limitedRow!.textContent).toContain("Clientes");
    });
  });

  // ── Delete user ──

  it("deletes a non-admin user", async () => {
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    await loginAsAdmin();
    await useAuthStore.getState().addUser({
      name: "deleteme",
      password: "pass",
      role: "custom",
      permissions: [],
      active: true,
    });

    render(<UserManagementPage />);

    expect(screen.getAllByText("deleteme").length).toBeGreaterThan(0);

    // Pick first delete button between desktop + mobile
    await userEvent.click(screen.getAllByLabelText(/eliminar deleteme/i)[0]);

    await waitFor(() => {
      expect(screen.queryAllByText("deleteme")).toHaveLength(0);
    });

    window.confirm = originalConfirm;
  });

  it("cannot delete the admin user", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    // Admin should have a lock icon or disabled delete button
    const adminElements = screen.getAllByText("admin");
    // The admin should not have a delete button with aria-label containing "eliminar admin"
    expect(screen.queryByLabelText(/eliminar admin/i)).toBeNull();
    // Admin should show a lock indicator (at least one lock icon exists)
    expect(screen.getAllByTitle(/admin.*no.*eliminar/i).length).toBeGreaterThan(0);
  });

  // ── Permission checkboxes render ──

  it("renders permission checkboxes in add modal", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    // All 12 permissions should be available as checkboxes
    expect(screen.getByLabelText("POS / Ventas")).toBeInTheDocument();
    expect(screen.getByLabelText("Caja / Cierres")).toBeInTheDocument();
    expect(screen.getByLabelText("Productos")).toBeInTheDocument();
    expect(screen.getByLabelText("Clientes")).toBeInTheDocument();
    expect(screen.getByLabelText("Proveedores")).toBeInTheDocument();
    expect(screen.getByLabelText("Pedidos")).toBeInTheDocument();
    expect(screen.getByLabelText("Facturación")).toBeInTheDocument();
    expect(screen.getByLabelText("Comprobantes")).toBeInTheDocument();
    expect(screen.getByLabelText("Gastos")).toBeInTheDocument();
    expect(screen.getByLabelText("Estadísticas")).toBeInTheDocument();
    expect(screen.getByLabelText("Panel Admin")).toBeInTheDocument();
    expect(screen.getByLabelText("Gestión Usuarios")).toBeInTheDocument();
  });

  // ── Cancel closes modal ──

  it("closes add modal on cancel", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));
    expect(screen.getByText(/nuevo usuario/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByText(/nuevo usuario/i)).toBeNull();
    });
  });
});

