import { useState, useEffect, useMemo } from "react";
import type { Category } from "@/store/products";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type BulkCategoryModalProps = {
  categories: Category[];
  selectedIds: number[];
  currentCategoryId: number | null;
  onApply: (categoryId: number | null) => void;
  onClose: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BulkCategoryModal({
  categories,
  selectedIds,
  currentCategoryId,
  onApply,
  onClose,
}: BulkCategoryModalProps) {
  const [selected, setSelected] = useState<number | null>(currentCategoryId);
  const [animOut, setAnimOut] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeWithAnim();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeWithAnim() {
    setAnimOut(true);
    setTimeout(onClose, 150);
  }

  // Build a tree for display
  const rootCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories],
  );

  const getChildren = (parentId: number) =>
    categories.filter((c) => c.parent_id === parentId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeWithAnim}
    >
      <div
        className={`w-full max-w-sm bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 mx-4 transition-all duration-150 ${
          animOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-5 pb-4 border-b border-pos-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pos-secondary/10 flex items-center justify-center text-lg">
              🏷️
            </div>
            <div>
              <h3 className="text-base font-bold text-pos-text">
                Cambiar Categoría
              </h3>
              <p className="text-xs text-pos-muted/60">
                {selectedIds.length} producto{selectedIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={closeWithAnim}
            className="w-8 h-8 flex items-center justify-center text-pos-muted/50 hover:text-pos-text rounded-lg hover:bg-pos-background/50 transition-colors touch-target"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            {/* "Sin categoría" option */}
            <button
              onClick={() => setSelected(null)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm touch-target transition-all ${
                selected === null
                  ? "bg-pos-background border-2 border-pos-secondary font-medium text-pos-text"
                  : "border-2 border-transparent text-pos-muted hover:bg-pos-background/50 hover:text-pos-text"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">📦</span>
                <span>Sin categoría</span>
                {selected === null && (
                  <span className="ml-auto text-pos-secondary">✓</span>
                )}
              </div>
            </button>

            {rootCategories.length === 0 && (
              <p className="text-xs text-pos-muted/50 text-center py-6 italic">
                No hay categorías creadas
              </p>
            )}

            {rootCategories.map((cat) => (
              <CategoryOption
                key={cat.id}
                category={cat}
                depth={0}
                isSelected={selected === cat.id}
                onSelect={setSelected}
                getChildren={getChildren}
              />
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-4 border-t border-pos-muted/10 flex gap-3">
          <button
            onClick={closeWithAnim}
            className="flex-1 px-4 py-2.5 border border-pos-muted/20 text-pos-muted rounded-xl text-sm font-medium touch-target hover:bg-pos-background/50 hover:text-pos-text transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onApply(selected);
              closeWithAnim();
            }}
            className="flex-1 px-4 py-2.5 bg-pos-secondary text-white rounded-xl text-sm font-bold touch-target transition-all hover:shadow-lg"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Recursive category option
// ──────────────────────────────────────────────

function CategoryOption({
  category,
  depth,
  isSelected,
  onSelect,
  getChildren,
}: {
  category: Category;
  depth: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
  getChildren: (parentId: number) => Category[];
}) {
  const children = getChildren(category.id);

  return (
    <>
      <button
        onClick={() => onSelect(category.id)}
        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm touch-target transition-all ${
          isSelected
            ? "bg-pos-background border-2 border-pos-secondary font-medium text-pos-text"
            : "border-2 border-transparent text-pos-muted hover:bg-pos-background/50 hover:text-pos-text"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base shrink-0">
            {children.length > 0 ? "📂" : "📄"}
          </span>
          <span className="truncate">{category.name}</span>
          {isSelected && (
            <span className="ml-auto text-pos-secondary shrink-0">✓</span>
          )}
        </div>
      </button>
      {children.map((child) => (
        <CategoryOption
          key={child.id}
          category={child}
          depth={depth + 1}
          isSelected={isSelected}
          onSelect={onSelect}
          getChildren={getChildren}
        />
      ))}
    </>
  );
}
