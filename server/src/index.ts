import { readFileSync } from "fs";
import { resolve } from "path";
import app from "./app.js";

// ── Load .env from project root (no dotenv dependency) ──
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(process.cwd(), "../.env");
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
  } catch {
    console.warn("[server] No .env file found at ../.env, using system env vars");
  }
}

// ── Fallback: if only NEON_DATABASE_URL is set but not DATABASE_URL ──
if (!process.env.DATABASE_URL && process.env.NEON_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
}

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Sistema de Ventas running on http://0.0.0.0:${PORT}`);
});
