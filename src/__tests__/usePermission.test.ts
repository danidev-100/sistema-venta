import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore, type AuthUser, type Permission } from "@/store/auth";

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

function setCurrentUser(user: AuthUser | null) {
  useAuthStore.setState({ currentUser: user });
}

beforeEach(() => {
  useAuthStore.setState({ users: [], currentUser: null });
});

describe("usePermission", () => {
  it("returns true for pages that require 'ventas' permission when user has it", () => {
    setCurrentUser(makeUser("vendedor", ["ventas"]));

    const { result } = renderHook(() => usePermission("pos"));
    expect(result.current).toBe(true);
  });

  it("returns false for pages that require 'ventas' when user lacks it", () => {
    setCurrentUser(makeUser("limited", ["clientes"]));

    const { result } = renderHook(() => usePermission("pos"));
    expect(result.current).toBe(false);
  });

  it("returns true for pages that require 'clientes' permission when user has it", () => {
    setCurrentUser(makeUser("admin", [], "admin"));

    const { result } = renderHook(() => usePermission("customers"));
    expect(result.current).toBe(true);
  });

  it("returns true for pages that require 'estadisticas' permission when user has it", () => {
    setCurrentUser(makeUser("admin", [], "admin"));

    const { result } = renderHook(() => usePermission("stats"));
    expect(result.current).toBe(true);
  });

  it("returns true for pages that require 'admin' when user has it", () => {
    setCurrentUser(makeUser("admin", [], "admin"));

    const { result } = renderHook(() => usePermission("admin"));
    expect(result.current).toBe(true);

    const { result: cashResult } = renderHook(() => usePermission("cash-closing"));
    expect(cashResult.current).toBe(true);
  });

  it("returns true for pages that require no permission when authenticated", () => {
    setCurrentUser(makeUser("admin", [], "admin"));

    const { result } = renderHook(() => usePermission("dashboard"));
    expect(result.current).toBe(true);

    const { result: productsResult } = renderHook(() => usePermission("products"));
    expect(productsResult.current).toBe(true);
  });

  it("returns false for all pages when not authenticated", () => {
    setCurrentUser(null);

    const { result: posResult } = renderHook(() => usePermission("pos"));
    expect(posResult.current).toBe(false);

    const { result: dashboardResult } = renderHook(() => usePermission("dashboard"));
    expect(dashboardResult.current).toBe(false);

    const { result: adminResult } = renderHook(() => usePermission("admin"));
    expect(adminResult.current).toBe(false);
  });

  it("returns true for 'login' page regardless of auth state", () => {
    setCurrentUser(null);

    const { result: noAuth } = renderHook(() => usePermission("login"));
    expect(noAuth.current).toBe(true);

    setCurrentUser(makeUser("admin", [], "admin"));
    const { result: withAuth } = renderHook(() => usePermission("login"));
    expect(withAuth.current).toBe(true);
  });
});