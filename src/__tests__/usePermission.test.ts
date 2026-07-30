import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/auth";

function resetAuth() {
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
  localStorage.removeItem("auth_users");
  localStorage.removeItem("auth_current_user_id");
}

beforeEach(() => {
  resetAuth();
});

describe("usePermission", () => {
  it("returns true for pages that require 'ventas' permission when user has it", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    const { result } = renderHook(() => usePermission("pos"));
    expect(result.current).toBe(true);
  });

  it("returns false for pages that require 'ventas' when user lacks it", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["clientes"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    const { result } = renderHook(() => usePermission("pos"));
    expect(result.current).toBe(false);
  });

  it("returns true for pages that require 'clientes' permission when user has it", async () => {
    await useAuthStore.getState().init();
    // admin has all permissions
    await useAuthStore.getState().login("admin", "admin");

    const { result } = renderHook(() => usePermission("customers"));
    expect(result.current).toBe(true);
  });

  it("returns true for pages that require 'estadisticas' permission when user has it", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    const { result } = renderHook(() => usePermission("stats"));
    expect(result.current).toBe(true);
  });

  it("returns true for pages that require 'admin' when user has it", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    const { result } = renderHook(() => usePermission("admin"));
    expect(result.current).toBe(true);

    const { result: cashResult } = renderHook(() => usePermission("cash-closing"));
    expect(cashResult.current).toBe(true);
  });

  it("returns true for pages that require no permission when authenticated", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    const { result } = renderHook(() => usePermission("dashboard"));
    expect(result.current).toBe(true);

    const { result: productsResult } = renderHook(() => usePermission("products"));
    expect(productsResult.current).toBe(true);
  });

  it("returns false for all pages when not authenticated", async () => {
    await useAuthStore.getState().init();
    // Not logged in

    const { result: posResult } = renderHook(() => usePermission("pos"));
    expect(posResult.current).toBe(false);

    const { result: dashboardResult } = renderHook(() => usePermission("dashboard"));
    expect(dashboardResult.current).toBe(false);

    const { result: adminResult } = renderHook(() => usePermission("admin"));
    expect(adminResult.current).toBe(false);
  });

  it("returns true for 'login' page regardless of auth state", async () => {
    await useAuthStore.getState().init();

    const { result: noAuth } = renderHook(() => usePermission("login"));
    expect(noAuth.current).toBe(true);

    await useAuthStore.getState().login("admin", "admin");
    const { result: withAuth } = renderHook(() => usePermission("login"));
    expect(withAuth.current).toBe(true);
  });
});

