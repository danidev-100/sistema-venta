/**
 * Seeder — genera datos de prueba a través de la API.
 *
 * Uso: import { runSeeder } from "@/lib/seeder"; runSeeder()
 *
 * Para ejecutar, abrí la consola del navegador (F12) en la app y:
 *   import("/src/lib/seeder.ts").then((m) => m.runSeeder())
 */

const STORE_ID = "store_1";

const TARGETS = {
  categories: 20,
  brands: 10,
  products: 500,
} as const;

function randomPrice(): number {
  return Math.round(Math.random() * 10000) / 100;
}

async function createCategory(name: string): Promise<number> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, store_id: STORE_ID }),
  });
  const cat = await res.json();
  return cat.id;
}

async function createBrand(name: string): Promise<number> {
  const res = await fetch("/api/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, store_id: STORE_ID }),
  });
  const brand = await res.json();
  return brand.id;
}

async function createProduct(name: string, price: number, stock: number, categoryId: number | null, brandId: number | null): Promise<void> {
  await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name, price, stock: Math.floor(stock),
      category_id: categoryId, brand_id: brandId,
      store_id: STORE_ID,
      barcode: Math.random().toString(36).slice(2, 12),
    }),
  });
}

export async function runSeeder(): Promise<void> {
  console.log("[seeder] Starting seed...");

  // Create categories
  const catNames = ["Bebidas", "Lácteos", "Almacén", "Limpieza", "Snacks",
    "Carnes", "Verduras", "Panadería", "Perfumería", "Mascotas",
    "Bebidas con alcohol", "Congelados", "Conservas", "Salsas", "Pastas",
    "Arroz y legumbres", "Harinas", "Dulces", "Infusiones", "Cosméticos"];
  const catIds: number[] = [];
  for (let i = 0; i < Math.min(TARGETS.categories, catNames.length); i++) {
    const id = await createCategory(catNames[i]);
    catIds.push(id);
    console.log(`  [seeder] Category ${i + 1}/${TARGETS.categories}: ${catNames[i]}`);
  }

  // Create brands
  const brandNames = ["Coca-Cola", "Pepsi", "La Serenísima", "Arcor", "Molinos",
    "Quilmes", "Sancor", "Bagley", "Ledesma", "Danone"];
  const brandIds: number[] = [];
  for (let i = 0; i < Math.min(TARGETS.brands, brandNames.length); i++) {
    const id = await createBrand(brandNames[i]);
    brandIds.push(id);
    console.log(`  [seeder] Brand ${i + 1}/${TARGETS.brands}: ${brandNames[i]}`);
  }

  // Create products
  const productNames = ["Producto Genérico A", "Producto Genérico B",
    "Artículo Premium", "Oferta Especial", "Marca Blanca",
    "Importado Selecto", "Edición Limitada", "Clásico Original",
    "Nueva Versión", "Económico Pack"];
  const batchSize = 20;
  for (let i = 0; i < TARGETS.products; i++) {
    const name = `${productNames[i % productNames.length]} #${i + 1}`;
    const price = randomPrice();
    const stock = Math.floor(Math.random() * 200);
    const catId = catIds[i % catIds.length] ?? null;
    const brandId = brandIds.length > 0 ? brandIds[i % brandIds.length] : null;
    await createProduct(name, price, stock, catId, brandId);
    if ((i + 1) % batchSize === 0) {
      console.log(`  [seeder] Products ${i + 1}/${TARGETS.products}`);
    }
  }

  console.log(`[seeder] Done! Created ${TARGETS.categories} categories, ${TARGETS.brands} brands, ${TARGETS.products} products`);
}
