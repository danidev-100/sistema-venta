import { useMemo } from "react";
import { useInvoicesStore, type Invoice } from "@/store/invoices";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type InvoiceDetailProps = {
  invoiceId: number | null;
  onPrint: (invoice: Invoice) => void;
  onExportPdf: (invoice: Invoice) => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function InvoiceDetail({
  invoiceId,
  onPrint,
  onExportPdf,
}: InvoiceDetailProps) {
  const getInvoiceById = useInvoicesStore((s) => s.getInvoiceById);

  const invoice: Invoice | null = useMemo(
    () => (invoiceId !== null ? getInvoiceById(invoiceId) : null),
    [invoiceId, getInvoiceById],
  );

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full text-pos-muted">
        <p className="text-sm italic">
          Seleccioná una factura de la lista para ver los detalles
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-pos-text">
            {invoice.invoiceNumber}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => onPrint(invoice)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pos-secondary text-white hover:bg-pos-secondary/90 transition-colors"
            >
              🖨 Imprimir
            </button>
            <button
              onClick={() => onExportPdf(invoice)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pos-primary text-white hover:bg-pos-primary/90 transition-colors"
            >
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <span className="text-pos-muted text-xs">Factura N°</span>
            <p className="text-pos-text font-mono">
              {invoice.invoiceNumber}
            </p>
          </div>
          <div>
            <span className="text-pos-muted text-xs">Fecha</span>
            <p className="text-pos-text">
              {new Date(invoice.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div>
            <span className="text-pos-muted text-xs">Cliente</span>
            <p className="text-pos-text font-medium">{invoice.customer}</p>
          </div>
          <div>
            <span className="text-pos-muted text-xs">Pago</span>
            <p className="text-pos-text capitalize">
              {invoice.paymentMethod === "cash" ? "Efectivo" : invoice.paymentMethod === "mixed" ? "Mixto" : invoice.paymentMethod === "mercadopago" ? "Mercado Pago" : "Tarjeta"}
            </p>
          </div>
          <div>
            <span className="text-pos-muted text-xs">Venta N°</span>
            <p className="text-pos-text font-mono">{invoice.saleId}</p>
          </div>
          <div>
            <span className="text-pos-muted text-xs">Creado por</span>
            <p className="text-pos-text font-medium">{invoice.createdBy}</p>
          </div>
        </div>
      </div>

      <hr className="border-pos-muted/20 mb-4" />

      {/* ── Items Table ── */}
      <h3 className="text-xs font-semibold text-pos-text uppercase tracking-wide mb-2">
        Productos
      </h3>

      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-pos-muted uppercase tracking-wide border-b border-pos-muted/20">
              <th className="text-left py-1 pr-2 font-medium">#</th>
              <th className="text-left py-1 px-2 font-medium">Producto</th>
              <th className="text-center py-1 px-2 font-medium">Cant</th>
              <th className="text-right py-1 px-2 font-medium">Precio</th>
              <th className="text-right py-1 pl-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr
                key={item.productId}
                className="border-b border-pos-muted/10 last:border-0"
              >
                <td className="py-1.5 pr-2 text-pos-muted font-mono text-xs">
                  {idx + 1}
                </td>
                <td className="py-1.5 px-2 text-pos-text">
                  {item.productName}
                </td>
                <td className="py-1.5 px-2 text-center font-mono">
                  {item.quantity}
                </td>
                <td className="py-1.5 px-2 text-right font-mono">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="py-1.5 pl-2 text-right font-mono font-medium">
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr className="border-pos-muted/20 my-3" />

      {/* ── Totals ── */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-pos-muted">Subtotal</span>
          <span className="font-mono">{formatCurrency(invoice.total)}</span>
        </div>
        {invoice.paymentMethod === "cash" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-pos-muted">Monto Pagado</span>
              <span className="font-mono">
                {formatCurrency(invoice.total)}
              </span>
            </div>
            <div className="flex items-center justify-between text-pos-success">
              <span>Vuelto</span>
              <span className="font-mono">$0.00</span>
            </div>
          </>
        )}
        <hr className="border-pos-muted/20" />
        <div className="flex items-center justify-between font-bold text-pos-text">
          <span>Total</span>
          <span className="font-mono text-lg">
            {formatCurrency(invoice.total)}
          </span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-4 pt-3 border-t border-pos-muted/20 text-center">
        <p className="text-xs text-pos-muted italic">
          Gracias por tu compra
        </p>
        <p className="text-xs text-pos-muted/50 mt-0.5">
          {invoice.invoiceNumber} · {new Date(invoice.date).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
