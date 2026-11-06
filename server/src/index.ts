// Must be the FIRST import: ESM evaluates imports before the module body,
// so env.ts has to load .env before ./app.js (and its auth middleware) runs.
import "./env.js";
import app from "./app.js";
import { assertJwtConfigured } from "./middleware/auth.js";

// Falla rápido, en el arranque y no al importar el módulo de auth.
assertJwtConfigured();

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Sistema de Ventas running on http://0.0.0.0:${PORT}`);
});
