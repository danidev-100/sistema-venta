import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import App from "@/App";

describe("App — dashboard integration", () => {
  beforeEach(() => {
    useAuthStore.setState({
      users: [],
      currentUser: null,
      _hydrated: false,
    });
    localStorage.removeItem("auth_users");
    localStorage.removeItem("auth_current_user_id");
    useAppStore.setState({ page: "dashboard" });
  });

  it("renders DashboardPage when page is dashboard (PAGE_COMPONENTS)", async () => {
    // Bootstrap auth with admin user and login
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");
    useAppStore.setState({ page: "dashboard" });

    render(<App />);

    // DashboardPage renders "Panel Principal" as its header
    await waitFor(() => {
      expect(screen.getByText("Panel Principal")).toBeInTheDocument();
    });
  });
});
