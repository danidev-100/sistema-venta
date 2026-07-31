/* Backup of affected tables before duplicate cleanup — run: node db/backup-before-cleanup.mjs */
import { readFileSync } from "fs";
import { resolve } from "path";
import { writeFileSync } from "fs";
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

const TABLES = [
  "products",
  "categories",
  "brands",
  "price_list_items",
  "price_lists",
  "stock_movements",
  "sale_items",
  "sales",
  "combo_items",
  "combos",
  "bultos",
  "pedido_items",
  "pedidos",
  "comprobante_items",
  "comprobantes",
  "sync_queue",
];

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(process.cwd(), "db", "backups");
import { mkdirSync } from "fs";
mkdirSync(outDir, { recursive: true });

for (const table of TABLES) {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    writeFileSync(resolve(outDir, `${stamp}-${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`✓ ${table}: ${rows.length} rows -> ${stamp}-${table}.json`);
  } catch (err) {
    console.log(`✗ ${table}: ${err.message}`);
  }
}

await pool.end();
console.log(`\nBackup completo en ${outDir}`);
