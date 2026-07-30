import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store/auth";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function clearAuthStorage() {
  localStorage.removeItem("auth_users");
  localStorage.removeItem("auth_current_user_id");
}

function resetStore() {
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
}

beforeEach(() => {
  clearAuthStorage();
  resetStore();
});

// ──────────────────────────────────────────────
// First-run bootstrap
// ──────────────────────────────────────────────

describe("Auth store — first-run bootstrap", () => {
  it("creates admin user with all permissions when storage is empty", async () => {
    const store = useAuthStore.getState();
    await store.init();

    const users = useAuthStore.getState().users;
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("admin");
    expect(users[0].role).toBe("admin");
    expect(users[0].permissions).toEqual([
      "ventas",
      "caja",
      "productos",
      "clientes",
      "proveedores",
      "pedidos",
      "facturacion",
      "comprobantes",
      "gastos",
      "estadisticas",
      "admin",
      "usuarios",
    ]);
    expect(users[0].active).toBe(true);
    expect(useAuthStore.getState()._hydrated).toBe(true);
  });

  it("does not create admin user when users already exist", async () => {
    const store1 = useAuthStore.getState();
    await store1.init(); // creates admin

    // Simulate having an existing user in localStorage
    localStorage.setItem(
      "auth_users",
      JSON.stringify([
        {
          id: "existing-id",
          name: "existing",
          passwordHash: "abc",
          role: "custom",
          permissions: ["ventas"],
          active: true,
          createdAt: new Date().toISOString(),
        },
      ]),
    );

    resetStore();
    const store2 = useAuthStore.getState();
    await store2.init();

    const users = useAuthStore.getState().users;
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("existing");
  });
});

// ──────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────

describe("Auth store — login", () => {
  it("returns success with correct credentials", async () => {
    const store = useAuthStore.getState();
    await store.init();

    const result = await useAuthStore.getState().login("admin", "admin");
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(useAuthStore.getState().currentUser).not.toBeNull();
    expect(useAuthStore.getState().currentUser!.name).toBe("admin");
  });

  it("returns error with wrong password", async () => {
    const store = useAuthStore.getState();
    await store.init();

    const result = await useAuthStore.getState().login("admin", "wrong");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Credenciales inválidas");
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("returns error when user does not exist", async () => {
    const store = useAuthStore.getState();
    await store.init();

    const result = await useAuthStore.getState().login("nobody", "pass");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Credenciales inválidas");
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("returns error for deactivated user", async () => {
    const store = useAuthStore.getState();
    await store.init();
    const admin = useAuthStore.getState().users[0];
    await store.updateUser(admin.id, { active: false });

    const result = await useAuthStore.getState().login("admin", "admin");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Usuario desactivado");
    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});

// ──────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────

describe("Auth store — logout", () => {
  it("clears currentUser on logout", async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.login("admin", "admin");
    expect(useAuthStore.getState().currentUser).not.toBeNull();

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("removes currentUserId from localStorage on logout", async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.login("admin", "admin");
    expect(localStorage.getItem("auth_current_user_id")).not.toBeNull();

    useAuthStore.getState().logout();
    expect(localStorage.getItem("auth_current_user_id")).toBeNull();
  });
});

// ──────────────────────────────────────────────
// hasPermission
// ──────────────────────────────────────────────

describe("Auth store — hasPermission", () => {
  it("returns true when user has admin role", async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.login("admin", "admin");

    // Admin role has all permissions regardless of stored permissions
    expect(useAuthStore.getState().hasPermission("ventas")).toBe(true);
    expect(useAuthStore.getState().hasPermission("admin")).toBe(true);
  });

  it("returns true when custom user has the specific permission", async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.addUser({
      name: "vendedor",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await store.login("vendedor", "pass");

    expect(useAuthStore.getState().hasPermission("ventas")).toBe(true);
  });

  it("returns false when custom user does not have the permission", async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.addUser({
      name: "vendedor",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await store.login("vendedor", "pass");

    expect(useAuthStore.getState().hasPermission("admin")).toBe(false);
    expect(useAuthStore.getState().hasPermission("estadisticas")).toBe(false);
  });

  it("returns false when no user is logged in", async () => {
    const store = useAuthStore.getState();
    await store.init();

    expect(useAuthStore.getState().hasPermission("ventas")).toBe(false);
  });
});

// ──────────────────────────────────────────────
// User CRUD
// ──────────────────────────────────────────────

describe("Auth store — addUser", () => {
  it("adds a new user with hashed password", async () => {
    await useAuthStore.getState().init();
    const beforeCount = useAuthStore.getState().users.length;

    await useAuthStore.getState().addUser({
      name: "newuser",
      password: "secret123",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });

    const users = useAuthStore.getState().users;
    expect(users).toHaveLength(beforeCount + 1);
    const added = users.find((u) => u.name === "newuser");
    expect(added).toBeDefined();
    expect(added!.passwordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(added!.role).toBe("custom");
    expect(added!.permissions).toEqual(["ventas"]);
    expect(added!.active).toBe(true);
  });

  it("rejects duplicate name", async () => {
    await useAuthStore.getState().init();
    const addUser = useAuthStore.getState().addUser;

    await expect(
      addUser({
        name: "admin",
        password: "pass",
        role: "custom",
        permissions: [],
        active: true,
      }),
    ).rejects.toThrow("El nombre de usuario ya existe");
  });
});

describe("Auth store — updateUser", () => {
  it("updates user name", async () => {
    await useAuthStore.getState().init();
    const admin = useAuthStore.getState().users[0];

    await useAuthStore.getState().updateUser(admin.id, { name: "admin2" });
    expect(useAuthStore.getState().users[0].name).toBe("admin2");
  });

  it("updates user permissions", async () => {
    await useAuthStore.getState().init();
    const admin = useAuthStore.getState().users[0];

    await useAuthStore.getState().updateUser(admin.id, { permissions: ["ventas"] });
    expect(useAuthStore.getState().users[0].permissions).toEqual(["ventas"]);
  });

  it("rejects updating to a duplicate name", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "user2",
      password: "pass",
      role: "custom",
      permissions: [],
      active: true,
    });

    const admin = useAuthStore.getState().users.find((u) => u.name === "admin")!;
    await expect(
      useAuthStore.getState().updateUser(admin.id, { name: "user2" }),
    ).rejects.toThrow("El nombre de usuario ya existe");
  });
});

describe("Auth store — deleteUser", () => {
  it("deletes a non-admin user", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "user2",
      password: "pass",
      role: "custom",
      permissions: [],
      active: true,
    });

    const user2 = useAuthStore.getState().users.find((u) => u.name === "user2")!;
    useAuthStore.getState().deleteUser(user2.id);
    expect(useAuthStore.getState().users).toHaveLength(1);
    expect(useAuthStore.getState().users[0].name).toBe("admin");
  });

  it("does not delete the default admin user", async () => {
    await useAuthStore.getState().init();
    const admin = useAuthStore.getState().users[0];

    useAuthStore.getState().deleteUser(admin.id);
    expect(useAuthStore.getState().users).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────
// Session persistence
// ──────────────────────────────────────────────

describe("Auth store — session persistence", () => {
  it("restores session from localStorage on init", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");
    const userId = useAuthStore.getState().currentUser!.id;

    // Simulate reload
    resetStore();
    await useAuthStore.getState().init();

    expect(useAuthStore.getState().currentUser).not.toBeNull();
    expect(useAuthStore.getState().currentUser!.id).toBe(userId);
  });

  it("does not restore session for deactivated user", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");
    const adminId = useAuthStore.getState().currentUser!.id;

    // Deactivate and simulate reload
    await useAuthStore.getState().updateUser(adminId, { active: false });
    resetStore();

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});
