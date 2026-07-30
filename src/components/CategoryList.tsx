import { useState, useCallback } from "react";
import { useProductsStore, type Category } from "@/store/products";
import { useActiveStore } from "@/store/context";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CategoryList() {
  const { storeId } = useActiveStore();
  const categories = useProductsStore((s) => s.categories);
  const addCategory = useProductsStore((s) => s.addCategory);
  const updateCategory = useProductsStore((s) => s.updateCategory);
  const deleteCategory = useProductsStore((s) => s.deleteCategory);

  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");

  const storeCategories = categories
    .filter((c) => c.store_id === storeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleEdit(cat: Category) {
    setEditingCat(cat);
    setEditName(cat.name);
    setIsCreating(false);
  }

  function handleCreate() {
    setIsCreating(true);
    setEditingCat(null);
    setNewName("");
  }

  function handleCancel() {
    setEditingCat(null);
    setIsCreating(false);
  }

  function handleSaveCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      addCategory({ name: trimmed, parent_id: null, store_id: storeId });
      setIsCreating(false);
      setNewName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear la categoría");
    }
  }

  function handleSaveEdit() {
    if (!editingCat) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      updateCategory(editingCat.id, { name: trimmed, store_id: storeId });
      setEditingCat(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al actualizar la categoría");
    }
  }

  function handleDelete(cat: Category) {
    if (!confirm(`¿Eliminar la categoría "${cat.name}" y todas sus subcategorías?`))
      return;
    deleteCategory(cat.id);
  }

  const categoryColumns: ExportColumn[] = [
    { header: "Nombre", key: "nombre" },
  ];

  const exportPdf = useCallback(() => {
    const data = storeCategories.map((c) => ({ nombre: c.name }));
    exportTableToPdf(data, categoryColumns, "Categorías");
  }, [storeCategories]);

  const exportExcel = useCallback(() => {
    const data = storeCategories.map((c) => ({ nombre: c.name }));
    exportToExcel(data, categoryColumns, "Categorías");
  }, [storeCategories]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Categorías
          <span className="text-pos-muted font-normal normal-case ml-1">
            — {storeCategories.length}
          </span>
        </h3>
        <div className="flex items-center gap-1.5">
          {storeCategories.length > 0 && !isCreating && !editingCat && (
            <>
              <button
                onClick={exportExcel}
                className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors"
              >
                Excel
              </button>
              <button
                onClick={exportPdf}
                className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors"
              >
                PDF
              </button>
            </>
          )}
          {!isCreating && !editingCat && (
            <button
              onClick={handleCreate}
              className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90"
            >
              + Agregar Categoría
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="mb-3 p-3 bg-pos-background/50 rounded-lg border border-pos-muted/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveCreate();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="flex-1 text-sm border border-pos-muted/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pos-secondary"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="text-xs px-3 py-2 bg-pos-success text-white rounded-lg touch-target hover:opacity-90 disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs px-3 py-2 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingCat && (
        <div className="mb-3 p-3 bg-pos-background/50 rounded-lg border border-pos-muted/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="flex-1 text-sm border border-pos-muted/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pos-secondary"
            />
            <button
              type="submit"
              disabled={!editName.trim()}
              className="text-xs px-3 py-2 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90 disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs px-3 py-2 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      {/* Empty state */}
      {storeCategories.length === 0 && !isCreating && (
        <p className="text-xs text-pos-muted italic py-3 text-center">
          Todavía no hay categorías. Hacé clic en "+ Agregar Categoría" para crear una.
        </p>
      )}

      {/* Category table */}
      {storeCategories.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-pos-muted border-b border-pos-muted/20">
                <th className="text-left py-2 pr-2 font-medium">Nombre</th>
                <th className="text-right py-2 pl-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {storeCategories.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-pos-muted/10 transition-colors hover:bg-pos-background/50"
                >
                  <td className="py-2 pr-2 font-medium text-pos-text">
                    {cat.name}
                  </td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target mr-1"
                      aria-label={`Editar ${cat.name}`}
                    >
                      ✎ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="text-xs px-2 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target"
                      aria-label={`Eliminar ${cat.name}`}
                    >
                      ✕ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
