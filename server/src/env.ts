import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(envPath: string): boolean {
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
      if (!process.env[key]) process.env[key] = value;
    }
    return true;
  } catch {
    return false;
  }
}

// Skip when DATABASE_URL already comes from the real environment (e.g. Vercel/Neon).
if (!process.env.DATABASE_URL) {
  // Try candidates in order: repo root .env (dev), server/.env, then cwd-relative.
  const candidates = [
    resolve(__dirname, "../../.env"), // server/src/ -> repo root
    resolve(__dirname, "../.env"), //    server/src/ -> server/
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), ".env"),
  ];
  for (const candidate of candidates) {
    if (loadEnvFile(candidate)) break;
  }
}

// Fallback: Neon production URL used as DATABASE_URL when the local one is missing.
if (!process.env.DATABASE_URL && process.env.NEON_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
}
