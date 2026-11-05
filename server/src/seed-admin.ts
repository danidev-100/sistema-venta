import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "../../db/cloud-schema.js";
import { users } from "../../db/cloud-schema.js";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Cargar .env manualmente (sin dotenv) ──
// Resuelto por __dirname, no por cwd: así funciona igual corriendo desde la
// raíz (`pnpm db:seed`) o desde server/ (`pnpm -C server ...`).
function loadEnvFile(envPath: string): void {
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Archivo ausente: no es un error, hay otros candidatos.
  }
}

function loadEnv(): void {
  const candidates = [
    resolve(__dirname, "../../.env.local"), // server/src/ -> raíz
    resolve(__dirname, "../../.env"), // server/src/ -> raíz
    resolve(__dirname, "../.env"), // server/src/ -> server/
    resolve(process.cwd(), ".env"),
  ];
  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }
}

async function seedAdmin(databaseUrl: string, label: string) {
  console.log(`\n🔧 Conectando a ${label}...`);

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await bcrypt.hash("admin123", 10);

    const existing = await db.select().from(users).where(eq(users.name, "admin"));

    if (existing.length > 0) {
      console.log(`  ⚠️  El usuario 'admin' ya existe en ${label}, saltando.`);
      return;
    }

    await db.insert(users).values({
      name: "admin",
      password_hash: passwordHash,
      role: "admin",
      permissions: JSON.stringify([
        "ventas", "caja", "productos", "clientes", "proveedores",
        "pedidos", "facturacion", "comprobantes", "gastos",
        "estadisticas", "admin", "usuarios",
      ]),
      active: 1,
    });

    console.log(`  ✅ Usuario 'admin' creado en ${label}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  loadEnv();

  // Por defecto solo la base local. Escribir en producción (Neon) requiere
  // pedirlo explícitamente con --all.
  const includeRemote = process.argv.includes("--all");

  const localUrl = process.env.DATABASE_URL;
  const neonUrl = process.env.NEON_DATABASE_URL;

  if (!localUrl) throw new Error("DATABASE_URL no está configurada en .env");
  if (includeRemote && !neonUrl) {
    throw new Error("NEON_DATABASE_URL no está configurada en .env (requerida por --all)");
  }

  console.log(
    includeRemote
      ? "🚀 Creando usuario admin en local + Neon (producción)..."
      : "🚀 Creando usuario admin en la base local...",
  );
  console.log(`   Usuario: admin`);
  console.log(`   Contraseña: admin123`);

  await seedAdmin(localUrl, "Local PostgreSQL");
  if (includeRemote) {
    await seedAdmin(neonUrl as string, "Neon (producción)");
  }

  console.log("\n✅ Proceso completado.");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
