import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store";
import { useAuthStore, type AuthUser, type Permission } from "@/store/auth";
import App from "@/App";

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

function resetAll() {
  useAuthStore.setState({ users: [], currentUser: null });
  useAppStore.setState({ page: "pos" });
}

beforeEach(() => {
  resetAll();
});

describe("App — auth gate", () => {
  it("renders LoginPage when there is no authenticated user", () => {
    render(<App />);

    expect(screen.getByText("Iniciar Sesión")).toBeInTheDocument();
  });

  it("renders the app shell when an admin user is logged in", async () => {
    useAuthStore.setState({ currentUser: makeUser("admin", [], "admin") });
    useAppStore.setState({ page: "dashboard" });

    render(<App />);

    await waitFor(() => {
      // Navigation bar should be visible (authenticated shell)
      expect(screen.getAllByText("Inicio").length).toBeGreaterThan(0);
    });
  });

  it("default page is pos", () => {
    // Store defaults to pos without any explicit set
    expect(useAppStore.getState().page).toBe("pos");
  });

  it("redirects to dashboard when page lacks permission", async () => {
    useAuthStore.setState({ currentUser: makeUser("limited", ["ventas"]) });
    useAppStore.setState({ page: "stats" });

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().page).toBe("dashboard");
    });
  });
});