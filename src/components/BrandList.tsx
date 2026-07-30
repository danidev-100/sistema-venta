import { useState, useCallback } from "react";
import { useBrandsStore, type Brand } from "@/store/brands";
import { useActiveStore } from "@/store/context";
import BrandForm from "./BrandForm";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BrandList() {
  const { storeId } = useActiveStore();
  const brands = useBrandsStore((s) => s.brands);
  const deleteBrand = useBrandsStore((s) => s.deleteBrand);

  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const storeBrands = brands
    .filter((b) => b.store_id === storeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleEdit(brand: Brand) {
    setEditingBrand(brand);
    setIsCreating(false);
  }

  function handleCreate() {
    setIsCreating(true);
    setEditingBrand(null);
  }

  function handleCancel() {
    setEditingBrand(null);
    setIsCreating(false);
  }

  function handleSaved() {
    setEditingBrand(null);
    setIsCreating(false);
  }

  const brandColumns: ExportColumn[] = [
    { header: "Nombre", key: "nombre" },
  ];

  const exportBrandsPdf = useCallback(() => {
    const data = storeBrands.map((b) => ({ nombre: b.name }));
    exportTableToPdf(data, brandColumns, "Marcas");
  }, [storeBrands]);

  const exportBrandsExcel = useCallback(() => {
    const data = storeBrands.map((b) => ({ nombre: b.name }));
    exportToExcel(data, brandColumns, "Marcas");
  }, [storeBrands]);

  function handleDelete(e: React.MouseEvent, brand: Brand) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la marca "${brand.name}"?`)) return;
    deleteBrand(brand.id);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Marcas
          <span className="text-pos-muted font-normal normal-case ml-1">
            — {storeBrands.length}
          </span>
        </h3>
        <div className="flex items-center gap-1.5">
          {storeBrands.length > 0 && !isCreating && !editingBrand && (
            <>
              <button
                onClick={exportBrandsExcel}
                className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Excel
              </button>
              <button
                onClick={exportBrandsPdf}
                className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                PDF
              </button>
            </>
          )}
          {!isCreating && !editingBrand && (
            <button
              onClick={handleCreate}
              className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90"
            >
              + Agregar Marca
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit form inline */}
      {(isCreating || editingBrand) && (
        <div className="mb-3 p-3 bg-pos-background/50 rounded-lg border border-pos-muted/10 dark:bg-gray-800/50 dark:border-gray-600/30">
          <BrandForm
            editBrand={editingBrand}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Empty state */}
      {storeBrands.length === 0 && !isCreating && (
        <p className="text-xs text-pos-muted italic py-3 text-center">
          Todavía no hay marcas. Hacé clic en "+ Agregar Marca" para crear una.
        </p>
      )}

      {/* Brand table */}
      {storeBrands.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-pos-muted border-b border-pos-muted/20 dark:text-gray-400 dark:border-gray-700">
                <th className="text-left py-2 pr-2 font-medium">Nombre</th>
                <th className="text-right py-2 pl-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {storeBrands.map((brand) => (
                <tr
                  key={brand.id}
                  className="border-b border-pos-muted/10 transition-colors hover:bg-pos-background/50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <td className="py-2 pr-2 font-medium text-pos-text">
                    {brand.name}
                  </td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(brand)}
                      className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target mr-1"
                      aria-label={`Editar ${brand.name}`}
                    >
                      ✎ Editar
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, brand)}
                      className="text-xs px-2 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target"
                      aria-label={`Eliminar ${brand.name}`}
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
