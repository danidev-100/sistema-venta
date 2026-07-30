import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../db/cloud-schema.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err);
    });
  }
  return pool;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
