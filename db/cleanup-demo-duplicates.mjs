/* Cleanup of demo duplicates — run: node db/cleanup-demo-duplicates.mjs
 * Backup already exists in db/backups/. Run inside a transaction with rollback on error.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const { Pool } = pg;

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const client = await pool.connect();

const DEMO = `(barcode LIKE '7791%' OR barcode LIKE '7792%')`;

try {
  await client.query("BEGIN");

  // ── 1. Detach price-list items pointing at demo products ──
  const r1 = await client.query(`DELETE FROM price_list_items WHERE product_id IN (SELECT id FROM products WHERE ${DEMO})`);
  console.log(`price_list_items deleted: ${r1.rowCount}`);

  // ── 2. Combos: delete items pointing at demo, then orphan combos ──
  const r2 = await client.query(`DELETE FROM combo_items WHERE product_id IN (SELECT id FROM products WHERE ${DEMO})`);
  console.log(`combo_items deleted: ${r2.rowCount}`);
  const r2b = await client.query(`DELETE FROM combos WHERE id NOT IN (SELECT DISTINCT combo_id FROM combo_items)`);
  console.log(`orphan combos deleted: ${r2b.rowCount}`);

  // ── 3. Bultos pointing at demo ──
  const r3 = await client.query(`DELETE FROM bultos WHERE product_id IN (SELECT id FROM products WHERE ${DEMO})`);
  console.log(`bultos deleted: ${r3.rowCount}`);

  // ── 4. Pedido items: null the product_id but KEEP the row (name preserved) ──
  const r4 = await client.query(`UPDATE pedido_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE ${DEMO})`);
  console.log(`pedido_items detached: ${r4.rowCount}`);

  // ── 5. Reassign fotocopiadora (id 206) from dup category 51 to canonical 46 ──
  const r5 = await client.query(`UPDATE products SET category_id = 46 WHERE id = 206 AND category_id = 51`);
  console.log(`products category reassigned: ${r5.rowCount}`);

  // ── 6. Delete demo products ──
  const r6 = await client.query(`DELETE FROM products WHERE ${DEMO}`);
  console.log(`demo products deleted: ${r6.rowCount}`);

  // ── 7. Delete duplicate categories, keeping canonical ids: 1,2,7,46 (store_1), 4 (store_2) ──
  const r7 = await client.query(`DELETE FROM categories WHERE id NOT IN (1, 2, 4, 7, 46)`);
  console.log(`duplicate categories deleted: ${r7.rowCount}`);

  await client.query("COMMIT");
  console.log("\n✅ COMMIT ok");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ ROLLBACK:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

// ── Post-check counts ──
const checkPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
for (const t of ["products", "categories", "price_list_items", "combos", "combo_items", "bultos", "pedido_items"]) {
  const { rows } = await checkPool.query(`SELECT count(*)::int AS n FROM ${t}`);
  console.log(`  ${t}: ${rows[0].n}`);
}
await checkPool.end();
