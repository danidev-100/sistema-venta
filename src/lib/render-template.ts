/**
 * Pure template renderer for comprobante printing.
 *
 * Two-pass regex engine:
 *   Pass 1: {{#items}}...{{/items}} block iteration
 *   Pass 2: {{variable}} simple replacement
 *
 * All values are HTML-escaped before interpolation.
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type TemplateItemRow = {
  product_name: string;
  quantity: string;
  unit_price: string;
  subtotal: string;
  combo_name: string;
  bulto_name: string;
};

export type TemplateData = {
  cliente_nombre: string;
  cliente_cuit: string;
  cliente_direccion: string;
  numero: string;
  fecha: string;
  subtotal: string;
  iva: string;
  total: string;
  tipo_label: string;
  notes: string;
  items: TemplateItemRow[];
  /** Combo savings line — empty string when no combo applied */
  combo_savings: string;
  /** Bulto savings line — empty string when no bulto applied */
  bulto_savings: string;
  /** Company info — set from CompanySettings */
  company_name: string;
  company_phone: string;
  company_address: string;
  company_cuit: string;
  company_email: string;
  company_web: string;
  /** Raw base64 src for the logo image — template must wrap in <img> */
  company_logo_src: string;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ──────────────────────────────────────────────
// Render function
// ──────────────────────────────────────────────

export function renderTemplate(html: string, data: TemplateData): string {
  // Pass 1: items loop {{#items}}...{{/items}}
  let result = html.replace(/{{#items}}([\s\S]*?){{\/items}}/g, (_match, inner: string) => {
    if (!data.items || data.items.length === 0) return "";

    return data.items
      .map((item) => {
        // Render inner template for each item (pass-2 only: simple vars, no nested items)
        return inner.replace(/{{(\w+)}}/g, (_m, key: string) => {
          const value = (item as Record<string, string>)[key];
          return value != null ? escapeHtml(value) : "";
        });
      })
      .join("");
  });

  // Pass 2: simple variables {{var}}
  result = result.replace(/{{(\w+)}}/g, (_match, key: string) => {
    const value = (data as Record<string, unknown>)[key];
    if (value == null) return "";
    if (typeof value === "string") return escapeHtml(value);
    return "";
  });

  return result;
}

// ──────────────────────────────────────────────
// Comprobante → TemplateData mapper
// ──────────────────────────────────────────────

export type ComprobanteLike = {
  tipo: string;
  numero: string;
  cliente_nombre: string;
  cliente_cuit?: string | null;
  cliente_direccion?: string | null;
  fecha: string | Date;
  subtotal: number;
  iva: number;
  total: number;
  notes?: string | null;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    /** Optional — set when a combo discount was applied to this item */
    combo_name?: string | null;
    /** Optional — set when a bulto discount was applied to this item */
    bulto_name?: string | null;
  }>;
  /** Optional — total combo savings to display on the receipt */
  combo_savings?: number;
  /** Optional — total bulto savings to display on the receipt */
  bulto_savings?: number;
};

function fmt(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TIPO_LABELS: Record<string, string> = {
  factura: "Factura",
  boleta: "Boleta",
  ticket: "Ticket",
  nota_credito: "Nota de Crédito",
  nota_debito: "Nota de Débito",
};

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-AR");
}

export function comprobanteToTemplateData(c: ComprobanteLike, company?: Record<string, string>): TemplateData {
  return {
    cliente_nombre: c.cliente_nombre || "Consumidor Final",
    cliente_cuit: c.cliente_cuit ?? "",
    cliente_direccion: c.cliente_direccion ?? "",
    numero: c.numero,
    fecha: formatDate(c.fecha),
    subtotal: fmt(c.subtotal),
    iva: fmt(c.iva),
    total: fmt(c.total),
    tipo_label: TIPO_LABELS[c.tipo] || c.tipo,
    notes: c.notes ?? "",
    items: c.items.map((i) => ({
      product_name: i.product_name,
      quantity: String(i.quantity),
      unit_price: fmt(i.unit_price),
      subtotal: fmt(i.subtotal),
      combo_name: i.combo_name ?? "",
      bulto_name: i.bulto_name ?? "",
    })),
    combo_savings: c.combo_savings ? fmt(c.combo_savings) : "",
    bulto_savings: c.bulto_savings ? fmt(c.bulto_savings) : "",
    // Company info — defaults to empty, overridden by buildComprobanteHtml
    company_name: company?.name ?? "",
    company_phone: company?.phone ?? "",
    company_address: company?.address ?? "",
    company_cuit: company?.cuit ?? "",
    company_email: company?.email ?? "",
    company_web: company?.web ?? "",
    company_logo_src: company?.logo_base64 ?? "",
  };
}
