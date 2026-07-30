import { describe, it, expect } from "vitest";
import { renderTemplate, type TemplateData } from "@/lib/render-template";
import { getDefaultTemplate } from "@/lib/default-templates";

// ──────────────────────────────────────────────
// Shared company defaults
// ──────────────────────────────────────────────

const COMPANY_FIELDS = {
  company_name: "Mi Empresa S.R.L.",
  company_phone: "(011) 4567-8901",
  company_address: "Av. Corrientes 1234, CABA",
  company_cuit: "30-12345678-9",
  company_email: "contacto@miempresa.com",
  company_web: "www.miempresa.com",
  company_logo_src: "",
};

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

const sampleData: TemplateData = {
  cliente_nombre: "Juan Pérez",
  cliente_cuit: "20-12345678-9",
  cliente_direccion: "Av. Siempre Viva 742",
  numero: "FAC-store_1-00001",
  fecha: "25/06/2026",
  subtotal: "$1.000,00",
  iva: "$210,00",
  total: "$1.210,00",
  tipo_label: "Factura",
  notes: "Pago en efectivo",
  combo_savings: "",
  bulto_savings: "",
  items: [
    { product_name: "Arroz 1kg", quantity: "2", unit_price: "$250,00", subtotal: "$500,00", combo_name: "", bulto_name: "" },
    { product_name: "Fideos 500g", quantity: "3", unit_price: "$120,00", subtotal: "$360,00", combo_name: "", bulto_name: "" },
  ],
  ...COMPANY_FIELDS,
};

const emptyItemsData: TemplateData = {
  ...sampleData,
  items: [],
  subtotal: "$0,00",
  total: "$0,00",
};

// ──────────────────────────────────────────────
// renderTemplate
// ──────────────────────────────────────────────

describe("renderTemplate — simple replace", () => {
  it("replaces {{cliente_nombre}} with the data value", () => {
    const html = "<p>{{cliente_nombre}}</p>";
    const result = renderTemplate(html, sampleData);
    expect(result).toBe("<p>Juan Pérez</p>");
  });

  it("replaces multiple variables in the same template", () => {
    const html = "<h1>{{numero}}</h1><p>{{fecha}}</p>";
    const result = renderTemplate(html, sampleData);
    expect(result).toBe(`<h1>FAC-store_1-00001</h1><p>25/06/2026</p>`);
  });
});

describe("renderTemplate — items loop", () => {
  it("renders items block with 2 items", () => {
    const html = "{{#items}}<tr><td>{{product_name}}</td></tr>{{/items}}";
    const result = renderTemplate(html, sampleData);
    expect(result).toBe("<tr><td>Arroz 1kg</td></tr><tr><td>Fideos 500g</td></tr>");
  });

  it("renders single item correctly", () => {
    const singleItem: TemplateData = {
      ...sampleData,
      items: [{ product_name: "Pan", quantity: "1", unit_price: "$100,00", subtotal: "$100,00", combo_name: "", bulto_name: "" }],
    };
    const html = "{{#items}}{{product_name}}-{{quantity}}{{/items}}";
    const result = renderTemplate(html, singleItem);
    expect(result).toBe("Pan-1");
  });

  it("returns empty string for empty items", () => {
    const html = "{{#items}}<li>{{product_name}}</li>{{/items}}";
    const result = renderTemplate(html, emptyItemsData);
    expect(result).toBe("");
  });

  it("preserves content outside the items block", () => {
    const html = "<h1>Factura</h1>{{#items}}<p>{{product_name}}</p>{{/items}}<footer>Total: {{total}}</footer>";
    const result = renderTemplate(html, sampleData);
    expect(result).toBe(`<h1>Factura</h1><p>Arroz 1kg</p><p>Fideos 500g</p><footer>Total: $1.210,00</footer>`);
  });
});

describe("renderTemplate — edge cases", () => {
  it("replaces unknown variable with empty string", () => {
    const html = "<span>{{unknown_var}}</span>";
    const result = renderTemplate(html, sampleData);
    expect(result).toBe("<span></span>");
  });

  it("replaces null field with empty string", () => {
    const data: TemplateData = { ...sampleData, cliente_cuit: "" };
    const html = "<p>{{cliente_cuit}}</p>";
    const result = renderTemplate(html, data);
    expect(result).toBe("<p></p>");
  });

  it("escapes HTML in values", () => {
    const data: TemplateData = { ...sampleData, cliente_nombre: '<script>alert("xss")</script>' };
    const html = "<p>{{cliente_nombre}}</p>";
    const result = renderTemplate(html, data);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("handles empty template string", () => {
    const result = renderTemplate("", sampleData);
    expect(result).toBe("");
  });

  it("handles template with no variables", () => {
    const html = "<h1>Hello</h1>";
    const result = renderTemplate(html, sampleData);
    expect(result).toBe("<h1>Hello</h1>");
  });
});

// ──────────────────────────────────────────────
// getDefaultTemplate
// ──────────────────────────────────────────────

describe("getDefaultTemplate", () => {
  const TIPOS = ["factura", "boleta", "ticket", "nota_credito", "nota_debito"] as const;

  for (const tipo of TIPOS) {
    it(`returns a non-empty string for "${tipo}"`, () => {
      const html = getDefaultTemplate(tipo);
      expect(html).toBeTruthy();
      expect(html.length).toBeGreaterThan(0);
    });
  }

  it("each default template renders with sample data without throwing", () => {
    for (const tipo of TIPOS) {
      const html = getDefaultTemplate(tipo);
      expect(() => renderTemplate(html, sampleData)).not.toThrow();
      const result = renderTemplate(html, sampleData);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("default templates contain the expected variables", () => {
    const html = getDefaultTemplate("factura");
    expect(html).toContain("{{cliente_nombre}}");
    expect(html).toContain("{{total}}");
    expect(html).toContain("{{#items}}");
    expect(html).toContain("{{/items}}");
  });

  it("local template contains store/tipo header", () => {
    const html = getDefaultTemplate("ticket");
    expect(html).toContain("TICKET");
  });
});
