import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/store";
import {
  useAuthStore,
  type AuthUser,
  type Permission,
  type Role,
  ROLE_PERMISSIONS,
} from "@/store/auth";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";

// ──────────────────────────────────────────────
// Permission labels
// ──────────────────────────────────────────────

const PERMISSION_LABELS: Record<Permission, string> = {
  ventas: "POS / Ventas",
  caja: "Caja / Cierres",
  productos: "Productos",
  clientes: "Clientes",
  proveedores: "Proveedores",
  pedidos: "Pedidos",
  facturacion: "Facturación",
  comprobantes: "Comprobantes",
  gastos: "Gastos",
  estadisticas: "Estadísticas",
  admin: "Panel Admin",
  usuarios: "Gestión Usuarios",
};

const ALL_PERMISSIONS: Permission[] = [
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
];

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  custom: "Personalizado",
};

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type ModalMode = "add" | "edit";

type FormData = {
  name: string;
  password: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function UserManagementPage() {
  const setPage = useAppStore((s) => s.setPage);
  const users = useAuthStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.currentUser);
  const addUser = useAuthStore((s) => s.addUser);
  const updateUser = useAuthStore((s) => s.updateUser);
  const deleteUser = useAuthStore((s) => s.deleteUser);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<FormData>({
    name: "",
    password: "",
    role: "custom",
    permissions: [],
    active: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Modal helpers ──

  function openAddModal() {
    setModalMode("add");
    setEditingUser(null);
    setForm({
      name: "",
      password: "",
      role: "custom",
      permissions: [],
      active: true,
    });
    setError(null);
  }

  function openEditModal(user: AuthUser) {
    setModalMode("edit");
    setEditingUser(user);
    setForm({
      name: user.name,
      password: "",
      role: user.role,
      permissions: [...user.permissions],
      active: user.active,
    });
    setError(null);
  }

  function closeModal() {
    setModalMode(null);
    setEditingUser(null);
    setError(null);
  }

  // ── Form handlers ──

  function handleRoleChange(role: Role) {
    setForm((prev) => ({
      ...prev,
      role,
      permissions:
        role === "admin"
          ? [...ALL_PERMISSIONS]
          : prev.permissions.length === ALL_PERMISSIONS.length
            ? []
            : prev.permissions,
    }));
  }

  function togglePermission(perm: Permission) {
    setForm((prev) => {
      const has = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: has
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      };
    });
  }

  async function handleSave() {
    setError(null);

    // Validation
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (modalMode === "add" && !form.password) {
      setError("La contraseña es obligatoria");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "add") {
        await addUser({
          name: form.name.trim(),
          password: form.password,
          role: form.role,
          permissions:
            form.role === "admin" ? undefined : form.permissions,
          active: form.active,
        });
      } else if (editingUser) {
        await updateUser(editingUser.id, {
          name: form.name.trim() || undefined,
          password: form.password || undefined,
          role: form.role,
          permissions:
            form.role === "admin" ? undefined : form.permissions,
          active: form.active,
        });
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(user: AuthUser) {
    if (!confirm(`¿Eliminar al usuario "${user.name}"?`)) return;
    deleteUser(user.id);
  }

  function isAdmin(user: AuthUser): boolean {
    return user.role === "admin";
  }

  // ── Sorted + filtered users ──

  const filteredUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers.length]);

  // Scroll selected row into view
  useEffect(() => {
    if (!tableRef.current) return;
    const row = tableRef.current.children[selectedIndex] as HTMLElement | undefined;
    row?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  // ── Export ──

  const userColumns: ExportColumn[] = [
    { header: "Nombre", key: "nombre" },
    { header: "Rol", key: "rol" },
    { header: "Permisos", key: "permisos" },
    { header: "Estado", key: "estado" },
  ];

  const exportUsersPdf = useCallback(() => {
    const data = filteredUsers.map((u) => ({
      nombre: u.name,
      rol: ROLE_LABELS[u.role],
      permisos:
        u.permissions.length > 0
          ? u.permissions.map((p) => PERMISSION_LABELS[p]).join(", ")
          : "—",
      estado: u.active ? "Activo" : "Inactivo",
    }));
    exportTableToPdf(data, userColumns, "Usuarios");
  }, [filteredUsers]);

  const exportUsersExcel = useCallback(() => {
    const data = filteredUsers.map((u) => ({
      nombre: u.name,
      rol: ROLE_LABELS[u.role],
      permisos: u.permissions.map((p) => PERMISSION_LABELS[p]).join(", "),
      estado: u.active ? "Activo" : "Inactivo",
    }));
    exportToExcel(data, userColumns, "Usuarios");
  }, [filteredUsers]);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => setPage("admin")}
        className="flex items-center gap-1.5 text-sm text-pos-muted hover:text-pos-text transition-colors mb-4 touch-target"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-pos-text">
          Usuarios
          <span className="text-pos-muted font-normal ml-1">
            — {users.length}
          </span>
        </h2>
        {modalMode === null && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {users.length > 0 && (
              <>
                <button
                  onClick={exportUsersExcel}
                  className="text-sm px-2 sm:px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50"
                  title="Exportar a Excel"
                >
                  <span className="hidden sm:inline">Excel</span>
                  <span className="sm:hidden text-base" aria-hidden="true">📊</span>
                  <span className="sr-only">Excel</span>
                </button>
                <button
                  onClick={exportUsersPdf}
                  className="text-sm px-2 sm:px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50"
                  title="Exportar a PDF"
                >
                  <span className="hidden sm:inline">PDF</span>
                  <span className="sm:hidden text-base" aria-hidden="true">📄</span>
                  <span className="sr-only">PDF</span>
                </button>
              </>
            )}
            <button
              onClick={openAddModal}
              className="text-sm px-3 sm:px-4 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90 whitespace-nowrap"
            >
              <span className="sm:hidden text-base leading-none" aria-hidden="true">+</span>
              <span className="hidden sm:inline">+ Agregar Usuario</span>
              <span className="sr-only sm:sr-only">Agregar Usuario</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-pos-text mb-4">
              {modalMode === "add" ? "Nuevo Usuario" : "Editar Usuario"}
            </h3>

            {/* Error */}
            {error && (
              <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="mb-3">
              <label
                htmlFor="um-name"
                className="block text-sm font-medium text-pos-text mb-1"
              >
                Nombre
              </label>
              <input
                id="um-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre de usuario"
                className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface text-pos-text"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="mb-3">
              <label
                htmlFor="um-password"
                className="block text-sm font-medium text-pos-text mb-1"
              >
                Contraseña
                {modalMode === "edit" && (
                  <span className="text-pos-muted font-normal ml-1">
                    (dejar vacío para mantener)
                  </span>
                )}
              </label>
              <input
                id="um-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder={
                  modalMode === "edit"
                    ? "Dejar vacío para mantener"
                    : "Contraseña"
                }
                className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface text-pos-text"
              />
            </div>

            {/* Role */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-pos-text mb-1">
                Rol
              </label>
              <select
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface text-pos-text"
              >
                <option value="custom">{ROLE_LABELS.custom}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </select>
            </div>

            {/* Permissions */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-pos-text mb-2">
                Permisos
                {form.role === "admin" && (
                  <span className="text-pos-muted font-normal ml-1">
                    (rol admin tiene todos)
                  </span>
                )}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      form.role === "admin"
                        ? "border-pos-secondary/20 bg-pos-secondary/5 cursor-default"
                        : "border-pos-muted/10 hover:bg-pos-background/50 cursor-pointer"
                    } touch-target`}
                  >
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                      disabled={form.role === "admin"}
                      className="rounded border-pos-muted/30 text-pos-secondary focus:ring-pos-secondary disabled:opacity-60"
                      aria-label={PERMISSION_LABELS[perm]}
                    />
                    <span className="text-sm text-pos-text">
                      {PERMISSION_LABELS[perm]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer touch-target">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                  className="rounded border-pos-muted/30 text-pos-secondary focus:ring-pos-secondary"
                />
                <span className="text-sm text-pos-text">Usuario activo</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeModal}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-sm text-pos-text border border-pos-muted/30 rounded-lg touch-target hover:bg-pos-background/50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-sm bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
        onKeyDown={(e) => {
          if (filteredUsers.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const user = filteredUsers[selectedIndex];
            if (user) openEditModal(user);
          }
        }}
        placeholder="Buscar usuario por nombre…"
        className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target mb-3"
      />

      {/* User table (desktop) + Cards (mobile) */}
      {filteredUsers.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-pos-muted border-b border-pos-muted/20">
                  <th className="text-left py-2 pr-2 font-medium">Nombre</th>
                  <th className="text-left py-2 px-2 font-medium">Rol</th>
                  <th className="text-left py-2 px-2 font-medium">Permisos</th>
                  <th className="text-center py-2 px-2 font-medium">Estado</th>
                  <th className="text-right py-2 pl-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody ref={tableRef}>
                {filteredUsers.map((user, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                  <tr
                    key={user.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`border-b border-pos-muted/10 transition-colors ${
                      isSelected
                        ? "bg-pos-secondary/10 ring-1 ring-pos-secondary/30"
                        : "hover:bg-pos-background/50"
                    }`}
                  >
                    <td className="py-3 pr-2 font-medium text-pos-text">
                      <div className="flex items-center gap-1.5">
                        {user.name}
                        {isAdmin(user) && (
                          <span className="text-xs text-pos-muted" title="Admin — no se puede eliminar">🔒</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${user.role === "admin" ? "bg-pos-secondary/15 text-pos-secondary" : "bg-pos-muted/10 text-pos-muted"}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {user.permissions.length === 0 && (
                          <span className="text-xs text-pos-muted italic">Sin permisos</span>
                        )}
                        {user.permissions.map((perm) => (
                          <span key={perm} className="inline-block text-xs px-2 py-0.5 rounded-full bg-pos-secondary/10 text-pos-secondary font-medium">
                            {PERMISSION_LABELS[perm]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${user.active ? "bg-pos-success/10 text-pos-success" : "bg-pos-danger/10 text-pos-danger"}`}>
                        {user.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 pl-2 text-right whitespace-nowrap">
                      <button onClick={() => openEditModal(user)} className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target mr-1" aria-label={`Editar ${user.name}`}>
                        ✎ Editar
                      </button>
                      {!isAdmin(user) ? (
                        <button onClick={() => handleDelete(user)} className="text-xs px-2 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target" aria-label={`Eliminar ${user.name}`}>
                          ✕ Eliminar
                        </button>
                      ) : (
                        <span className="text-xs px-2 py-1 text-pos-muted">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2.5">
            {filteredUsers.map((user, i) => (
              <div
                key={user.id}
                className="card-enter relative bg-pos-surface rounded-xl shadow-sm border border-pos-muted/10 overflow-hidden active:scale-[0.99] transition-transform"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${user.active ? "bg-pos-success" : "bg-pos-muted/30"}`} />

                <div className="pl-4 pr-3.5 py-3">
                  {/* Top row: avatar + name + role + status */}
                  <div className="flex items-center gap-2.5 mb-2.5">
                    {/* Avatar circle */}
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${user.role === "admin" ? "bg-pos-secondary/15" : "bg-pos-muted/10"}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`w-4.5 h-4.5 ${user.role === "admin" ? "text-pos-secondary" : "text-pos-muted"}`}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>

                    {/* Name + admin badge */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-pos-text truncate">{user.name}</span>
                        {isAdmin(user) && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-pos-muted shrink-0">
                            <title>Admin — no se puede eliminar</title>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Role badge */}
                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md ${user.role === "admin" ? "bg-pos-secondary/12 text-pos-secondary" : "bg-pos-muted/8 text-pos-muted"}`}>
                      {ROLE_LABELS[user.role]}
                    </span>

                    {/* Status dot */}
                    <span className={`shrink-0 w-2 h-2 rounded-full ${user.active ? "bg-pos-success" : "bg-pos-danger"}`} title={user.active ? "Activo" : "Inactivo"} />
                  </div>

                  {/* Permissions */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {user.permissions.length === 0 && (
                      <span className="text-[11px] text-pos-muted italic">Sin permisos</span>
                    )}
                    {user.permissions.slice(0, 4).map((perm) => (
                      <span key={perm} className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-pos-secondary/8 text-pos-secondary font-medium tracking-tight">
                        {PERMISSION_LABELS[perm]}
                      </span>
                    ))}
                    {user.permissions.length > 4 && (
                      <span className="text-[10px] text-pos-muted font-medium px-1">
                        +{user.permissions.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-pos-secondary/20 text-pos-secondary bg-pos-secondary/5 active:bg-pos-secondary/15 touch-target transition-colors"
                      aria-label={`Editar ${user.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Editar</span>
                    </button>

                    {isAdmin(user) ? (
                      <span className="flex-1 flex items-center justify-center text-xs py-2 rounded-lg bg-pos-muted/5 text-pos-muted/50">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Protegido
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(user)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-pos-danger/20 text-pos-danger bg-pos-danger/5 active:bg-pos-danger/15 touch-target transition-colors"
                        aria-label={`Eliminar ${user.name}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {filteredUsers.length === 0 && modalMode === null && (
        <p className="text-xs text-pos-muted italic py-3 text-center">
          {search
            ? "No se encontraron usuarios con ese criterio de búsqueda"
            : 'No hay usuarios. Hacé clic en "+ Agregar Usuario" para crear uno.'}
        </p>
      )}
    </div>
  );
}
