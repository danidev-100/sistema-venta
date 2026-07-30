import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "./schema";

/**
 * Drizzle client targeting the cloud PostgreSQL database.
 *
 * This is a STUB for the foundation phase. The actual PostgreSQL connection
 * will go through a Tauri command (Rust -> pg) in the sync engine phase (PR 7).
 *
 * For now, the proxy function logs and throws, preventing accidental
 * cloud access before the sync engine is built.
 */
export const cloudDb = drizzle<typeof schema>(
  async (_sql: string, _params: any[], _method: "all" | "execute") => {
    throw new Error(
      "[cloudDb] PostgreSQL client is not available yet. " +
        "The sync engine (PR 7) will wire this connection through Tauri commands.",
    );
  },
  { schema },
);

/**
 * Initialises the cloud database connection with the provided connection string.
 * Called by the sync engine once the user's cloud credentials are configured.
 *
 * @param connectionString - PostgreSQL connection string (e.g. from Supabase/Neon)
 */
export async function initCloudDb(_connectionString: string): Promise<void> {
  // TODO (PR 7): Create a pg Pool in Rust, expose via Tauri command,
  // and replace the proxy with a real drizzle(remoteDb) instance.
  throw new Error(
    "[initCloudDb] Cloud database initialisation is not implemented. " +
      "The sync engine (PR 7) will implement this.",
  );
}
