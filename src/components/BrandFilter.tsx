import { useState } from "react";
import { useBrandsStore } from "@/store/brands";
import { useActiveStore } from "@/store/context";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type Brand = {
  id: number;
  name: string;
  store_id: string;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface BrandFilterProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export default function BrandFilter({
  selectedId,
  onSelect,
}: BrandFilterProps) {
  const { storeId } = useActiveStore();
  const brands = useBrandsStore((s) => s.brands);
  const addBrand = useBrandsStore((s) => s.addBrand);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const storeBrands = brands
    .filter((b) => b.store_id === storeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleConfirmAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      addBrand({ name: trimmed, store_id: storeId });
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error al agregar la marca",
      );
    }

    setAdding(false);
    setNewName("");
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Marcas
        </h3>
        <button
          onClick={() => setAdding(true)}
          className="text-xs px-2 py-1 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90"
        >
          + Nueva
        </button>
      </div>

      {/* Inline add form */}
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmAdd();
          }}
          className="flex items-center gap-1 mb-2"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la marca"
            className="flex-1 text-sm border border-pos-muted/30 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pos-secondary"
          />
          <button
            type="submit"
            className="text-xs px-2 py-1 bg-pos-success text-white rounded touch-target"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs px-2 py-1 text-pos-muted hover:text-pos-danger touch-target"
          >
            ✕
          </button>
        </form>
      )}

      {/* Brand list */}
      {storeBrands.length === 0 && !adding ? (
        <p className="text-xs text-pos-muted italic py-2 text-center">
          No hay marcas todavía
        </p>
      ) : (
        <ul className="space-y-0.5">
          {/* "All brands" option */}
          {selectedId !== null && (
            <li>
              <button
                onClick={() => onSelect(null)}
                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm text-pos-muted hover:text-pos-text hover:bg-pos-background transition-colors touch-target"
              >
                <span className="text-xs">◯</span>
                <span>Todas las marcas</span>
              </button>
            </li>
          )}

          {storeBrands.map((brand) => {
            const isSelected = selectedId === brand.id;
            return (
              <li key={brand.id}>
                <button
                  onClick={() => onSelect(isSelected ? null : brand.id)}
                  className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-colors touch-target ${
                    isSelected
                      ? "bg-pos-secondary text-white font-medium"
                      : "text-pos-text hover:bg-pos-background"
                  }`}
                >
                  <span className="text-xs">
                    {isSelected ? "●" : "○"}
                  </span>
                  <span className="truncate">{brand.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
