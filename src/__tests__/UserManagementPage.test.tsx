import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import { ROLE_PERMISSIONS } from "@/store/auth";
import UserManagementPage from "@/pages/UserManagementPage";

// ──────────────────────────────────────────────
// La gestión de usuarios es server-side: el store habla con
// /users. El mock simula un mini-registro de usuarios.
// ──────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  nextId: 2,
}));

function makeAdminRaw(): Record<string, unknown> {
  return {
    id: 1,
    name: "admin",
    role: "admin",
    permissions: ROLE_PERMISSIONS.admin,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

vi.mock("@/lib/api", () => {
  const idFromPath = (path: string) => {
    const m = /(\d+)$/.exec(path.replace(/\/$/, ""));
    return m ? parseInt(m[1], 10) : undefined;
  };
  return {
    api: {
      get: vi.fn(() => Promise.resolve(Array.from(mockState.users.values()))),
      post: vi.fn((path: string, body: any) => {
        if (path === "/auth/login") {
          return Promise.resolve({ token: "test-token", user: makeAdminRaw() });
        }
        if (path === "/users") {
          if (mockState.users.has(body.name)) {
            return Promise.reject(new Error("El nombre de usuario ya existe"));
          }
          const user = {
            id: mockState.nextId++,
            name: body.name,
            role: body.role,
            permissions:
              body.permissions ?? ROLE_PERMISSIONS[body.role as "admin"] ?? [],
            active: body.active,
            createdAt: new Date().toISOString(),
          };
          mockState.users.set(body.name, user);
          return Promise.resolve(user);
        }
        return Promise.resolve({});
      }),
      put: vi.fn((path: string, body: any) => {
        const id = idFromPath(path);
        const existing = Array.from(mockState.users.values()).find(
          (u) => u.id === id,
        );
        const merged = { ...(existing ?? {}), ...body, id };
        if (body.permissions === undefined && existing) {
          // El backend conserva los permisos si no se envían (caso rol admin)
          merged.permissions = existing.permissions;
        }
        if (merged.permissions && typeof merged.permissions !== "string") {
          merged.permissions = JSON.stringify(merged.permissions);
        }
        if (typeof merged.name === "string" && existing) {
          const oldName = existing.name as string;
          mockState.users.delete(oldName);
        }
        mockState.users.set(merged.name as string, merged);
        return Promise.resolve(merged);
      }),
      del: vi.fn(() => Promise.resolve(undefined)),
    },
    setToken: vi.fn(),
    clearToken: vi.fn(),
  };
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetAll() {
  useAuthStore.setState({ users: [], currentUser: null });
  useAppStore.setState({ page: "dashboard" });
  mockState.users.clear();
  mockState.users.set("admin", makeAdminRaw());
  mockState.nextId = 2;
}

async function loginAsAdmin() {
  await useAuthStore.getState().login("admin", "admin");
}

async function renderPageAndWaitAdmin() {
  render(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
  });
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

    await renderPageAndWaitAdmin();

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
    expect(screen.getByPlaceholderText("Nombre de usuario")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contraseña")).toBeInTheDocument();
  });

  it("adds a new user successfully", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText("Nombre de usuario"), "nuevo");
    await userEvent.type(screen.getByPlaceholderText("Contraseña"), "1234");

    // Toggle a permission checkbox
    const checkboxes = screen.getAllByRole("checkbox");
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

    await userEvent.type(screen.getByPlaceholderText("Contraseña"), "1234");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(screen.getByText(/nombre.*obligatorio/i)).toBeInTheDocument();
  });

  it("shows validation error for empty password on new user", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText("Nombre de usuario"), "nuevo");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(screen.getByText(/contraseña.*obligatoria/i)).toBeInTheDocument();
  });

  it("shows validation error for duplicate name", async () => {
    await loginAsAdmin();

    render(<UserManagementPage />);

    await userEvent.click(screen.getByRole("button", { name: /agregar usuario/i }));

    await userEvent.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await userEvent.type(screen.getByPlaceholderText("Contraseña"), "1234");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe/i)).toBeInTheDocument();
    });
  });

  // ── Edit user ──

  it("opens edit modal when clicking edit button", async () => {
    await loginAsAdmin();

    await renderPageAndWaitAdmin();

    await userEvent.click(screen.getAllByLabelText(/editar admin/i)[0]);

    expect(screen.getByText(/editar usuario/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin")).toBeInTheDocument();
  });

  it("edits user name successfully", async () => {
    await loginAsAdmin();

    await renderPageAndWaitAdmin();

    // Two "Editar" buttons exist (desktop table + mobile card) — click the first
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

    await renderPageAndWaitAdmin();

    // Click edit on "limited" user — pick first between desktop table + mobile card
    await waitFor(() => {
      expect(screen.getAllByLabelText(/editar limited/i).length).toBeGreaterThan(0);
    });
    await userEvent.click(screen.getAllByLabelText(/editar limited/i)[0]);

    // Uncheck POS / Ventas
    const ventasCheckbox = screen.getByLabelText("POS / Ventas");
    await userEvent.click(ventasCheckbox);

    // Check "Clientes"
    const clientesCheckbox = screen.getByLabelText("Clientes");
    await userEvent.click(clientesCheckbox);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
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

    await renderPageAndWaitAdmin();

    await waitFor(() => {
      expect(screen.getAllByLabelText(/eliminar deleteme/i).length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getAllByLabelText(/eliminar deleteme/i)[0]);

    await waitFor(() => {
      expect(screen.queryAllByText("deleteme")).toHaveLength(0);
    });

    window.confirm = originalConfirm;
  });

  it("cannot delete the admin user", async () => {
    await loginAsAdmin();

    await renderPageAndWaitAdmin();

    // Admin should not have a delete button with aria-label "Eliminar admin"
    expect(screen.queryByLabelText(/eliminar admin/i)).toBeNull();
    // Admin should show a lock indicator
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