import { useState, useMemo } from "react";
import { useAdminStore, type BulkPreviewItem, type BulkPriceOpts } from "@/store/admin";
import { useProductsStore, type Category } from "@/store/products";
import { useBrandsStore } from "@/store/brands";
import { useActiveStore } from "@/store/context";
import { useAppStore } from "@/store";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type BulkPriceModalProps = {
  onClose: () => void;
};

// ──────────────────────────────────────────────
// Target labels
// ──────────────────────────────────────────────

const TARGET_LABELS: Record<string, string> = {
  cost: "Precio de Costo",
  selling: "Precio de Venta",
  both: "Ambos Precios",
};

// ──────────────────────────────────────────────
// Preview grouping helper
// ──────────────────────────────────────────────

type ProductGroup = {
  name: string;
  cost?: BulkPreviewItem;
  selling?: BulkPreviewItem;
};

function groupPreviewByProduct(
  preview: BulkPreviewItem[],
): ProductGroup[] {
  const map = new Map<number, ProductGroup>();
  for (const item of preview) {
    const existing = map.get(item.productId) ?? {
      name: item.name,
      cost: undefined,
      selling: undefined,
    };
    if (item.field === "cost") existing.cost = item;
    else existing.selling = item;
    map.set(item.productId, existing);
  }
  return Array.from(map.values());
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

function flattenCategories(
  cats: Category[],
  parentId: number | null,
  depth: number,
  result: { id: number; label: string }[],
): { id: number; label: string }[] {
  cats
    .filter((c) => c.parent_id === parentId)
    .forEach((c) => {
      result.push({ id: c.id, label: `${"  ".repeat(depth)}${c.name}` });
      flattenCategories(cats, c.id, depth + 1, result);
    });
  return result;
}

export default function BulkPriceModal({ onClose }: BulkPriceModalProps) {
  const { storeId } = useActiveStore();
  const allCategories = useProductsStore((s) => s.categories);
  const storeCategories = useMemo(
    () => allCategories.filter((c) => c.store_id === storeId),
    [allCategories, storeId],
  );
  const flatCategories = useMemo(
    () => flattenCategories(storeCategories, null, 0, []),
    [storeCategories],
  );
  const brands = useBrandsStore((s) => s.brands);
  const storeBrands = brands.filter((b) => b.store_id === storeId);

  const bulkPricePreview = useAdminStore((s) => s.bulkPricePreview);
  const bulkPriceConfirm = useAdminStore((s) => s.bulkPriceConfirm);
  const clearBulkPreview = useAdminStore((s) => s.clearBulkPreview);
  const preview = useAdminStore((s) => s.preview);
  const showNotification = useAppStore((s) => s.showNotification);

  // ── Form state ──

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [brandId, setBrandId] = useState<number | "">("");
  const [draft, setDraft] = useState<string>("10");
  const [target, setTarget] = useState<"cost" | "selling" | "both">("selling");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived ──

  const parsedPercent = (() => {
    const normalized = draft.replace(",", ".");
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  })();
  const groupedPreview = useMemo(
    () => (preview ? groupPreviewByProduct(preview) : []),
    [preview],
  );

  // ── Handlers ──

  function handlePreview() {
    setError(null);

    if (parsedPercent === 0) {
      setError("El porcentaje no puede ser cero");
      return;
    }

    const opts: BulkPriceOpts = {
      percent: parsedPercent,
      target,
      storeId,
      categoryId: categoryId !== "" ? (categoryId as number) : undefined,
      brandId: brandId !== "" ? (brandId as number) : undefined,
    };

    bulkPricePreview(opts);
  }

  function handleApply() {
    setError(null);
    setApplying(true);

    try {
      bulkPriceConfirm();
      showNotification(
        `Precios actualizados correctamente — ${preview?.length ?? 0} campo(s) modificados`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al aplicar los cambios de precio",
      );
      setApplying(false);
    }
  }

  function handleCancel() {
    clearBulkPreview();
    onClose();
  }

  // ── Derived state ──

  const hasPreview = preview !== null && preview.length > 0;
  const canApply = hasPreview && !applying;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/40 dark:bg-black/60">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col dark:bg-gray-800">
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-pos-muted/20 shrink-0 dark:border-gray-700">
          <h2 className="text-lg font-bold text-pos-text dark:text-white">
            Aumento de Precio Masivo
          </h2>
          <button
            onClick={handleCancel}
            className="text-pos-muted text-xl leading-none touch-target w-10 h-10 flex items-center justify-center rounded-lg hover:bg-pos-background transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Cerrar aumento masivo"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-xl px-4 py-3 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ── Filter section ── */}
          <section>
              <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-3 dark:text-gray-400">
                Filtrar Productos
              </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="bulk-category"
                  className="block text-sm font-medium text-pos-text mb-1"
                >
                  Categoría
                </label>
                <select
                  id="bulk-category"
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface touch-target dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                >
                  <option value="">Todas las Categorías</option>
                  {flatCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bulk-brand"
                  className="block text-sm font-medium text-pos-text mb-1"
                >
                  Marca
                </label>
                <select
                  id="bulk-brand"
                  value={brandId}
                  onChange={(e) =>
                    setBrandId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface touch-target dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                >
                  <option value="">Todas las Marcas</option>
                  {storeBrands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Increase section ── */}
          <section>
            <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-3">
              Configuración del Aumento
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="bulk-percent"
                  className="block text-sm font-medium text-pos-text mb-1"
                >
                  Aumento %
                </label>
                <input
                  id="bulk-percent"
                  type="text"
                  inputMode="decimal"
                  value={draft}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^-?[\d,.]*$/.test(val) || val === "") {
                      setDraft(val);
                    }
                  }}
                  onBlur={() => {
                    if (draft) {
                      const n = parseFloat(draft.replace(",", "."));
                      if (!isNaN(n)) {
                        setDraft(n.toLocaleString("es-AR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        }));
                      }
                    }
                  }}
                  placeholder="10"
                  aria-label="Porcentaje de aumento"
                  className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface touch-target dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-pos-text mb-2">
                  Aplicar a
                </span>
                <div className="flex items-center gap-4 h-[38px]">
                  {(["cost", "selling", "both"] as const).map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-1.5 text-sm text-pos-text cursor-pointer touch-target"
                    >
                      <input
                        type="radio"
                        name="bulk-target"
                        value={opt}
                        checked={target === opt}
                        onChange={() => setTarget(opt)}
                        className="accent-pos-secondary"
                      />
                      {TARGET_LABELS[opt]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Preview button ── */}
          <button
            onClick={handlePreview}
            disabled={parsedPercent === 0}
            className="w-full px-4 py-2.5 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 disabled:opacity-50 transition-opacity dark:bg-blue-700"
          >
            {preview === null ? "Vista Previa" : "Actualizar Vista Previa"}
          </button>

          {/* ── Preview table ── */}
          {preview !== null && (
            <section>
              <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                Vista Previa — {preview.length} campo(s) en{" "}
                {new Set(preview.map((i) => i.productId)).size} producto(s)
              </h3>

              {preview.length === 0 ? (
                <div className="bg-pos-background/50 rounded-lg p-6 text-center dark:bg-gray-700/50">
                  <p className="text-sm text-pos-muted dark:text-gray-400">
                    No hay productos que coincidan con los filtros.
                  </p>
                  <p className="text-xs text-pos-muted/60 mt-1 dark:text-gray-500">
                    Probá cambiando la categoría o marca seleccionada.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-pos-muted/10 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-pos-background/50 text-pos-muted border-b border-pos-muted/10 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-medium">
                          Producto
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Campo
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Actual
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Nuevo
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-pos-success dark:text-green-400">
                          Cambio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedPreview.map((group) => (
                        <ProductPreviewRows
                          key={group.name}
                          group={group}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center gap-3 p-6 pt-4 border-t border-pos-muted/20 shrink-0 dark:border-gray-700">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 border border-pos-muted/30 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply}
            className="flex-1 px-4 py-3 bg-pos-accent text-white rounded-xl font-bold text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed dark:bg-amber-600"
          >
            {applying
              ? "Aplicando…"
              : hasPreview
                ? `Aplicar — ${preview!.length} campo(s)`
                : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Product preview rows sub-component
// ──────────────────────────────────────────────

function ProductPreviewRows({ group }: { group: ProductGroup }) {
  const rows: BulkPreviewItem[] = [];
  if (group.cost) rows.push(group.cost);
  if (group.selling) rows.push(group.selling);

  const rowSpan = rows.length;

  return (
    <>
      {rows.map((item, idx) => (
        <tr
          key={`${item.productId}-${item.field}`}
          className="border-b border-pos-muted/5 hover:bg-pos-background/30 transition-colors dark:border-gray-700 dark:hover:bg-gray-700/30"
        >
          {idx === 0 && (
            <td
              className="py-2 px-3 font-medium text-pos-text dark:text-white"
              rowSpan={rowSpan}
            >
              {item.name}
            </td>
          )}
          <td className="py-2 px-3 text-pos-muted capitalize dark:text-gray-400">
            {item.field === "cost" ? "Costo" : "Venta"}
          </td>
          <td className="py-2 px-3 num text-pos-muted">
            {formatCurrency(item.currentPrice)}
          </td>
          <td className="py-2 px-3 num text-pos-text font-semibold">
            {formatCurrency(item.newPrice)}
          </td>
          <td className="py-2 px-3 num text-pos-success">
            +{formatCurrency(item.newPrice - item.currentPrice)}
          </td>
        </tr>
      ))}
    </>
  );
}
