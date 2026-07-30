import { useAppStore, type CompletedSale } from "@/store";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ReceiptPreviewProps = {
  sale: CompletedSale;
  onPrint: () => void;
  onClose: () => void;
  onRefund?: () => void;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ReceiptPreview({
  sale,
  onPrint,
  onClose,
  onRefund,
}: ReceiptPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        {/* Receipt paper */}
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="text-center border-b border-dashed border-pos-muted/20 pb-4">
            <h2 className="text-lg font-bold text-pos-text">Venta Completa</h2>
            <p className="text-xs text-pos-muted font-mono mt-1">
              #{String(sale.id).padStart(6, "0")}
            </p>
          </div>

          {/* Store info */}
          <div className="text-center">
            <p className="text-sm font-medium text-pos-text">
              Tienda: {sale.storeId}
            </p>
            <p className="text-xs text-pos-muted font-mono mt-0.5">
              {formatDate(sale.date)}
            </p>
          </div>

          {/* Items */}
          <div className="border-t border-dashed border-pos-muted/20 pt-3">
            <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
              Productos
            </h3>
            <div className="space-y-2">
              {sale.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-start justify-between text-sm"
                >
                  <div className="flex-1 mr-2">
                    <span className="text-pos-text font-medium">
                      {item.productName}
                    </span>
                    <span className="text-pos-muted ml-1">
                      {item.saleUnit !== "unit"
                        ? item.quantity >= 1000
                          ? `${(item.quantity / 1000).toFixed(3)} kg`
                          : `${item.quantity} g`
                        : `x${item.quantity}`}
                    </span>
                    <div className="text-xs text-pos-muted font-mono">
                      {formatCurrency(item.unitPrice)}{item.saleUnit !== "unit" ? " /kg" : " c/u"}
                    </div>
                  </div>
                  <span className="font-mono font-medium text-pos-text whitespace-nowrap">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-pos-muted/20 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-pos-muted">Subtotal</span>
              <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-pos-muted">Descuento {sale.discountPercent > 0 ? `(${sale.discountPercent}%)` : ""}</span>
                <span className="font-mono text-pos-danger">−{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-bold pt-1 border-t border-pos-muted/10">
              <span className="text-pos-text">Total</span>
              <span className="font-mono text-pos-secondary">
                {formatCurrency(sale.total)}
              </span>
            </div>
          </div>

          {/* Payment info */}
          <div className="border-t border-dashed border-pos-muted/20 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-pos-muted">Pago</span>
              <span className="font-medium capitalize">
                {sale.paymentMethod}
              </span>
            </div>
            {sale.paymentMethod === "cash" && sale.amountPaid != null && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-pos-muted">Monto Pagado</span>
                  <span className="font-mono">
                    {formatCurrency(sale.amountPaid)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-pos-success">Vuelto</span>
                  <span className="font-mono text-pos-success">
                    {formatCurrency(sale.change ?? 0)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-double border-pos-muted/20 pt-3 text-center">
            <p className="text-xs text-pos-muted font-mono tracking-widest">
              • • • GRACIAS • • •
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onPrint}
              className="flex-1 px-4 py-3 border-2 border-pos-secondary text-pos-secondary rounded-xl font-bold text-sm touch-target hover:bg-pos-secondary/5 transition-colors"
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-pos-secondary text-white rounded-xl font-bold text-sm touch-target hover:opacity-90 transition-opacity"
            >
              Nueva Venta
            </button>
          </div>

          {sale.status !== "refunded" && onRefund && (
            <button
              onClick={() => {
                if (window.confirm(`¿Devolver venta #${sale.id} por ${formatCurrency(sale.total)}? El stock se va a restablecer.`)) {
                  onRefund();
                }
              }}
              className="w-full px-4 py-2 border border-pos-danger/30 text-pos-danger rounded-xl font-medium text-sm touch-target hover:bg-pos-danger/5 transition-colors"
            >
              ↩️ Devolver Venta
            </button>
          )}

          {sale.status === "refunded" && (
            <div className="w-full px-4 py-2 bg-pos-danger/10 border border-pos-danger/20 rounded-xl text-center">
              <span className="text-sm font-medium text-pos-danger">✗ Venta Devuelta</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
