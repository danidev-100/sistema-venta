/**
 * SQLite database singleton for Tauri plugin-sql.
 *
 * Auto-creates required tables on first connection.
 * Each write operation also inserts a sync_queue entry.
 */

import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;
let _ready = false;

async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await Database.load("sqlite:pos.db");
    await ensureTables(_db);
    _ready = true;
  }
  return _db;
}

async function ensureTables(db: Database): Promise<void> {
  const tables = [
    // ── Sales ──
    `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      cash_amount REAL,
      card_amount REAL,
      mercadopago_amount REAL,
      change REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      customer_name TEXT,
      shift_id INTEGER,
      created_by TEXT NOT NULL DEFAULT '—',
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Invoices ──
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      invoice_number INTEGER NOT NULL,
      sale_id INTEGER,
      customer_name TEXT NOT NULL DEFAULT 'Consumidor Final',
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY,
      invoice_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Brands ──
    `CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Categories ──
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id INTEGER,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Products ──
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      barcode TEXT,
      name TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      mid_stock INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER,
      brand_id INTEGER,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Stock movements ──
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reference_id TEXT,
      user_id TEXT,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Shifts ──
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      employee_name TEXT NOT NULL,
      open_time TEXT NOT NULL DEFAULT (datetime('now')),
      close_time TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      opening_balance REAL NOT NULL DEFAULT 0,
      declared_cash REAL,
      variance REAL,
      reconciliation_status TEXT,
      reconciled_at TEXT,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Cash closings ──
    `CREATE TABLE IF NOT EXISTS cash_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      expected_cash REAL NOT NULL,
      declared_cash REAL NOT NULL,
      card_total REAL NOT NULL DEFAULT 0,
      variance REAL NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Customers ──
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      cuit TEXT,
      credit_balance REAL NOT NULL DEFAULT 0,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS credit_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT,
      sale_id INTEGER,
      comprobante_id INTEGER,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Expenses ──
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // sync_queue might already exist, but IF NOT EXISTS is safe
    `CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      store_id TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      store_id TEXT NOT NULL,
      local_updated_at TEXT,
      cloud_updated_at TEXT,
      verdict TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    // ── Combos ──
    `CREATE TABLE IF NOT EXISTS combos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      combo_price REAL NOT NULL DEFAULT 0,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS combo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      combo_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Bultos ──
    `CREATE TABLE IF NOT EXISTS bultos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      bulto_price REAL NOT NULL DEFAULT 0,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      cuit TEXT,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      date TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS comprobantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      numero TEXT NOT NULL,
      cliente_nombre TEXT NOT NULL DEFAULT 'Consumidor Final',
      cliente_cuit TEXT,
      cliente_direccion TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      payment_method TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      iva REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      sale_id INTEGER,
      notes TEXT,
      created_by TEXT NOT NULL DEFAULT '—',
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS comprobante_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comprobante_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      combo_name TEXT NOT NULL DEFAULT '',
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS pedido_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      received_qty REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Cash Movements (retiros/depósitos) ──
    `CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('withdrawal','deposit')),
      amount REAL NOT NULL CHECK(amount > 0),
      method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','card','transfer','other')),
      reason TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    // ── Plantillas (print templates) ──
    `CREATE TABLE IF NOT EXISTS plantillas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      template_html TEXT NOT NULL,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      UNIQUE(store_id, tipo)
    )`,
    // ── Company settings ──
    `CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      cuit TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      web TEXT NOT NULL DEFAULT '',
      logo_base64 TEXT NOT NULL DEFAULT '',
      updated_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      UNIQUE(store_id)
    )`,
    // ── Price lists ──
    `CREATE TABLE IF NOT EXISTS price_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    `CREATE TABLE IF NOT EXISTS price_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      price REAL,
      percentage REAL,
      store_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    )`,

    // ── Users (local-only, no sync) ──
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'custom',
      permissions TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    // ── Activation (local-only license proof) ──
    `CREATE TABLE IF NOT EXISTS activation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      activated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name)`,
  ];

  for (const sql of tables) {
    await db.execute(sql);
  }

  // ── Indexes ──
  // WARNING: only add CREATE INDEX IF NOT EXISTS — existing DBs must not break
  const indexes = [
    // Sales
    `CREATE INDEX IF NOT EXISTS idx_sales_store_created ON sales(store_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status)`,

    // Sale items
    `CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`,

    // Invoices
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_store_number ON invoices(store_id, invoice_number)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at)`,

    // Invoice items
    `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)`,

    // Brands
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_store_name ON brands(store_id, name)`,

    // Categories
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_store_name ON categories(store_id, name)`,
    `CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)`,

    // Products
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_barcode ON products(store_id, barcode)`,
    `CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,

    // Stock movements
    `CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type)`,
    `CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at)`,

    // Shifts
    `CREATE INDEX IF NOT EXISTS idx_shifts_store_status ON shifts(store_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_name)`,

    // Cash closings
    `CREATE INDEX IF NOT EXISTS idx_cash_closings_shift ON cash_closings(shift_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cash_closings_store ON cash_closings(store_id)`,

    // Customers
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_name ON customers(store_id, name)`,

    // Credit payments
    `CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_credit_payments_store ON credit_payments(store_id)`,

    // Expenses
    `CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, date)`,

    // Proveedores
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_store_name ON proveedores(store_id, name)`,

    // Pedidos
    `CREATE INDEX IF NOT EXISTS idx_pedidos_store_proveedor ON pedidos(store_id, proveedor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pedidos_store_status ON pedidos(store_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at)`,

    // Pedido items
    `CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id)`,

    // Comprobantes
    `CREATE INDEX IF NOT EXISTS idx_comprobantes_store_tipo ON comprobantes(store_id, tipo)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_comprobantes_numero ON comprobantes(store_id, numero)`,
    `CREATE INDEX IF NOT EXISTS idx_comprobantes_created ON comprobantes(created_at)`,

    // Comprobante items
    `CREATE INDEX IF NOT EXISTS idx_comprobante_items_comprobante ON comprobante_items(comprobante_id)`,

    // Sync queue
    `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at)`,

    // Cash movements
    `CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id)`,

    // Combos
    `CREATE INDEX IF NOT EXISTS idx_combos_store_id ON combos(store_id)`,
    `CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON combo_items(combo_id)`,
    `CREATE INDEX IF NOT EXISTS idx_combo_items_product_id ON combo_items(product_id)`,

    // Bultos
    `CREATE INDEX IF NOT EXISTS idx_bultos_store_id ON bultos(store_id)`,

    // Price lists
    `CREATE INDEX IF NOT EXISTS idx_price_lists_store_id ON price_lists(store_id)`,
    `CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items(list_id)`,
    `CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON price_list_items(product_id)`,

    // Sync logs
    `CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at)`,
  ];

  for (const sql of indexes) {
    try {
      await db.execute(sql);
    } catch (err) {
      console.warn("Failed to create index (non-fatal):", sql, err);
    }
  }

  // ── Schema migrations for existing DBs ──
  const migrations = [
    `ALTER TABLE comprobantes ADD COLUMN payment_method TEXT`,
    `ALTER TABLE comprobantes ADD COLUMN created_by TEXT NOT NULL DEFAULT '—'`,
    `ALTER TABLE sales ADD COLUMN created_by TEXT NOT NULL DEFAULT '—'`,
    `ALTER TABLE credit_payments ADD COLUMN comprobante_id INTEGER`,
    `ALTER TABLE sales ADD COLUMN mercadopago_amount REAL`,
    `ALTER TABLE pedido_items ADD COLUMN received_qty REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE sale_items ADD COLUMN combo_id INTEGER REFERENCES combos(id)`,
    `ALTER TABLE sale_items ADD COLUMN bulto_id INTEGER REFERENCES bultos(id)`,
    `ALTER TABLE comprobante_items ADD COLUMN combo_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE comprobante_items ADD COLUMN bulto_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE sales ADD COLUMN price_list_id INTEGER`,
    `ALTER TABLE sale_items ADD COLUMN price_list_id INTEGER`,
    `ALTER TABLE customers ADD COLUMN price_list_id INTEGER`,
    `ALTER TABLE products ADD COLUMN sale_unit TEXT NOT NULL DEFAULT 'unit'`,
    `ALTER TABLE products ADD COLUMN image TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch (_err) {
      // column already exists — safe to ignore
    }
  }
}

/** Execute a SQL statement with optional bind parameters. */
export async function execute(
  sql: string,
  bind?: unknown[],
): Promise<{ rowsAffected: number }> {
  const db = await getDb();
  const result = await db.execute(sql, bind) as { rowsAffected: number };
  return { rowsAffected: result.rowsAffected };
}

/**
 * Execute multiple SQL statements inside a single transaction.
 * If any statement fails, all changes are rolled back.
 *
 * Usage:
 *   await transaction([
 *     { sql: "INSERT INTO x (a) VALUES ($1)", bind: [1] },
 *     { sql: "INSERT INTO y (b) VALUES ($1)", bind: [2] },
 *   ]);
 */
export async function transaction(
  statements: Array<{ sql: string; bind?: unknown[] }>,
): Promise<void> {
  const db = await getDb();
  await db.execute("BEGIN");
  try {
    for (const stmt of statements) {
      await db.execute(stmt.sql, stmt.bind ?? []);
    }
    await db.execute("COMMIT");
  } catch (err) {
    await db.execute("ROLLBACK");
    throw err;
  }
}

/** Select rows from the database. */
export async function select<T>(
  sql: string,
  bind?: unknown[],
): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, bind);
}

// ──────────────────────────────────────────────
// Activation helpers (local-only, via tauri-plugin-sql)
// ──────────────────────────────────────────────

export interface ActivationRow {
  license_key: string;
  device_id: string;
  device_name: string;
  activated_at: string;
}

/**
 * Check if the app has a valid local activation record.
 * Reads from the `activation` table managed by tauri-plugin-sql.
 */
export async function getActivation(): Promise<ActivationRow | null> {
  try {
    const rows = await select<ActivationRow>(
      "SELECT license_key, device_id, device_name, activated_at FROM activation ORDER BY id DESC LIMIT 1",
    );
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

/**
 * Save an activation record locally.
 * Clears any previous activation, then inserts the new one.
 */
export async function saveActivation(
  licenseKey: string,
  deviceId: string,
  deviceName: string,
): Promise<void> {
  await transaction([
    { sql: "DELETE FROM activation" },
    {
      sql: "INSERT INTO activation (license_key, device_id, device_name, activated_at) VALUES ($1, $2, $3, datetime('now'))",
      bind: [licenseKey, deviceId, deviceName],
    },
  ]);
}

/**
 * Enqueue a sync entry so the Rust sync engine picks it up.
 */
export async function enqueueSync(
  entity: string,
  entityId: number,
  operation: "insert" | "update" | "delete",
  storeId: string,
): Promise<void> {
  try {
    await execute(
      `INSERT INTO sync_queue (entity, entity_id, operation, store_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', datetime('now'), datetime('now'))`,
      [entity, entityId, operation, storeId],
    );
  } catch (err) {
    console.warn("Failed to enqueue sync item:", err);
  }
}
