import { useState, useCallback } from "react";
import { useAppStore, type CompletedSale } from "@/store";
import { useAuthStore } from "@/store/auth";
import { useActiveStore } from "@/store/context";
import {
  useInvoicesStore,
  type Invoice,
} from "@/store/invoices";
import { exportInvoicePdf } from "@/lib/pdf-export";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/format";
import InvoiceList from "@/components/InvoiceList";
import InvoiceDetail from "@/components/InvoiceDetail";

// ──────────────────────────────────────────────
// Print / Export helpers
// ──────────────────────────────────────────────

/** Send invoice to browser print dialog. */
async function invokePrint(invoice: Invoice): Promise<void> {
  await exportInvoicePdf(invoice, "ticket");
}

/** Generate PDF invoice and trigger download. */
async function invokeExportPdf(invoice: Invoice): Promise<void> {
  await exportInvoicePdf(invoice);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BillingPage() {
  const { storeId } = useActiveStore();
  const completedSales = useAppStore((s) => s.completedSales);
  const generateInvoice = useInvoicesStore((s) => s.generateInvoice);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null,
  );

  const handleGenerateInvoice = useCallback(async () => {
    const invoices = useInvoicesStore.getState().invoices;
    const sale = completedSales
      .filter((s) => s.storeId === storeId)
      .find(
        (s) => !invoices.some((inv) => inv.saleId === s.id),
      );

    if (!sale) {
      useAppStore.getState().showNotification(
        "No hay ventas pendientes para facturar en esta tienda",
      );
      return;
    }

    const invoice = await generateInvoice(sale, undefined, currentUser?.name);
    setSelectedInvoiceId(invoice.id);
    useAppStore
      .getState()
      .showNotification(`Factura ${invoice.invoiceNumber} generada`);
  }, [completedSales, storeId, generateInvoice]);

  const handlePrint = useCallback((_invoice: Invoice) => {
    invokePrint(_invoice);
    useAppStore
      .getState()
      .showNotification(`Imprimiendo ${_invoice.invoiceNumber}...`);
  }, []);

  const handleExportPdf = useCallback((_invoice: Invoice) => {
    invokeExportPdf(_invoice);
    useAppStore
      .getState()
      .showNotification(`Exportando ${_invoice.invoiceNumber} as PDF...`);
  }, []);

  const invoices = useInvoicesStore((s) => s.invoices);
  const invoiceColumns: ExportColumn[] = [
    { header: "Número", key: "numero" },
    { header: "Fecha", key: "fecha" },
    { header: "Cliente", key: "cliente" },
    { header: "Total", key: "total" },
    { header: "Pago", key: "pago" },
  ];

  const storeInvoices = invoices
    .filter((inv) => inv.storeId === storeId)
    .sort((a, b) => b.id - a.id);

  const exportInvoicesExcel = useCallback(() => {
    const data = storeInvoices.map((inv) => ({
      numero: inv.invoiceNumber,
      fecha: new Date(inv.date).toLocaleDateString("es-AR"),
      cliente: inv.customer,
      total: inv.total,
      pago: inv.paymentMethod === "cash" ? "Efectivo" : inv.paymentMethod === "mixed" ? "Mixto" : inv.paymentMethod === "mercadopago" ? "M. Pago" : "Tarjeta",
    }));
    exportToExcel(data, invoiceColumns, "Facturas");
  }, [storeInvoices]);

  const exportInvoicesPdf = useCallback(() => {
    const data = storeInvoices.map((inv) => ({
      numero: inv.invoiceNumber,
      fecha: new Date(inv.date).toLocaleDateString("es-AR"),
      cliente: inv.customer,
      total: formatCurrency(inv.total),
      pago: inv.paymentMethod === "cash" ? "Efectivo" : inv.paymentMethod === "mixed" ? "Mixto" : inv.paymentMethod === "mercadopago" ? "M. Pago" : "Tarjeta",
    }));
    exportTableToPdf(data, invoiceColumns, "Facturas");
  }, [storeInvoices]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* ── Left panel: Invoice List ── */}
      <aside className="w-full lg:w-80 flex-shrink-0 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto flex flex-col max-h-48 lg:max-h-full dark:bg-gray-800 dark:border-gray-600/30">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
            Facturas
          </h2>
          <div className="flex items-center gap-1.5">
            {storeInvoices.length > 0 && (
              <>
                <button
                  onClick={exportInvoicesExcel}
                  className="px-2 py-1 text-xs font-medium rounded-lg border border-pos-muted/30 text-pos-text hover:bg-pos-background/50 transition-colors"
                >
                  Excel
                </button>
                <button
                  onClick={exportInvoicesPdf}
                  className="px-2 py-1 text-xs font-medium rounded-lg border border-pos-muted/30 text-pos-text hover:bg-pos-background/50 transition-colors"
                >
                  PDF
                </button>
              </>
            )}
            <button
              onClick={handleGenerateInvoice}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-pos-secondary text-white hover:bg-pos-secondary/90 transition-colors"
            >
              + Generar
            </button>
          </div>
        </div>
        <InvoiceList
          storeId={storeId}
          selectedInvoiceId={selectedInvoiceId}
          onSelectInvoice={setSelectedInvoiceId}
        />
      </aside>

      {/* ── Right panel: Invoice Detail ── */}
      <section className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto dark:bg-gray-800 dark:border-gray-600/30">
        <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-4">
          Detalle de Factura
        </h2>
        <InvoiceDetail
          invoiceId={selectedInvoiceId}
          onPrint={handlePrint}
          onExportPdf={handleExportPdf}
        />
      </section>
    </div>
  );
}
