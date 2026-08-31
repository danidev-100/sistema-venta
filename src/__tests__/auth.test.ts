import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore, ROLE_PERMISSIONS, type AuthUser } from "@/store/auth";

// ──────────────────────────────────────────────
// Mock the API client: el auth real es server-side
// (/auth/login, /users). El store no maneja hashing ni
// persistencia local — eso vive en el servidor.
// ──────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  /** Usuarios creados vía POST /users, en forma AuthUser (camelCase). */
  users: new Map<string, Record<string, unknown>>(),
  nextId: 2,
  loginShouldFail: false,
}));

vi.mock("@/lib/api", () => {
  const idFromPath = (path: string) => {
    const m = /(\d+)$/.exec(path.replace(/\/$/, ""));
    return m ? parseInt(m[1], 10) : undefined;
  };
  return {
    api: {
      get: vi.fn(() =>
        Promise.resolve(Array.from(mockState.users.values())),
      ),
      post: vi.fn((path: string, body: any) => {
        if (path === "/auth/login") {
          if (mockState.loginShouldFail) {
            return Promise.reject(new Error("Credenciales inválidas"));
          }
          const user = mockState.users.get(body?.username);
          if (!user || user.passwordHash !== "hashed_" + (body?.password ?? "")) {
            return Promise.reject(new Error("Credenciales inválidas"));
          }
          return Promise.resolve({ token: "test-token", user });
        }
        // /users → create and store
        const user: Record<string, unknown> = {
          id: mockState.nextId++,
          name: body.name,
          role: body.role,
          permissions: body.permissions ?? [],
          active: body.active,
          createdAt: new Date().toISOString(),
          passwordHash: "hashed_" + body.password,
        };
        mockState.users.set(body.name, user);
        return Promise.resolve(user);
      }),
      put: vi.fn((path: string, body: any) => {
        const id = idFromPath(path);
        const existing = Array.from(mockState.users.values()).find(
          (u) => u.id === id,
        );
        const merged = { ...(existing ?? {}), ...body, id };
        if (typeof merged.name === "string") {
          mockState.users.set(merged.name, merged);
        }
        return Promise.resolve(merged);
      }),
      del: vi.fn(() => Promise.resolve(undefined)),
    },
    setToken: vi.fn(),
    clearToken: vi.fn(),
  };
});

function resetStore() {
  useAuthStore.setState({ users: [], currentUser: null });
  mockState.users.clear();
  mockState.users.set("admin", {
    id: 1,
    name: "admin",
    role: "admin",
    permissions: ROLE_PERMISSIONS.admin,
    active: true,
    createdAt: new Date().toISOString(),
    passwordHash: "hashed_admin",
  });
  mockState.nextId = 2;
  mockState.loginShouldFail = false;
}

beforeEach(() => {
  resetStore();
});

function adminUser(): AuthUser {
  return useAuthStore.getState().users[0];
}

// ──────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────

describe("Auth store — login", () => {
  it("returns success with correct credentials", async () => {
    const result = await useAuthStore.getState().login("admin", "admin");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(useAuthStore.getState().currentUser).not.toBeNull();
    expect(useAuthStore.getState().currentUser!.name).toBe("admin");
  });

  it("returns error with wrong password", async () => {
    const result = await useAuthStore.getState().login("admin", "wrong");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Credenciales inválidas");
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("returns error when user does not exist", async () => {
    const result = await useAuthStore.getState().login("nobody", "pass");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Credenciales inválidas");
    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});

// ──────────────────────────────────────────────
// loadUsers
// ──────────────────────────────────────────────

describe("Auth store — loadUsers", () => {
  it("loads users from the server and normalizes permissions", async () => {
    await useAuthStore.getState().loadUsers();

    const users = useAuthStore.getState().users;
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("admin");
    expect(users[0].role).toBe("admin");
    expect(users[0].permissions).toEqual(ROLE_PERMISSIONS.admin);
    expect(users[0].active).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────

describe("Auth store — logout", () => {
  it("clears currentUser on logout", async () => {
    await useAuthStore.getState().login("admin", "admin");
    expect(useAuthStore.getState().currentUser).not.toBeNull();

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});

// ──────────────────────────────────────────────
// hasPermission
// ──────────────────────────────────────────────

describe("Auth store — hasPermission", () => {
  it("returns true when user has admin role", async () => {
    await useAuthStore.getState().login("admin", "admin");

    expect(useAuthStore.getState().hasPermission("ventas")).toBe(true);
    expect(useAuthStore.getState().hasPermission("admin")).toBe(true);
  });

  it("returns true when custom user has the specific permission", async () => {
    await useAuthStore.getState().addUser({
      name: "vendedor",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await useAuthStore.getState().login("vendedor", "pass");

    expect(useAuthStore.getState().hasPermission("ventas")).toBe(true);
  });

  it("returns false when custom user does not have the permission", async () => {
    await useAuthStore.getState().addUser({
      name: "vendedor",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await useAuthStore.getState().login("vendedor", "pass");

    expect(useAuthStore.getState().hasPermission("admin")).toBe(false);
    expect(useAuthStore.getState().hasPermission("estadisticas")).toBe(false);
  });

  it("returns false when no user is logged in", () => {
    expect(useAuthStore.getState().hasPermission("ventas")).toBe(false);
  });
});

// ──────────────────────────────────────────────
// User CRUD
// ──────────────────────────────────────────────

describe("Auth store — addUser", () => {
  it("adds a new user returned by the server", async () => {
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
    expect(added!.role).toBe("custom");
    expect(added!.permissions).toEqual(["ventas"]);
    expect(added!.active).toBe(true);
  });
});

describe("Auth store — updateUser", () => {
  it("updates user name", async () => {
    await useAuthStore.getState().loadUsers();
    const admin = adminUser();

    await useAuthStore.getState().updateUser(admin.id, { name: "admin2" });
    expect(useAuthStore.getState().users[0].name).toBe("admin2");
  });

  it("updates user permissions", async () => {
    await useAuthStore.getState().loadUsers();
    const admin = adminUser();

    await useAuthStore.getState().updateUser(admin.id, { permissions: ["ventas"] });
    expect(useAuthStore.getState().users[0].permissions).toEqual(["ventas"]);
  });
});

describe("Auth store — deleteUser", () => {
  it("deletes a non-admin user", async () => {
    await useAuthStore.getState().addUser({
      name: "user2",
      password: "pass",
      role: "custom",
      permissions: [],
      active: true,
    });

    const user2 = useAuthStore.getState().users.find((u) => u.name === "user2")!;
    await useAuthStore.getState().deleteUser(user2.id);

    const users = useAuthStore.getState().users;
    expect(users.find((u) => u.name === "user2")).toBeUndefined();
  });

  it("does not delete a user with admin role", async () => {
    await useAuthStore.getState().loadUsers();
    const admin = adminUser();

    await useAuthStore.getState().deleteUser(admin.id);

    // Guard: an admin user can't be removed through the store
    expect(useAuthStore.getState().users.find((u) => u.id === admin.id)).toBeDefined();
  });
});