import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────
// jsdom base URL. Also configured via
// environmentOptions.jsdom.url in vite.config.ts so
// localStorage works (jsdom needs a non-opaque origin).
// ──────────────────────────────────────────────

const BASE_URL = "http://localhost";

// ──────────────────────────────────────────────
// Generic fetch stub
//
// The api client (src/lib/api.ts) always calls fetch with a
// RELATIVE url like "/api/products?storeId=store_1". Node's
// undici fetch rejects relative URLs with "Invalid URL". This
// stub resolves them against a base URL and keeps an in-memory
// database per test file so store CRUD keeps working:
//
//   GET    → entities previously POSTed for that resource, or []
//            for list endpoints; a minimal admin user for
//            /auth/me; a minimal company config for /company.
//   POST   → stores the JSON body with an auto-incrementing id
//            and timestamps, returns the created entity.
//   POST /auth/login → token + admin user (not stored).
//   PUT    → merges the body into the stored entity (or the body
//            alone if none) and returns the full entity.
//   DELETE → 204 No Content.
//
// The database is cleared before every test (global beforeEach)
// so tests never leak entities into each other.
//
// Tests that need specific payloads should mock "@/lib/api"
// (or override globalThis.fetch) instead of relying on this.
// ──────────────────────────────────────────────

const db = new Map<string, Map<number, Record<string, unknown>>>();
let idCounter = 1000;

function clearDb() {
  db.clear();
  idCounter = 1000;
}

beforeEach(() => {
  clearDb();
});

const ADMIN_USER = {
  id: 1,
  name: "admin",
  role: "admin",
  permissions: [
    "ventas",
    "caja",
    "productos",
    "clientes",
    "proveedores",
    "pedidos",
    "facturacion",
    "comprobantes",
    "gastos",
    "estadisticas",
    "admin",
    "usuarios",
  ],
  active: true,
  created_at: new Date().toISOString(),
};

const COMPANY = {
  id: 1,
  store_id: "store_1",
  name: "Tienda Test",
  phone: "",
  address: "",
  cuit: "20300000000",
  email: "",
  web: "",
  logo: "",
  iva_alicuota: 21,
  iva_incluido: 1,
};

function makeResponse(data: unknown, status = 200) {
  const ok = status >= 200 && status < 300;
  const body = typeof data === "string" ? data : JSON.stringify(data);
  return {
    ok,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(body),
  };
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  return {};
}

function tableFor(path: string): Map<number, Record<string, unknown>> {
  if (!db.has(path)) db.set(path, new Map());
  return db.get(path)!;
}

/** Resource path for a collection endpoint (strips a trailing numeric id). */
function basePathFor(path: string): string {
  return path.replace(/\/\d+$/, "");
}

function extractLastId(path: string): number | null {
  const match = /(\d+)$/.exec(path.replace(/\/$/, ""));
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fill in server-computed fields for specific resources. The real
 * backend computes these (status, totals, timestamps), so the stub
 * must too for store normalizers to work.
 */
function enrichCreated(
  path: string,
  body: Record<string, unknown>,
  created: Record<string, unknown>,
): void {
  if (path === "/cash/shifts") {
    created.status = "open";
    created.open_time = created.created_at;
    created.close_time = null;
    created.opening_balance =
      body.openingBalance ?? body.opening_balance ?? 0;
  }
  if (path === "/pedidos") {
    created.status = "pending";
    const items = Array.isArray(body.items) ? (body.items as any[]) : [];
    const total = items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
    created.total = Math.round(total * 100) / 100;
  }
}

async function handleFetch(input: unknown, init?: RequestInit) {
  const rawUrl =
    typeof input === "string" ? input : (input as Request)?.url ?? "";
  const url = new URL(rawUrl, BASE_URL);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = (init?.method ?? "GET").toUpperCase();

  if (method === "GET") {
    if (path === "/auth/me") return makeResponse(ADMIN_USER);
    if (path.startsWith("/company")) return makeResponse(COMPANY);
    const table = db.get(path);
    return makeResponse(table ? Array.from(table.values()) : []);
  }

  if (method === "POST") {
    if (path === "/auth/login") {
      return makeResponse({ token: "test-token", user: ADMIN_USER });
    }
    const body = parseBody(init?.body);
    const now = new Date().toISOString();
    const created: Record<string, unknown> = {
      ...body,
      id: idCounter++,
      created_at: now,
      updated_at: now,
    };
    enrichCreated(path, body, created);
    tableFor(path).set(created.id as number, created);
    return makeResponse(created, 201);
  }

  if (method === "PUT") {
    const body = parseBody(init?.body);
    const id = extractLastId(path);
    const table = tableFor(basePathFor(path));
    const existing = id != null ? table.get(id) : undefined;
    const merged = {
      ...(existing ?? {}),
      ...body,
      ...(id != null ? { id } : {}),
      updated_at: new Date().toISOString(),
    };
    if (id != null) table.set(id, merged);
    return makeResponse(merged);
  }

  if (method === "DELETE") {
    const id = extractLastId(path);
    if (id != null) tableFor(basePathFor(path)).delete(id);
    return makeResponse({ ok: true }, 204);
  }

  return makeResponse({});
}

const fetchStub = vi.fn(handleFetch);
vi.stubGlobal("fetch", fetchStub);

// ──────────────────────────────────────────────
// Defensive localStorage fallback
//
// jsdom provides localStorage when the document has a
// non-opaque origin (see jsdom.url above). If a test
// overrides the environment, fall back to an in-memory
// implementation so stores never crash on access.
// ──────────────────────────────────────────────

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
}