import { useState } from "react";
import { useProductsStore, type Category } from "@/store/products";
import { useActiveStore } from "@/store/context";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type TreeNode = Category & {
  children: TreeNode[];
  depth: number;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function buildTree(
  categories: Category[],
  parentId: number | null,
  depth: number,
): TreeNode[] {
  return categories
    .filter((c) => c.parent_id === parentId)
    .map((c) => ({
      ...c,
      depth,
      children: buildTree(categories, c.id, depth + 1),
    }));
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface CategoryTreeProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onEdit: (category: Category) => void;
}

export default function CategoryTree({
  selectedId,
  onSelect,
  onEdit,
}: CategoryTreeProps) {
  const { storeId } = useActiveStore();
  const categories = useProductsStore((s) => s.categories);
  const addCategory = useProductsStore((s) => s.addCategory);
  const deleteCategory = useProductsStore((s) => s.deleteCategory);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addingParent, setAddingParent] = useState<number | null>(null);
  const [newName, setNewName] = useState("");

  const storeCategories = categories.filter((c) => c.store_id === storeId);
  const tree = buildTree(storeCategories, null, 0);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStartAdd(parentId: number | null) {
    setAddingParent(parentId);
    setNewName("");
  }

  function handleConfirmAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      addCategory({
        name: trimmed,
        parent_id: addingParent,
        store_id: storeId,
      });
      // Auto-expand parent so the new child is visible
      if (addingParent !== null) {
        setExpanded((prev) => new Set([...prev, addingParent]));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al agregar la categoría");
    }

    setAddingParent(null);
    setNewName("");
  }

  function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta categoría y todas sus subcategorías?")) return;
    deleteCategory(id);
    if (selectedId === id) onSelect(null);
  }

  function renderNode(node: TreeNode) {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;
    const isAdding = addingParent === node.id;

    return (
      <li key={node.id}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-colors touch-target select-none ${
            isSelected
              ? "bg-pos-secondary text-white"
              : "hover:bg-pos-background text-pos-text"
          }`}
          style={{ paddingLeft: `${12 + node.depth * 20}px` }}
          onClick={() => onSelect(isSelected ? null : node.id)}
        >
          {/* Expand/collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
            className="w-5 h-5 flex items-center justify-center text-xs text-pos-muted hover:text-pos-text"
            aria-label={isExpanded ? "Contraer" : "Expandir"}
          >
            {hasChildren ? (isExpanded ? "▾" : "▸") : "·"}
          </button>

          {/* Name */}
          <span className="flex-1 truncate text-sm font-medium">
            {node.name}
          </span>

          {/* Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node);
            }}
            className="text-xs text-pos-muted hover:text-pos-secondary px-1"
            aria-label="Editar categoría"
          >
            ✎
          </button>
          <button
            onClick={(e) => handleDelete(e, node.id)}
            className="text-xs text-pos-muted hover:text-pos-danger px-1"
            aria-label="Eliminar categoría"
          >
            ✕
          </button>
        </div>

        {/* Inline add form */}
        {isAdding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmAdd();
            }}
            className="flex items-center gap-1 px-2 py-1"
            style={{ paddingLeft: `${12 + (node.depth + 1) * 20}px` }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
               placeholder="Nombre de la categoría"
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
              onClick={() => setAddingParent(null)}
              className="text-xs px-2 py-1 bg-pos-danger text-white rounded touch-target"
            >
              ✕
            </button>
          </form>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <ul>{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Categorías
        </h2>
        <button
          onClick={() => handleStartAdd(null)}
          className="text-xs px-2 py-1 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90"
        >
          + Nueva
        </button>
      </div>

      {/* Root-level add form */}
      {addingParent === null && (
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
               placeholder="Nombre de la categoría"
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
            onClick={() => setAddingParent(null)}
            className="text-xs px-2 py-1 text-pos-muted hover:text-pos-danger touch-target"
          >
            ✕
          </button>
        </form>
      )}

      {/* Tree */}
      {storeCategories.length === 0 ? (
        <p className="text-xs text-pos-muted italic py-4 text-center">
          Todavía no hay categorías. Hacé clic en "+ Nueva" para crear una.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-0.5">
          {tree.map(renderNode)}
        </ul>
      )}
    </div>
  );
}
