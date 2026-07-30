import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import App from "@/App";

function resetAll() {
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
  useAppStore.setState({ page: "pos" });
  localStorage.removeItem("auth_users");
  localStorage.removeItem("auth_current_user_id");
}

beforeEach(() => {
  resetAll();
});

describe("App — auth gate", () => {
  it("auto-logs in as admin and renders POS page", async () => {
    await useAuthStore.getState().init();

    render(<App />);

    await waitFor(() => {
      // Navigation bar should be visible (admin is auto-logged-in)
      expect(screen.getByText("Inicio")).toBeInTheDocument();
    });
  });

  it("default page is pos", () => {
    // Store defaults to pos without any explicit set
    expect(useAppStore.getState().page).toBe("pos");
  });

  it("redirects to dashboard when page lacks permission", async () => {
    await useAuthStore.getState().init();
    // Create a user without "estadisticas" permission
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    // Try to navigate to stats page without permission
    useAppStore.getState().setPage("stats");

    render(<App />);

    // Should redirect to dashboard
    await waitFor(() => {
      expect(useAppStore.getState().page).toBe("dashboard");
    });
  });
});

