import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store";
import { useAuthStore, type AuthUser } from "@/store/auth";
import App from "@/App";

function makeAdmin(): AuthUser {
  return {
    id: 1,
    name: "admin",
    role: "admin",
    permissions: [],
    active: true,
    createdAt: new Date().toISOString(),
  };
}

describe("App — dashboard integration", () => {
  beforeEach(() => {
    useAuthStore.setState({ users: [], currentUser: null });
    useAppStore.setState({ page: "dashboard" });
  });

  it("renders DashboardPage when page is dashboard (PAGE_COMPONENTS)", async () => {
    useAuthStore.setState({ currentUser: makeAdmin() });

    render(<App />);

    // DashboardPage renders "Panel Principal" as its header
    await waitFor(() => {
      expect(screen.getByText("Panel Principal")).toBeInTheDocument();
    });
  });
});