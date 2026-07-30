import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import LoginPage from "@/pages/LoginPage";

function resetAll() {
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
  useAppStore.setState({ page: "login" });
  localStorage.removeItem("auth_users");
  localStorage.removeItem("auth_current_user_id");
}

beforeEach(() => {
  resetAll();
});

describe("LoginPage", () => {
  it("renders login form with name and password inputs", async () => {
    await useAuthStore.getState().init();

    render(<LoginPage />);

    expect(screen.getByPlaceholderText("Nombre de usuario")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });

  it("shows error message on invalid credentials", async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().init();

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await user.type(screen.getByPlaceholderText("Contraseña"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    });
  });

  it("shows error message on deactivated user", async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().init();
    const admin = useAuthStore.getState().users[0];
    await useAuthStore.getState().updateUser(admin.id, { active: false });

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await user.type(screen.getByPlaceholderText("Contraseña"), "admin");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText("Usuario desactivado")).toBeInTheDocument();
    });
  });

  it("navigates to dashboard on successful login", async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().init();

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
    await useAuthStore.getState().init();

    render(<LoginPage />);

    // First try wrong password
    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "admin");
    await user.type(screen.getByPlaceholderText("Contraseña"), "wrong");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    });

    // Clear inputs and try again - error should still be there until new submit
    // The error gets replaced on each submit attempt
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
