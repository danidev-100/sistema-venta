/**
 * Hardcoded default templates for comprobante printing.
 * Each template uses {{variable}} syntax compatible with renderTemplate().
 *
 * These are professional-grade templates with company placeholders.
 * Users customize them from Admin → Plantillas with their real data.
 */

// ═══════════════════════════════════════════
// CSS Styles
// ═══════════════════════════════════════════

const PAGE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: portrait; margin: 10mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 30px;
    max-width: 210mm;
    margin: 0 auto;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #1a1a1a; }
  .header-left { }
  .header-right { text-align: right; }
  .logo-placeholder {
    width: 80px; height: 80px;
    background: #f0f0f0;
    border: 2px dashed #ccc;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: #999;
    margin-bottom: 8px;
    margin-left: auto;
  }
  .company-name { font-size: 18px; font-weight: 800; letter-spacing: -0.3px; color: #1a1a1a; }
  .company-sublabel { font-size: 10px; color: #666; margin-top: 2px; }
  .company-info { font-size: 10px; color: #555; margin-top: 1px; }
  .doc-badge {
    display: inline-block;
    font-size: 24px; font-weight: 900;
    letter-spacing: 1px;
    padding: 4px 16px;
    border: 2px solid #1a1a1a;
    border-radius: 4px;
    margin-bottom: 4px;
  }
  .doc-number { font-size: 13px; font-weight: 600; color: #333; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; padding: 16px; background: #f8f8f8; border-radius: 8px; }
  .info-grid .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; }
  .info-grid .value { font-size: 12px; font-weight: 500; color: #1a1a1a; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  table.items thead th { background: #1a1a1a; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px; text-align: left; font-weight: 600; }
  table.items thead th:last-child { text-align: right; }
  table.items thead th:nth-child(2),
  table.items thead th:nth-child(3) { text-align: center; }
  table.items tbody td { padding: 10px 8px; border-bottom: 1px solid #e5e5e5; font-size: 11px; }
  table.items tbody td:last-child { text-align: right; font-weight: 600; }
  table.items tbody td:nth-child(2),
  table.items tbody td:nth-child(3) { text-align: center; }
  table.items tbody tr:nth-child(even) td { background: #fafafa; }
  .totals { margin-bottom: 20px; }
  .totals table { width: 100%; max-width: 300px; margin-left: auto; }
  .totals td { padding: 4px 8px; font-size: 11px; }
  .totals td:last-child { text-align: right; font-weight: 500; }
  .totals .line td { border-top: 1px solid #ccc; padding-top: 8px; }
  .totals .grand-total td { font-size: 15px; font-weight: 800; border-top: 2px solid #1a1a1a; padding-top: 8px; }
  .totals .grand-total td:last-child { font-size: 17px; }
  .notes-section { margin-top: 16px; padding: 12px 16px; background: #fff8e6; border-left: 3px solid #f5a623; border-radius: 4px; }
  .notes-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #b8860b; font-weight: 600; }
  .notes-text { font-size: 11px; color: #555; margin-top: 2px; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; }
  .footer .thanks { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .footer .legal { font-size: 9px; color: #999; margin-top: 4px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
`;

const THERMAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: portrait; margin: 5mm; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; color: #000; line-height: 1.3; }
  .center { text-align: center; }
  .company-name { font-size: 16px; font-weight: bold; text-align: center; }
  .company-info { font-size: 10px; text-align: center; color: #444; }
  .doc-header { text-align: center; margin: 8px 0; }
  .doc-type { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
  .doc-number { font-size: 13px; font-weight: bold; }
  .sep-dash { text-align: center; letter-spacing: 2px; margin: 6px 0; border: none; border-top: 1px dashed #888; }
  .sep-thin { border: none; border-top: 1px solid #000; margin: 4px 0; }
  .info-line { font-size: 10px; margin: 1px 0; }
  .info-line b { display: inline-block; width: 60px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 3px 2px; border-bottom: 1px solid #000; font-size: 10px; }
  td { padding: 2px 2px; vertical-align: top; }
  .num { text-align: right; }
  .qty { text-align: center; }
  .totals { margin-top: 4px; }
  .totals td { padding: 1px 2px; font-size: 11px; }
  .totals td:last-child { text-align: right; }
  .grand-row td { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 4px; }
  .notes { font-size: 10px; margin-top: 8px; padding: 6px; border-top: 1px dashed #888; }
  .footer { text-align: center; margin-top: 12px; padding-top: 6px; border-top: 1px dashed #888; font-size: 10px; }
  .thanks { font-weight: bold; font-size: 12px; }
`;

function wrapPage(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PAGE_CSS}</style></head><body>${body}</body></html>`;
}

function wrapThermal(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${THERMAL_CSS}</style></head><body>${body}</body></html>`;
}

// ═══════════════════════════════════════════
// Shared partials
// ═══════════════════════════════════════════

const COMPANY_HEADER = `
  <div class="header">
    <div class="header-left">
      <div class="company-name">{{company_name}}</div>
      <div class="company-sublabel">{{company_cuit}}</div>
      <div class="company-info">{{company_address}}</div>
      <div class="company-info">{{company_phone}} · {{company_email}}</div>
      <div class="company-info">{{company_web}}</div>
    </div>
    <div class="header-right">
      <img src="{{company_logo_src}}" alt="Logo" style="max-height:60px;margin-bottom:8px;" />
    </div>
  </div>
`;

const INFO_GRID = `
  <div class="info-grid">
    <div>
      <div class="label">Cliente</div>
      <div class="value">{{cliente_nombre}}</div>
    </div>
    <div>
      <div class="label">CUIT / DNI</div>
      <div class="value">{{cliente_cuit}}</div>
    </div>
    <div>
      <div class="label">Dirección</div>
      <div class="value">{{cliente_direccion}}</div>
    </div>
    <div>
      <div class="label">Fecha de Emisión</div>
      <div class="value">{{fecha}}</div>
    </div>
  </div>
`;

const ITEMS_TABLE = `
  <table class="items">
    <thead>
      <tr>
        <th style="width:50%">Producto / Servicio</th>
        <th style="width:10%">Cant.</th>
        <th style="width:18%">P. Unit.</th>
        <th style="width:18%">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{product_name}}<br><span style="font-size:9px;color:#059669;">{{combo_name}}</span><br><span style="font-size:9px;color:#06b6d4;">{{bulto_name}}</span></td>
        <td style="text-align:center">{{quantity}}</td>
        <td style="text-align:center">{{unit_price}}</td>
        <td>{{subtotal}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>
`;

const ITEMS_TABLE_THERMAL = `
  <div class="sep-dash">─ ─ ─ ─ ─ ─ ─ ─</div>
  <table>
    <thead>
      <tr>
        <th style="width:44%">Producto</th>
        <th style="width:12%" class="qty">Cant</th>
        <th style="width:20%" class="num">Precio</th>
        <th style="width:20%" class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{product_name}}<br><span style="font-size:9px;color:#059669;">{{combo_name}}</span><br><span style="font-size:9px;color:#06b6d4;">{{bulto_name}}</span></td>
        <td class="qty">{{quantity}}</td>
        <td class="num">{{unit_price}}</td>
        <td class="num">{{subtotal}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>
  <div class="sep-dash">─ ─ ─ ─ ─ ─ ─ ─</div>
`;

const FOOTER = `
  <div class="footer">
    <div class="thanks">¡Gracias por su preferencia!</div>
    <div class="legal">
      {{company_name}} - {{company_cuit}}<br>
      {{company_address}} - {{company_email}}<br>
      {{numero}}
    </div>
  </div>
`;

const NOTES_BLOCK = `
  <div class="notes-section">
    <div class="notes-label">Notas</div>
    <div class="notes-text">{{notes}}</div>
  </div>
`;

const THERMAL_FOOTER = `
  <div class="footer">
    <div class="thanks">¡Gracias!</div>
    {{company_name}}<br>
    {{numero}}
  </div>
`;

// ═══════════════════════════════════════════
// Templates
// ═══════════════════════════════════════════

const FACTURA_TEMPLATE = wrapPage("Factura", `
  ${COMPANY_HEADER}

  <div style="text-align:center;margin-bottom:20px;">
    <div class="doc-badge">FACTURA</div>
    <div class="doc-number">{{numero}}</div>
  </div>

  ${INFO_GRID}

  ${ITEMS_TABLE}

  <div class="totals">
    <table>
      <tr><td style="text-align:right;color:#666;font-size:10px;">Subtotal</td><td>{{subtotal}}</td></tr>
      <tr><td style="text-align:right;color:#666;font-size:10px;">{{iva_label}}</td><td>{{iva}}</td></tr>
      <tr><td style="text-align:right;color:#059669;font-size:10px;">Ahorro combos</td><td style="color:#059669;">−{{combo_savings}}</td></tr>
      <tr><td style="text-align:right;color:#06b6d4;font-size:10px;">Ahorro bultos</td><td style="color:#06b6d4;">−{{bulto_savings}}</td></tr>
      <tr class="line"><td></td><td></td></tr>
      <tr class="grand-total"><td style="text-align:right;">TOTAL</td><td>{{total}}</td></tr>
    </table>
  </div>

  {{notes}}${NOTES_BLOCK}

  ${FOOTER}
`);

const BOLETA_TEMPLATE = wrapPage("Boleta", `
  ${COMPANY_HEADER}

  <div style="text-align:center;margin-bottom:20px;">
    <div class="doc-badge">BOLETA</div>
    <div class="doc-number">{{numero}}</div>
  </div>

  ${INFO_GRID}

  ${ITEMS_TABLE}

  <div class="totals">
    <table>
      <tr><td style="text-align:right;color:#666;font-size:10px;">Subtotal</td><td>{{subtotal}}</td></tr>
      <tr><td style="text-align:right;color:#059669;font-size:10px;">Ahorro combos</td><td style="color:#059669;">−{{combo_savings}}</td></tr>
      <tr><td style="text-align:right;color:#06b6d4;font-size:10px;">Ahorro bultos</td><td style="color:#06b6d4;">−{{bulto_savings}}</td></tr>
      <tr class="line"><td></td><td></td></tr>
      <tr class="grand-total"><td style="text-align:right;">TOTAL</td><td>{{total}}</td></tr>
    </table>
  </div>

  {{notes}}${NOTES_BLOCK}

  ${FOOTER}
`);

const TICKET_TEMPLATE = wrapThermal("Ticket", `
  <div class="center">
    <div class="company-name">{{company_name}}</div>
    <div class="company-info">{{company_cuit}}</div>
    <div class="company-info">{{company_address}}</div>
    <div class="company-info">{{company_phone}}</div>
  </div>

  <hr class="sep-dash">

  <div class="doc-header">
    <div class="doc-type">TICKET</div>
    <div class="doc-number" style="margin-top:2px;">{{numero}}</div>
  </div>

  <div style="margin:6px 0;">
    <div class="info-line"><b>Fecha:</b> {{fecha}}</div>
    <div class="info-line"><b>Cliente:</b> {{cliente_nombre}}</div>
  </div>

  ${ITEMS_TABLE_THERMAL}

  <table class="totals">
    <tr><td style="text-align:right;font-size:10px;color:#059669;">Ahorro combos</td><td class="num" style="font-size:10px;color:#059669;">−{{combo_savings}}</td></tr>
    <tr><td style="text-align:right;font-size:10px;color:#06b6d4;">Ahorro bultos</td><td class="num" style="font-size:10px;color:#06b6d4;">−{{bulto_savings}}</td></tr>
    <tr><td style="text-align:right;font-weight:bold;">TOTAL</td><td class="num" style="font-weight:bold;">{{total}}</td></tr>
  </table>

  <div class="center" style="margin-top:8px;font-size:10px;">
    IVA incluido: {{iva}}<br>
    {{cliente_cuit}}
  </div>

  {{notes}}<div class="notes">Notas: {{notes}}</div>

  ${THERMAL_FOOTER}
`);

const NOTA_CREDITO_TEMPLATE = wrapPage("Nota de Crédito", `
  ${COMPANY_HEADER}

  <div style="text-align:center;margin-bottom:20px;">
    <div class="doc-badge" style="border-color:#e53e3e;color:#e53e3e;">NOTA DE CRÉDITO</div>
    <div class="doc-number">{{numero}}</div>
  </div>

  <div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:12px 16px;margin-bottom:16px;text-align:center;">
    <span style="font-size:12px;color:#e53e3e;font-weight:600;">Documento que anula parcial o totalmente una factura</span>
  </div>

  ${INFO_GRID}

  ${ITEMS_TABLE}

  <div class="totals">
    <table>
      <tr><td style="text-align:right;color:#666;font-size:10px;">Subtotal</td><td>{{subtotal}}</td></tr>
      <tr><td style="text-align:right;color:#666;font-size:10px;">{{iva_label}}</td><td>{{iva}}</td></tr>
      <tr class="line"><td></td><td></td></tr>
      <tr class="grand-total"><td style="text-align:right;">TOTAL A CREDITAR</td><td>{{total}}</td></tr>
    </table>
  </div>

  {{notes}}${NOTES_BLOCK}

  ${FOOTER}
`);

const NOTA_DEBITO_TEMPLATE = wrapPage("Nota de Débito", `
  ${COMPANY_HEADER}

  <div style="text-align:center;margin-bottom:20px;">
    <div class="doc-badge" style="border-color:#dd6b20;color:#dd6b20;">NOTA DE DÉBITO</div>
    <div class="doc-number">{{numero}}</div>
  </div>

  <div style="background:#fffaf0;border:1px solid #feebc8;border-radius:8px;padding:12px 16px;margin-bottom:16px;text-align:center;">
    <span style="font-size:12px;color:#dd6b20;font-weight:600;">Documento que incrementa el monto de una factura</span>
  </div>

  ${INFO_GRID}

  ${ITEMS_TABLE}

  <div class="totals">
    <table>
      <tr><td style="text-align:right;color:#666;font-size:10px;">Subtotal</td><td>{{subtotal}}</td></tr>
      <tr><td style="text-align:right;color:#666;font-size:10px;">{{iva_label}}</td><td>{{iva}}</td></tr>
      <tr class="line"><td></td><td></td></tr>
      <tr class="grand-total"><td style="text-align:right;">TOTAL A DEBITAR</td><td>{{total}}</td></tr>
    </table>
  </div>

  {{notes}}${NOTES_BLOCK}

  ${FOOTER}
`);

// ── Cuenta Corriente ──

// ═══════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════

export const DEFAULT_TEMPLATES: Record<string, string> = {
  factura: FACTURA_TEMPLATE,
  boleta: BOLETA_TEMPLATE,
  ticket: TICKET_TEMPLATE,
  nota_credito: NOTA_CREDITO_TEMPLATE,
  nota_debito: NOTA_DEBITO_TEMPLATE,
};

export function getDefaultTemplate(tipo: string): string {
  return DEFAULT_TEMPLATES[tipo] ?? "";
}
