/**
 * Product import from CSV / Excel files.
 *
 * Uses SheetJS (xlsx) to parse, auto-detects columns by header name,
 * creates missing categories / brands on the fly, and inserts products.
 */

import * as XLSX from "xlsx";
import { useProductsStore } from "@/store/products";
import { useBrandsStore } from "@/store/brands";
import type { Product } from "@/store/products";

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export type ImportRow = {
  barcode: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  category: string;
  brand: string;
};

export type ImportResult = {
  total: number;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export type ColumnMap = {
  barcode: string;
  name: string;
  price: string;
  costPrice: string;
  stock: string;
  minStock: string;
  category: string;
  brand: string;
};

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  suggestedMap: Partial<ColumnMap>;
  unmatchedHeaders: string[];
};

// ──────────────────────────────────────────────
// Header auto-detection
// ──────────────────────────────────────────────

const HEADER_ALIASES: Record<string, keyof ColumnMap> = {
  // Barcode
  codigo: "barcode",
  código: "barcode",
  barcode: "barcode",
  "código de barras": "barcode",
  "codigo de barras": "barcode",
  cod: "barcode",
  // Name
  nombre: "name",
  name: "name",
  producto: "name",
  product: "name",
  descripcion: "name",
  description: "name",
  descripción: "name",
  articulo: "name",
  artículo: "name",
  // Price
  precio: "price",
  price: "price",
  "precio venta": "price",
  pvp: "price",
  importe: "price",
  // Cost
  costo: "costPrice",
  cost: "costPrice",
  "precio costo": "costPrice",
  "precio de costo": "costPrice",
  cost_price: "costPrice",
  // Stock
  stock: "stock",
  existencia: "stock",
  existencias: "stock",
  cantidad: "stock",
  quantity: "stock",
  qty: "stock",
  // Min stock
  min_stock: "minStock",
  minstock: "minStock",
  "stock mínimo": "minStock",
  "stock minimo": "minStock",
  "stock_minimo": "minStock",
  // Category
  categoria: "category",
  categoría: "category",
  category: "category",
  cat: "category",
  // Brand
  marca: "brand",
  brand: "brand",
};

const REQUIRED_FIELDS: (keyof ColumnMap)[] = ["name", "price"];

// ──────────────────────────────────────────────
// Parse file
// ──────────────────────────────────────────────

export function parseFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          header: "A",
        });

        if (json.length === 0) {
          reject(new Error("El archivo está vacío"));
          return;
        }

        // First row = headers (we use letter keys A, B, C...)
        const rawHeaders = json[0];
        const headers = Object.values(rawHeaders).map((h) =>
          String(h).trim().toLowerCase(),
        );

        // Data rows start from index 1
        const rawRows = json.slice(1);
        const rows = rawRows.map((row) => {
          const mapped: Record<string, string> = {};
          for (const [key, val] of Object.entries(row)) {
            mapped[key] = String(val).trim();
          }
          return mapped;
        });

        // Auto-detect column mapping
        const suggestedMap: Partial<ColumnMap> = {};
        const unmatchedHeaders: string[] = [];

        const headerKeys = Object.keys(rawHeaders);
        headerKeys.forEach((letterKey, idx) => {
          const headerName = headers[idx];
          const field = HEADER_ALIASES[headerName];
          if (field) {
            suggestedMap[field] = letterKey;
          } else if (headerName) {
            unmatchedHeaders.push(
              `${letterKey}: "${rawHeaders[letterKey]}"`,
            );
          }
        });

        resolve({
          headers,
          rows,
          suggestedMap,
          unmatchedHeaders,
        });
      } catch (err) {
        reject(
          new Error(
            `No se pudo leer el archivo: ${err instanceof Error ? err.message : "formato inválido"}`,
          ),
        );
      }
    };

    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}

// ──────────────────────────────────────────────
// Execute import
// ──────────────────────────────────────────────

export async function executeImport(
  data: Record<string, string>[],
  map: ColumnMap,
  storeId: string,
): Promise<ImportResult> {
  const result: ImportResult = { total: 0, created: 0, skipped: 0, errors: [] };
  const productsStore = useProductsStore.getState();
  const brandsStore = useBrandsStore.getState();
  const existingBrands = brandsStore.brands.filter(
    (b) => b.store_id === storeId,
  );
  const existingCategories = productsStore.categories.filter(
    (c) => c.store_id === storeId,
  );

  // Helper: get or create brand by name
  async function resolveBrand(name: string): Promise<number | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = existingBrands.find(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    // Create new brand
    const brand = await brandsStore.addBrand({ name: trimmed, store_id: storeId });
    existingBrands.push(brand);
    return brand.id;
  }

  // Helper: get or create category by name
  async function resolveCategory(name: string): Promise<number | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = existingCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    // Create new category (root level — no parent)
    const cat = await productsStore.addCategory({
      name: trimmed,
      parent_id: null,
      store_id: storeId,
    });
    existingCategories.push(cat);
    return cat.id;
  }

  // Helper: safe parse float
  function parseFloatSafe(val: string): number {
    const num = parseFloat(val.replace(",", "."));
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  // Helper: safe parse int
  function parseIntSafe(val: string): number {
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    result.total++;

    try {
      const name = String(row[map.name] ?? "").trim();
      const price = parseFloatSafe(row[map.price] ?? "");
      const barcode = String(row[map.barcode] ?? "").trim();
      const costPrice = map.costPrice
        ? parseFloatSafe(row[map.costPrice] ?? "")
        : 0;
      const stock = map.stock ? parseIntSafe(row[map.stock] ?? "") : 0;
      const minStock = map.minStock
        ? parseIntSafe(row[map.minStock] ?? "")
        : 0;
      const categoryName = map.category
        ? String(row[map.category] ?? "").trim()
        : "";
      const brandName = map.brand
        ? String(row[map.brand] ?? "").trim()
        : "";

      // Validate required
      if (!name) {
        result.errors.push({
          row: i + 2,
          message: "Nombre del producto vacío",
        });
        result.skipped++;
        continue;
      }

      if (price <= 0) {
        result.errors.push({
          row: i + 2,
          message: `Precio inválido para "${name}"`,
        });
        result.skipped++;
        continue;
      }

      const categoryId = categoryName
        ? await resolveCategory(categoryName)
        : null;
      const brandId = brandName ? await resolveBrand(brandName) : null;

      await productsStore.addProduct({
        name,
        barcode: barcode || null,
        price,
        costPrice,
        stock,
        minStock,
        category_id: categoryId,
        brandId,
        store_id: storeId,
      });

      result.created++;
    } catch (err) {
      result.errors.push({
        row: i + 2,
        message: err instanceof Error ? err.message : "Error desconocido",
      });
      result.skipped++;
    }
  }

  return result;
}
