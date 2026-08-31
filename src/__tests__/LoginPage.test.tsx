import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import { ROLE_PERMISSIONS } from "@/store/auth";
import LoginPage from "@/pages/LoginPage";

const mocks = vi.hoisted(() => ({ loginShouldFail: false }));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve([])),
    post: vi.fn((path: string) => {
      if (path === "/auth/login") {
        if (mocks.loginShouldFail) {
          return Promise.reject(new Error("Credenciales inválidas"));
        }
        return Promise.resolve({
          token: "test-token",
          user: {
            id: 1,
            name: "admin",
            role: "admin",
            permissions: JSON.stringify(ROLE_PERMISSIONS.admin),
            active: true,
            created_at: new Date().toISOString(),
          },
        });
      }
      return Promise.resolve({});
    }),
    put: vi.fn(() => Promise.resolve(undefined)),
    del: vi.fn(() => Promise.resolve(undefined)),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

function resetAll() {
  useAuthStore.setState({ users: [], currentUser: null });
  useAppStore.setState({ page: "login" });
  mocks.loginShouldFail = false;
}

beforeEach(() => {
  resetAll();
});

describe("LoginPage", () => {
  it("renders login form with name and password inputs", () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText("Nombre de usuario")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });

  it("shows error message on invalid credentials", async () => {
    const user = userEvent.setup();
    mocks.loginShouldFail = true;

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await user.type(screen.getByPlaceholderText("Contraseña"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    });
  });

  it("navigates to dashboard on successful login", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await user.type(screen.getByPlaceholderText("Contraseña"), "admin");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(useAppStore.getState().page).toBe("dashboard");
    });
  });

  it("clears error when user retries with correct credentials", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    // First try wrong password
    mocks.loginShouldFail = true;
    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await user.type(screen.getByPlaceholderText("Contraseña"), "wrong");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    });

    // Now the server accepts
    mocks.loginShouldFail = false;
    const nameInput = screen.getByPlaceholderText("Nombre de usuario");
    const passInput = screen.getByPlaceholderText("Contraseña");
    await user.clear(nameInput);
    await user.clear(passInput);
    await user.type(nameInput, "admin");
    await user.type(passInput, "admin");

    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.queryByText("Credenciales inválidas")).toBeNull();
    });
  });
});