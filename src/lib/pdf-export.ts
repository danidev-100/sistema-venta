import type { Invoice } from "@/store/invoices";
import type { Comprobante } from "@/store/comprobantes";
import type { CreditPayment } from "@/store/customers";
import { renderTemplate, comprobanteToTemplateData, type ComprobanteLike, type TemplateData } from "@/lib/render-template";
import { getDefaultTemplate } from "@/lib/default-templates";
import { usePlantillasStore } from "@/store/plantillas";
import { api } from "@/lib/api";
import { detectActiveCombos } from "@/lib/combos";
import { detectActiveBultos } from "@/lib/bultos";
import { useAppStore } from "@/store";
import { useCombosStore } from "@/store/combos";
import { useBultosStore } from "@/store/bultos";
import { useProductsStore } from "@/store/products";

// ──────────────────────────────────────────────
// Adapters
// ──────────────────────────────────────────────

function invoiceToComprobanteLike(invoice: Invoice, tipo: string): ComprobanteLike {
  return {
    tipo,
    numero: invoice.invoiceNumber,
    cliente_nombre: invoice.customer,
    cliente_cuit: null,
    cliente_direccion: null,
    fecha: invoice.date,
    subtotal: invoice.total,
    iva: 0,
    total: invoice.total,
    notes: null,
    items: invoice.items.map((item) => ({
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
    })),
  };
}

// ──────────────────────────────────────────────
// Build print HTML via template engine
// ──────────────────────────────────────────────

/**
 * Build the print HTML for a comprobante-like object.
 * Uses saved template (by tipo+storeId), falls back to default template on error.
 * Injects company data from CompanySettings.
 */
export async function buildComprobanteHtml(data: TemplateData, tipo: string, storeId: string): Promise<string> {
  // Fetch company data
  let companyLogo = "";
  try {
    const c = await api.get<{ name: string; phone: string; address: string; cuit: string; email: string; web: string; logo_base64: string; iva_alicuota: number }>(
      `/company?storeId=${storeId}`,
    );
    if (c) {
      data.company_name = c.name;
      data.company_phone = c.phone;
      data.company_address = c.address;
      data.company_cuit = c.cuit;
      data.company_email = c.email;
      data.company_web = c.web;
      data.iva_label = c.iva_alicuota ? `IVA ${c.iva_alicuota}%` : data.iva_label;
      companyLogo = c.logo_base64;
    }
  } catch {
    // Company data not available — use defaults
  }

  // Build logo src if available
  data.company_logo_src = companyLogo;

  try {
    const store = usePlantillasStore.getState();
    const template = await store.getPlantillaOrDefault(tipo, storeId);
    return renderTemplate(template, data);
  } catch {
    return renderTemplate(getDefaultTemplate(tipo), data);
  }
}

async function buildInvoiceHtml(invoice: Invoice, tipo = "factura"): Promise<string> {
  const data = comprobanteToTemplateData(invoiceToComprobanteLike(invoice, tipo));
  return buildComprobanteHtml(data, tipo, invoice.storeId);
}

// ──────────────────────────────────────────────
// Print helpers
// ──────────────────────────────────────────────

/** Print arbitrary HTML in a hidden iframe, then show the print dialog. */
export function exportHtmlAsPdf(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "none";
  iframe.title = "print-frame";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.log("print_fallback: no iframe contentWindow");
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.log("print_fallback error:", err);
    }
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 500);
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Print a comprobante via the browser's print dialog.
 * Uses saved template from Admin, falls back gracefully.
 */
export async function printComprobante(comprobante: Comprobante): Promise<void> {
  // Compute combo_savings from the completed sale if available
  let comboSavings = 0;
  let bultoSavings = 0;
  if (comprobante.sale_id != null) {
    const sale = useAppStore.getState().completedSales.find((s) => s.id === comprobante.sale_id);
    if (sale) {
      const combos = useCombosStore.getState().combos;
      const bultos = useBultosStore.getState().bultos;
      const products = useProductsStore.getState().products;
      const comboMatches = detectActiveCombos(sale.items, combos, products);
      comboSavings = comboMatches.reduce((sum, m) => sum + m.totalSavings, 0);
      const bultoMatches = detectActiveBultos(sale.items, bultos, products);
      bultoSavings = bultoMatches.reduce((sum, m) => sum + m.totalSavings, 0);
    }
  }

  const data = comprobanteToTemplateData({ ...comprobante, combo_savings: comboSavings || undefined, bulto_savings: bultoSavings || undefined });
  const html = await buildComprobanteHtml(data, comprobante.tipo, comprobante.store_id);
  exportHtmlAsPdf(html);
}

/**
 * Print an invoice via the browser's print dialog.
 */
export async function exportInvoicePdf(invoice: Invoice, tipo = "factura"): Promise<void> {
  const html = await buildInvoiceHtml(invoice, tipo);
  exportHtmlAsPdf(html);
}

/**
 * Print a full credit statement for a customer — all payments in chronological order.
 */
export function printCreditStatement(rows: CreditPayment[], customerName: string, currentBalance: number): void {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const items = sorted.map((p) => {
    running += p.amount;
    return { ...p, balanceAfter: Math.round(running * 100) / 100 };
  });

  const rowsHtml = items.map((p) => {
    const isCollection = p.amount < 0;
    const label = p.notes || (p.amount > 0 ? "Venta a cuenta" : "Cobro");
    const dateStr = new Date(p.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const amountStr = isCollection ? `-$${Math.abs(p.amount).toFixed(2)}` : `+$${p.amount.toFixed(2)}`;
    return `<tr><td style="padding:6px 8px;font-size:11px;font-family:monospace">${dateStr}</td><td style="padding:6px 8px">${label}</td><td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:bold;color:${isCollection ? "#16a34a" : "#dc2626"}">${amountStr}</td><td style="padding:6px 8px;text-align:right;font-family:monospace;color:${p.balanceAfter > 0 ? "#dc2626" : "#666"}">$${p.balanceAfter.toFixed(2)}</td></tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Estado de Cuenta</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .header { text-align: center; margin-bottom: 24px; }
  .header .sub { color: #666; font-size: 11px; }
  .balance-box { text-align: center; margin: 16px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; }
  .balance-box .amount { font-size: 28px; font-weight: bold; }
  .balance-box .amount.debt { color: #dc2626; }
  .balance-box .amount.clear { color: #16a34a; }
  table { width: 100%; border-collapse: collapse; }
  thead th { border-bottom: 2px solid #333; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; }
  thead th.right { text-align: right; }
  tbody tr:nth-child(even) { background: #f8f9fa; }
  tbody tr:hover { background: #e8f4fd; }
  .footer { text-align: center; color: #999; font-size: 10px; margin-top: 24px; border-top: 1px dashed #ccc; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Estado de Cuenta</h1>
    <div class="sub">${customerName}</div>
    <div class="sub">Emitido el ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
  </div>
  <div class="balance-box">
    <div style="color:#666;font-size:12px;margin-bottom:4px">SALDO ACTUAL</div>
    <div class="amount ${currentBalance > 0 ? "debt" : "clear"}">$${currentBalance.toFixed(2)}</div>
  </div>
  <table>
    <thead>
      <tr><th>Fecha</th><th>Concepto</th><th class="right">Monto</th><th class="right">Saldo</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    Documento generado por Sistema de Ventas<br>
    ${items.length} movimiento(s)
  </div>
</body>
</html>`;

  exportHtmlAsPdf(html);
}

/**
 * Print a credit payment receipt — either a sale (positive) or collection (negative).
 */
export async function printCreditPayment(payment: CreditPayment, customerName: string): Promise<void> {
  const isCollection = payment.amount < 0;
  const label = isCollection ? "RECIBO DE COBRO" : "VENTA A CUENTA";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${label}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 20px; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h1 { font-size: 18px; margin: 0 0 4px; }
  .header .sub { color: #666; font-size: 11px; }
  .info { margin-bottom: 16px; }
  .info div { margin-bottom: 4px; }
  .label { color: #666; }
  .amount { font-size: 28px; font-weight: bold; text-align: center; margin: 24px 0; }
  .amount.positive { color: #dc2626; }
  .amount.negative { color: #16a34a; }
  .footer { text-align: center; color: #999; font-size: 10px; margin-top: 32px; border-top: 1px dashed #ccc; padding-top: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; }
  td.r { text-align: right; }
</style>
</head>
<body>
  <div class="header">
    <h1>${label}</h1>
    <div class="sub">${new Date(payment.date).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
  </div>
  <div class="info">
    <table>
      <tr><td class="label">Cliente</td><td class="r">${customerName}</td></tr>
      ${payment.notes ? `<tr><td class="label">Concepto</td><td class="r">${payment.notes}</td></tr>` : ""}
      ${payment.sale_id ? `<tr><td class="label">Venta N°</td><td class="r">#${payment.sale_id}</td></tr>` : ""}
    </table>
  </div>
  <hr>
  <div class="amount ${isCollection ? "negative" : "positive"}">
    ${isCollection ? "" : "+"}$${Math.abs(payment.amount).toFixed(2)}
  </div>
  <hr>
  <div class="footer">
    Recibo generado por Sistema de Ventas<br>
    ID: #${payment.id}
  </div>
</body>
</html>`;

  exportHtmlAsPdf(html);
}
