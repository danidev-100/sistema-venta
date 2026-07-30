import { useState, type ReactNode } from "react";
import { useProductsStore, type Product } from "@/store/products";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  sale: "Venta",
  adjustment: "Ajuste",
};

const TYPE_COLORS: Record<string, string> = {
  purchase: "text-pos-success",
  sale: "text-pos-danger",
  adjustment: "text-pos-accent",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface StockMovementLogProps {
  product: Product | null;
  /** Fallback content when no product is selected. */
  emptyState?: ReactNode;
}

export default function StockMovementLog({
  product,
  emptyState,
}: StockMovementLogProps) {
  const stockMovements = useProductsStore((s) => s.stockMovements);
  const adjustStock = useProductsStore((s) => s.adjustStock);

  const [adjustValue, setAdjustValue] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const movements = product
    ? stockMovements
        .filter((m) => m.product_id === product.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];

  function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setAdjustError(null);

    if (!product) return;

    const qty = parseInt(adjustValue, 10);
    if (isNaN(qty)) {
      setAdjustError("Ingresá un número válido");
      return;
    }

    setAdjusting(true);
    adjustStock(product.id, qty);
    setAdjustValue("");
    setAdjusting(false);
  }

  // Empty state when no product selected
  if (!product) {
    return (
      <div className="flex items-center justify-center h-full">
        {emptyState ?? (
          <p className="text-xs text-pos-muted italic">
              Seleccioná un producto para ver sus movimientos
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Product summary */}
      <div className="mb-3 p-3 bg-pos-background rounded-lg">
        <p className="text-sm font-semibold text-pos-text truncate">
          {product.name}
        </p>
        <p className="text-xs text-pos-muted mt-0.5">
          Stock:{` `}
          <span
            className={`font-bold text-base ${
              product.stock < 0 ? "text-pos-danger" : "text-pos-success"
            }`}
          >
            {product.stock}
          </span>
        </p>
      </div>

      {/* Manual adjustment form */}
      <form
        onSubmit={handleAdjust}
        className="flex items-end gap-2 mb-3 p-2 border border-pos-muted/20 rounded-lg"
      >
        <div className="flex-1">
          <label
            htmlFor="adjust-stock"
            className="block text-xs font-medium text-pos-text mb-1"
          >
            Ajustar a:
          </label>
          <input
            id="adjust-stock"
            type="number"
            value={adjustValue}
            onChange={(e) => setAdjustValue(e.target.value)}
            placeholder="Nueva cantidad"
            className="w-full border border-pos-muted/30 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>
        <button
          type="submit"
          disabled={adjusting || !adjustValue.trim()}
          className="px-3 py-1.5 bg-pos-accent text-white rounded-lg text-xs font-medium touch-target hover:opacity-90 disabled:opacity-50"
        >
          Establecer
        </button>
      </form>

      {adjustError && (
        <p className="text-xs text-pos-danger mb-2">{adjustError}</p>
      )}

      {/* Movement table */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-xs font-semibold text-pos-text uppercase tracking-wide mb-1">
          Historial
        </h3>
        {movements.length === 0 ? (
          <p className="text-xs text-pos-muted italic py-4 text-center">
            Todavía no hay movimientos
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-pos-muted border-b border-pos-muted/20">
                <th className="text-left py-1 pr-2 font-medium">Fecha</th>
                <th className="text-left py-1 px-2 font-medium">Tipo</th>
                <th className="text-right py-1 px-2 font-medium">Cambio</th>
                <th className="text-right py-1 pl-2 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-pos-muted/10 hover:bg-pos-background/50"
                >
                  <td className="py-1.5 pr-2 text-pos-muted whitespace-nowrap">
                    {formatDate(m.created_at)}
                  </td>
                  <td className="py-1.5 px-2">
                    <span
                      className={`font-medium ${TYPE_COLORS[m.type] ?? ""}`}
                    >
                      {TYPE_LABELS[m.type] ?? m.type}
                    </span>
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-mono font-bold ${
                      m.delta >= 0 ? "text-pos-success" : "text-pos-danger"
                    }`}
                  >
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-mono">
                    {m.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
