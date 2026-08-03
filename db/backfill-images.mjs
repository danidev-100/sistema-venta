/* Backfill de imágenes reales para productos sin imagen.
 * Fuentes: Openverse (fotos CC) -> Open Food Facts (envase real).
 *
 * Uso:
 *   node db/backfill-images.mjs            -> Neon (producción)
 *   node db/backfill-images.mjs --local    -> PostgreSQL local
 *   node db/backfill-images.mjs --dry-run  -> solo reporte, no actualiza
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { writeFileSync } from "fs";
import pg from "pg";

const { Pool } = pg;

const DRY_RUN = process.argv.includes("--dry-run");
const LOCAL = process.argv.includes("--local");

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
const connString = LOCAL ? process.env.DATABASE_URL : process.env.NEON_DATABASE_URL;
const pool = new Pool({ connectionString: connString, max: 2 });

const REPORT = [];
let updatedCount = 0;
let failedCount = 0;

// ──────────────────────────────────────────────
// Openverse (WordPress API, sin API key): fotos CC
// ──────────────────────────────────────────────
async function searchOpenverse(query) {
  const url =
    "https://api.openverse.org/v1/images/?q=" +
    encodeURIComponent(query) +
    "&page_size=5";
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || [])
    .filter((r) => r.url && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(r.url))
    .map((r) => ({
      url: r.url,
      name: r.title || "",
      source: "openverse",
    }));
}

// ──────────────────────────────────────────────
// Open Food Facts: fotos reales del envase (bonus)
// ──────────────────────────────────────────────
async function searchOpenFoodFacts(query) {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?" +
    new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "5",
      languages: "es",
    });
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.products || [])
    .filter((p) => p.image_front_small_url)
    .map((p) => ({
      url: p.image_front_small_url,
      name: p.product_name || "",
      source: "openfoodfacts",
    }));
}

// ──────────────────────────────────────────────
// Normalización de nombres para búsquedas.
// Saca cantidades y unidades ("1L", "500g", "1.5kg")
// y términos de tamaño que confunden a los buscadores.
// ──────────────────────────────────────────────
function buildQuery(name) {
  return name
    .toLowerCase()
    .replace(/\d[\d.,]*\s*(kg|g|ml|l|lt|cc|un|pack|botella|bolsa|sachet|sobre|litro|litros|gramos|kilo|kilos)\b/gi, " ")
    .replace(/\b(500|1|1\.5|2|2\.25|3|10|20|33|50|100|250|350|355|400|600|750|900|1000|1500|2000|3000)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findImage(productName) {
  const base = buildQuery(productName);

  // Variantes: nombre completo, luego sin la última palabra, etc.
  const variants = [base];
  const words = base.split(" ").filter(Boolean);
  for (let i = words.length - 1; i > 0; i--) {
    variants.push(words.slice(0, i).join(" "));
  }
  const uniqueVariants = [...new Set(variants.filter((v) => v.length > 2))];

  for (const q of uniqueVariants) {
    // 1) Openverse primero (fotos CC reales y confiables)
    try {
      const ov = await searchOpenverse(q);
      if (ov.length > 0) return ov[0];
    } catch {
      /* siguiente variante */
    }

    // 2) Open Food Facts como bonus (foto del envase real, si responde)
    try {
      const off = await searchOpenFoodFacts(q);
      if (off.length > 0) return off[0];
    } catch {
      /* siguiente variante */
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
console.log(`\n[backfill] ${LOCAL ? "Base LOCAL" : "Base NEON (producción)"} — ${DRY_RUN ? "DRY-RUN (no actualiza)" : "ACTUALIZA"}\n`);

const { rows } = await pool.query(
  `SELECT id, name FROM products WHERE image IS NULL OR image = '' ORDER BY id`
);
console.log(`[backfill] Productos sin imagen: ${rows.length}\n`);

let done = 0;
for (const row of rows) {
  done += 1;
  process.stdout.write(`  [${done}/${rows.length}] ${row.name} ... `);

  try {
    const match = await findImage(row.name);
    if (!match) {
      console.log("SIN RESULTADO");
      REPORT.push({ id: row.id, name: row.name, image: "", source: "", status: "sin_resultado" });
      failedCount += 1;
      continue;
    }

    if (!DRY_RUN) {
      await pool.query(`UPDATE products SET image = $1, updated_at = now() WHERE id = $2`, [
        match.url,
        row.id,
      ]);
    }

    console.log(`✓ ${match.url.slice(0, 70)} (${match.source})`);
    REPORT.push({
      id: row.id,
      name: row.name,
      image: match.url,
      source: match.source,
      status: "ok",
    });
    updatedCount += 1;
  } catch (err) {
    console.log(`✗ ERROR: ${err.message}`);
    REPORT.push({ id: row.id, name: row.name, image: "", source: "", status: "error: " + err.message });
    failedCount += 1;
  }
}

// Reporte CSV
const csvLines = [
  "id,nombre,imagen,fuente,estado",
  ...REPORT.map((r) =>
    [
      r.id,
      `"${(r.name || "").replace(/"/g, '""')}"`,
      r.image,
      r.source,
      `"${(r.status || "").replace(/"/g, '""')}"`,
    ].join(",")
  ),
];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(process.cwd(), "db", `reporte-imagenes-${stamp}.csv`);
writeFileSync(outPath, csvLines.join("\n"), "utf-8");

console.log(`\n[backfill] Listo. Actualizados: ${updatedCount} | Sin imagen: ${failedCount} | ${DRY_RUN ? "(dry-run)" : "escritura real"}`);
console.log(`[backfill] Reporte: ${outPath}`);

await pool.end();
