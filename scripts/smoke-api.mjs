#!/usr/bin/env node
// Smoke de la API del POS. Sólo lectura: no crea ventas, turnos ni movimientos.
//
//   node scripts/smoke-api.mjs [baseUrl]
//
// Sale con código 1 si alguna aserción falla, así sirve en un check manual o en CI.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail && !ok ? `  → ${detail}` : ""}`);
}

async function req(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text();
  return { status: response.status, contentType, body };
}

async function login(username, password) {
  const { status, body } = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return { status, token: body?.token ?? null };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// ── 1. Una ruta /api/* inexistente es un 404 JSON, no el index.html con 200 ──
const unknown = await req("/api/esta-ruta-no-existe");
check(
  "ruta /api inexistente → 404 JSON",
  unknown.status === 404 && unknown.contentType.includes("application/json"),
  `${unknown.status} ${unknown.contentType}`,
);

// ── 2. El SPA se sigue sirviendo ──
const root = await req("/");
check("raíz sirve la app", root.status === 200 && root.contentType.includes("text/html"), `${root.status}`);

// ── 3. Login ──
const bad = await login("admin", "clave-incorrecta");
check("login con clave incorrecta → 401", bad.status === 401, `${bad.status}`);

const admin = await login("admin", "admin123");
check("login admin → token", admin.status === 200 && !!admin.token, `${admin.status}`);

if (admin.token) {
  // ── 4. Sin token no se lee nada del negocio ──
  const anon = await req("/api/products?storeId=store_1");
  check("GET /api/products sin token → 401", anon.status === 401, `${anon.status}`);

  const products = await req("/api/products?storeId=store_1", { headers: auth(admin.token) });
  check("GET /api/products con token → 200", products.status === 200, `${products.status}`);

  // ── 5. Token inválido no pasa ──
  const forged = await req("/api/sales?storeId=store_1", { headers: auth("no.es.un.token") });
  check("token inválido → 401", forged.status === 401, `${forged.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length === 0 ? 0 : 1);
