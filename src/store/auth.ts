import { create } from "zustand";
import { api, setToken, clearToken } from "@/lib/api";

export type Permission =
  | "ventas"
  | "caja"
  | "productos"
  | "clientes"
  | "proveedores"
  | "pedidos"
  | "facturacion"
  | "comprobantes"
  | "gastos"
  | "estadisticas"
  | "admin"
  | "usuarios";

export type Role = "admin" | "custom";

export type AuthUser = {
  id: number;
  name: string;
  passwordHash?: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  createdAt: string;
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
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
  ],
  custom: [],
};

export type LoginResult = {
  success: boolean;
  error?: string;
};

export type AuthStore = {
  users: AuthUser[];
  currentUser: AuthUser | null;

  normalizeUser: (raw: Record<string, unknown>) => AuthUser;
  loadUsers: () => Promise<void>;
  login: (name: string, password: string) => Promise<LoginResult>;
  logout: () => void;

  addUser: (data: {
    name: string;
    password: string;
    role: Role;
    permissions?: Permission[];
    active: boolean;
  }) => Promise<void>;
  updateUser: (
    id: number,
    data: {
      name?: string;
      password?: string;
      role?: Role;
      permissions?: Permission[];
      active?: boolean;
    },
  ) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;

  hasPermission: (permission: Permission) => boolean;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  users: [],
  currentUser: null,

  /** Normalize a user returned from the server: parse permissions string -> array */
  normalizeUser(raw: Record<string, unknown>): AuthUser {
    return {
      id: raw.id as number,
      name: raw.name as string,
      passwordHash: raw.password_hash as string | undefined,
      role: raw.role as Role,
      permissions:
        typeof raw.permissions === "string"
          ? JSON.parse(raw.permissions)
          : (raw.permissions as Permission[]),
      active: raw.active === true || raw.active === 1,
      createdAt: (raw.created_at ?? raw.createdAt ?? "") as string,
    };
  },

  loadUsers: async () => {
    try {
      const raw = await api.get<Record<string, unknown>[]>("/users");
      set({ users: raw.map(get().normalizeUser) });
    } catch (err) {
      console.error("[auth] loadUsers failed:", err);
    }
  },

  login: async (name: string, password: string): Promise<LoginResult> => {
    try {
      const { token, user } = await api.post<{ token: string; user: AuthUser }>(
        "/auth/login",
        { username: name, password },
      );
      setToken(token);
      set({ currentUser: user as AuthUser });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Error al iniciar sesión" };
    }
  },

  logout: () => {
    clearToken();
    set({ currentUser: null });
  },

  addUser: async (data) => {
    const raw = await api.post<Record<string, unknown>>("/users", {
      name: data.name,
      password: data.password,
      role: data.role,
      permissions: data.permissions ?? ROLE_PERMISSIONS[data.role],
      active: data.active,
    });
    const user = get().normalizeUser(raw);
    set({ users: [...get().users, user] });
  },

  updateUser: async (id, data) => {
    // Stringify permissions array for the server
    const body: Record<string, unknown> = { ...data };
    if (Array.isArray(body.permissions)) {
      body.permissions = JSON.stringify(body.permissions);
    }
    const raw = await api.put<Record<string, unknown>>(`/users/${id}`, body);
    const updated = get().normalizeUser(raw);
    set({
      users: get().users.map((u) => (u.id === id ? updated : u)),
    });
    const { currentUser } = get();
    if (currentUser?.id === id) {
      set({ currentUser: updated });
    }
  },

  deleteUser: async (id) => {
    const { users, currentUser } = get();
    const user = users.find((u) => u.id === id);
    if (user && user.role === "admin") return;

    await api.del(`/users/${id}`);
    set({ users: users.filter((u) => u.id !== id) });

    if (currentUser?.id === id) {
      get().logout();
    }
  },

  hasPermission: (permission: Permission): boolean => {
    const { currentUser } = get();
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    return currentUser.permissions.includes(permission);
  },
}));
