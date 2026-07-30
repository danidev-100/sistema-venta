import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useActiveStore } from "@/store/context";
import { useProveedoresStore, type Proveedor } from "@/store/proveedores";
import ProveedorForm from "@/components/ProveedorForm";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; proveedor: Proveedor };

export default function ProveedoresPage() {
  const { storeId } = useActiveStore();
  const proveedores = useProveedoresStore((s) => s.proveedores);
  const deleteProveedor = useProveedoresStore((s) => s.deleteProveedor);

  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  const storeProveedores = useMemo(
    () =>
      proveedores
        .filter((p) => p.store_id === storeId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [proveedores, storeId],
  );

  const filteredProveedores = useMemo(() => {
    if (!search.trim()) return storeProveedores;
    const q = search.toLowerCase();
    return storeProveedores.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.cuit.toLowerCase().includes(q),
    );
  }, [storeProveedores, search]);

  const columns: ExportColumn[] = [
    { header: "Nombre", key: "nombre" },
    { header: "Teléfono", key: "telefono" },
    { header: "Email", key: "email" },
    { header: "CUIT", key: "cuit" },
    { header: "Dirección", key: "direccion" },
  ];

  const exportPdf = useCallback(() => {
    const data = filteredProveedores.map((p) => ({
      nombre: p.name,
      telefono: p.phone || "—",
      email: p.email || "—",
      cuit: p.cuit || "—",
      direccion: p.address || "—",
    }));
    exportTableToPdf(data, columns, "Proveedores");
  }, [filteredProveedores]);

  const exportExcel = useCallback(() => {
    const data = filteredProveedores.map((p) => ({
      nombre: p.name,
      telefono: p.phone || "",
      email: p.email || "",
      cuit: p.cuit || "",
      direccion: p.address || "",
    }));
    exportToExcel(data, columns, "Proveedores");
  }, [filteredProveedores]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredProveedores.length]);

  // Scroll selected row into view
  useEffect(() => {
    if (!tableRef.current) return;
    const row = tableRef.current.children[selectedIndex] as HTMLElement | undefined;
    row?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  function handleCancel() { setView({ kind: "list" }); }
  function handleSaved() { setView({ kind: "list" }); }

  function handleDelete(p: Proveedor) {
    if (!window.confirm(`¿Eliminar a "${p.name}"? Esta acción no se puede deshacer.`)) return;
    deleteProveedor(p.id);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-pos-text">Proveedores</h1>
        {view.kind === "list" && (
          <div className="flex items-center gap-2">
            {filteredProveedores.length > 0 && (
              <>
                <button
                  onClick={exportExcel}
                  className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap"
                >
                  Excel
                </button>
                <button
                  onClick={exportPdf}
                  className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap"
                >
                  PDF
                </button>
              </>
            )}
            <button
              onClick={() => setView({ kind: "create" })}
              className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90 whitespace-nowrap"
            >
              + Nuevo Proveedor
            </button>
          </div>
        )}
      </div>

      {view.kind === "list" && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => {
              if (filteredProveedores.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, filteredProveedores.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const prov = filteredProveedores[selectedIndex];
                if (prov) setView({ kind: "edit", proveedor: prov });
              }
            }}
            placeholder="Buscar por nombre, teléfono, email o CUIT…"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />

          <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto">
            {filteredProveedores.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-pos-muted italic text-center">
                  {search
                    ? "No se encontraron proveedores con ese criterio de búsqueda"
                    : "Todavía no hay proveedores. Hacé clic en '+ Nuevo Proveedor' para crear uno."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-pos-muted border-b border-pos-muted/20">
                      <th className="text-left py-2 pr-2 font-medium">Nombre</th>
                      <th className="text-left py-2 px-2 font-medium">Teléfono</th>
                      <th className="text-left py-2 px-2 font-medium">Email</th>
                      <th className="text-left py-2 px-2 font-medium">CUIT</th>
                      <th className="text-right py-2 pl-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody ref={tableRef}>
                    {filteredProveedores.map((p, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                      <tr
                        key={p.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`border-b border-pos-muted/10 transition-colors ${
                          isSelected
                            ? "bg-pos-secondary/10 ring-1 ring-pos-secondary/30"
                            : "hover:bg-pos-background/50"
                        }`}
                      >
                        <td className="py-2 pr-2 font-medium text-pos-text">{p.name}</td>
                        <td className="py-2 px-2 text-pos-muted">{p.phone || "—"}</td>
                        <td className="py-2 px-2 text-pos-muted">{p.email || "—"}</td>
                        <td className="py-2 px-2 text-pos-muted font-mono text-xs">{p.cuit || "—"}</td>
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setView({ kind: "edit", proveedor: p })}
                            className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target"
                          >
                            ✎ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="text-xs px-2 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target ml-1"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view.kind === "create" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4">
          <ProveedorForm editProveedor={null} onSaved={handleSaved} onCancel={handleCancel} />
        </div>
      )}

      {view.kind === "edit" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4">
          <ProveedorForm editProveedor={view.proveedor} onSaved={handleSaved} onCancel={handleCancel} />
        </div>
      )}
    </div>
  );
}
