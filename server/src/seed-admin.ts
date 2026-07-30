import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "../../db/cloud-schema.js";
import { users } from "../../db/cloud-schema.js";

const { Pool } = pg;

// ── Cargar .env manualmente (sin dotenv) ──
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

  const localUrl = process.env.DATABASE_URL;
  const neonUrl = process.env.NEON_DATABASE_URL;

  if (!localUrl) throw new Error("DATABASE_URL no está configurada en .env");
  if (!neonUrl) throw new Error("NEON_DATABASE_URL no está configurada en .env");

  console.log("🚀 Creando usuario admin en ambas bases de datos...");
  console.log(`   Usuario: admin`);
  console.log(`   Contraseña: admin123`);

  await seedAdmin(localUrl, "Local PostgreSQL");
  await seedAdmin(neonUrl, "Neon (producción)");

  console.log("\n✅ Proceso completado.");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
