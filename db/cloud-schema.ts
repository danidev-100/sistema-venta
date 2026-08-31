import {
  pgTable,
  text,
  integer,
  doublePrecision,
  uniqueIndex,
  index,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ──────────────────────────────────────────────
// Helper: common sync columns for syncable entities
// ──────────────────────────────────────────────

export const syncColumns = {
  store_id: text("store_id").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  sync_status: text("sync_status", {
    enum: ["pending", "synced", "conflict"],
  })
    .notNull()
    .default("pending"),
} as const;

// ──────────────────────────────────────────────
// Stores (reference table, not syncable)
// ──────────────────────────────────────────────

export const stores = pgTable(
  "stores",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({ nameIdx: index("idx_stores_name").on(table.name) }),
);

// ──────────────────────────────────────────────
// Categories (syncable)
// ──────────────────────────────────────────────

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    parent_id: integer("parent_id"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_categories_store").on(table.store_id),
    parentIdx: index("idx_categories_parent").on(table.parent_id),
  }),
);

// ──────────────────────────────────────────────
// Brands (syncable)
// ──────────────────────────────────────────────

export const brands = pgTable(
  "brands",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeNameIdx: uniqueIndex("idx_brands_store_name").on(table.store_id, table.name),
  }),
);

// ──────────────────────────────────────────────
// Products (syncable)
// ──────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    image: text("image").notNull().default(""),
    price: doublePrecision("price").notNull().default(0),
    cost_price: doublePrecision("cost_price").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    min_stock: integer("min_stock").notNull().default(0),
    sale_unit: text("sale_unit", { enum: ["unit", "gram", "kilogram"] }).notNull().default("unit"),
    category_id: integer("category_id"),
    brand_id: integer("brand_id"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    barcodeIdx: index("idx_products_barcode").on(table.barcode),
    storeIdx: index("idx_products_store").on(table.store_id),
    categoryIdx: index("idx_products_category").on(table.category_id),
    brandIdx: index("idx_products_brand").on(table.brand_id),
  }),
);

// ──────────────────────────────────────────────
// Stock movements (syncable)
// ──────────────────────────────────────────────

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    product_id: integer("product_id").notNull(),
    type: text("type", { enum: ["sale", "purchase", "adjustment", "transfer"] }).notNull(),
    quantity: integer("quantity").notNull(),
    delta: integer("delta").notNull(),
    reference_id: text("reference_id"),
    user_id: integer("user_id"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    productIdx: index("idx_stock_movements_product").on(table.product_id),
    storeIdx: index("idx_stock_movements_store").on(table.store_id),
    typeIdx: index("idx_stock_movements_type").on(table.type),
  }),
);

// ──────────────────────────────────────────────
// Sales (syncable)
// ──────────────────────────────────────────────

export const sales = pgTable(
  "sales",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    store_id: text("store_id").notNull(),
    customer_name: text("customer_name"),
    total: doublePrecision("total").notNull(),
    subtotal: doublePrecision("subtotal").notNull().default(0),
    iva: doublePrecision("iva").notNull().default(0),
    discount_percent: doublePrecision("discount_percent").notNull().default(0),
    discount_amount: doublePrecision("discount_amount").notNull().default(0),
    payment_method: text("payment_method").notNull(),
    amount_paid: doublePrecision("amount_paid"),
    cash_amount: doublePrecision("cash_amount"),
    card_amount: doublePrecision("card_amount"),
    mercadopago_amount: doublePrecision("mercadopago_amount"),
    change: doublePrecision("change"),
    status: text("status").notNull().default("completed"),
    shift_id: integer("shift_id"),
    invoice_id: integer("invoice_id"),
    created_by: text("created_by").notNull().default("—"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_sales_store").on(table.store_id),
    shiftIdx: index("idx_sales_shift").on(table.shift_id),
    createdAtIdx: index("idx_sales_created").on(table.created_at),
  }),
);

// ──────────────────────────────────────────────
// Sale items (syncable)
// ──────────────────────────────────────────────

export const saleItems = pgTable(
  "sale_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    sale_id: integer("sale_id").notNull(),
    product_id: integer("product_id").notNull(),
    product_name: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unit_price: doublePrecision("unit_price").notNull(),
    subtotal: doublePrecision("subtotal").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    saleIdx: index("idx_sale_items_sale").on(table.sale_id),
    productIdx: index("idx_sale_items_product").on(table.product_id),
  }),
);

// ──────────────────────────────────────────────
// Shifts (syncable)
// ──────────────────────────────────────────────

export const shifts = pgTable(
  "shifts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    employee: text("employee").notNull(),
    open_time: timestamp("open_time").notNull().defaultNow(),
    close_time: timestamp("close_time"),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    opening_balance: doublePrecision("opening_balance").notNull().default(0),
    declared_cash: doublePrecision("declared_cash"),
    variance: doublePrecision("variance"),
    reconciliation_status: text("reconciliation_status", {
      enum: ["pending", "matched", "mismatch"],
    }),
    reconciled_at: timestamp("reconciled_at"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_shifts_store").on(table.store_id),
  }),
);

// ──────────────────────────────────────────────
// Cash closings (syncable)
// ──────────────────────────────────────────────

export const cashClosings = pgTable(
  "cash_closings",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    shift_id: integer("shift_id").notNull(),
    declared_cash: doublePrecision("declared_cash"),
    variance: doublePrecision("variance"),
    reconciliation_status: text("reconciliation_status", {
      enum: ["pending", "matched", "mismatch"],
    }),
    reconciled_at: timestamp("reconciled_at"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    shiftIdx: index("idx_cash_closings_shift").on(table.shift_id),
    storeIdx: index("idx_cash_closings_store").on(table.store_id),
  }),
);

// ──────────────────────────────────────────────
// Cash movements (syncable)
// ──────────────────────────────────────────────

export const cashMovements = pgTable(
  "cash_movements",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    shift_id: integer("shift_id").notNull(),
    type: text("type", { enum: ["withdrawal", "deposit"] }).notNull(),
    amount: doublePrecision("amount").notNull(),
    method: text("method", { enum: ["cash", "card", "transfer", "other"] })
      .notNull()
      .default("cash"),
    reason: text("reason").default(""),
    created_by: text("created_by").notNull().default("—"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    shiftIdx: index("idx_cash_movements_shift").on(table.shift_id),
    storeIdx: index("idx_cash_movements_store").on(table.store_id),
  }),
);

// ──────────────────────────────────────────────
// Expenses (syncable)
// ──────────────────────────────────────────────

export const expenses = pgTable(
  "expenses",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    description: text("description").notNull(),
    amount: doublePrecision("amount").notNull(),
    category: text("category").notNull(),
    date: text("date").notNull(),
    payment_method: text("payment_method", { enum: ["cash", "card"] }).notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_expenses_store").on(table.store_id),
    dateIdx: index("idx_expenses_date").on(table.date),
  }),
);

// ──────────────────────────────────────────────
// Invoices (syncable)
// ──────────────────────────────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    sale_id: integer("sale_id").notNull(),
    invoice_number: text("invoice_number").notNull(),
    customer_name: text("customer_name"),
    customer_doc: text("customer_doc"),
    total: doublePrecision("total").notNull(),
    payment_method: text("payment_method", {
      enum: ["cash", "card", "mixed", "credit", "mercadopago"],
    }).notNull(),
    created_by: text("created_by").notNull().default("—"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    saleIdx: index("idx_invoices_sale").on(table.sale_id),
    storeIdx: index("idx_invoices_store").on(table.store_id),
    invoiceNumberIdx: uniqueIndex("idx_invoices_number").on(table.store_id, table.invoice_number),
  }),
);

// ──────────────────────────────────────────────
// Invoice items (syncable)
// ──────────────────────────────────────────────

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    invoice_id: integer("invoice_id").notNull(),
    product_id: integer("product_id"),
    product_name: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unit_price: doublePrecision("unit_price").notNull(),
    subtotal: doublePrecision("subtotal").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    invoiceIdx: index("idx_invoice_items_invoice").on(table.invoice_id),
  }),
);

// ──────────────────────────────────────────────
// Customers (syncable)
// ──────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    cuit: text("cuit"),
    credit_balance: doublePrecision("credit_balance").notNull().default(0),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeNameIdx: uniqueIndex("idx_customers_store_name").on(table.store_id, table.name),
  }),
);

export const creditPayments = pgTable(
  "credit_payments",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    customer_id: integer("customer_id").notNull(),
    amount: doublePrecision("amount").notNull(),
    date: timestamp("date").notNull().defaultNow(),
    notes: text("notes"),
    sale_id: integer("sale_id"),
    comprobante_id: integer("comprobante_id"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    customerIdx: index("idx_credit_payments_customer").on(table.customer_id),
    storeIdx: index("idx_credit_payments_store").on(table.store_id),
  }),
);

// ──────────────────────────────────────────────
// Proveedores (Suppliers — syncable)
// ──────────────────────────────────────────────

export const proveedores = pgTable(
  "proveedores",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    cuit: text("cuit"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeNameIdx: uniqueIndex("idx_proveedores_store_name").on(table.store_id, table.name),
  }),
);

// ──────────────────────────────────────────────
// Pedidos (Purchase Orders — syncable)
// ──────────────────────────────────────────────

export const pedidos = pgTable(
  "pedidos",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    proveedor_id: integer("proveedor_id").notNull(),
    date: timestamp("date").notNull().defaultNow(),
    status: text("status", { enum: ["pending", "received", "cancelled", "partial"] })
      .notNull()
      .default("pending"),
    total: doublePrecision("total").notNull().default(0),
    notes: text("notes"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeProveedorIdx: index("idx_pedidos_store_proveedor").on(table.store_id, table.proveedor_id),
    storeStatusIdx: index("idx_pedidos_store_status").on(table.store_id, table.status),
    createdIdx: index("idx_pedidos_created").on(table.created_at),
  }),
);

// ──────────────────────────────────────────────
// Pedido Items (syncable)
// ──────────────────────────────────────────────

export const pedidoItems = pgTable(
  "pedido_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    pedido_id: integer("pedido_id").notNull(),
    product_id: integer("product_id"),
    product_name: text("product_name").notNull(),
    quantity: doublePrecision("quantity").notNull().default(1),
    received_qty: doublePrecision("received_qty").notNull().default(0),
    unit_price: doublePrecision("unit_price").notNull(),
    subtotal: doublePrecision("subtotal").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    pedidoIdx: index("idx_pedido_items_pedido").on(table.pedido_id),
  }),
);

// ──────────────────────────────────────────────
// Purchase invoices (syncable)
// ──────────────────────────────────────────────

export const purchaseInvoices = pgTable(
  "purchase_invoices",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    store_id: text("store_id").notNull(),
    proveedor_id: integer("proveedor_id").notNull(),
    invoice_number: text("invoice_number"),
    total: doublePrecision("total").notNull().default(0),
    notes: text("notes"),
    created_by: text("created_by").notNull().default("—"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_purchase_invoices_store").on(table.store_id),
    proveedorIdx: index("idx_purchase_invoices_proveedor").on(table.proveedor_id),
    createdAtIdx: index("idx_purchase_invoices_created").on(table.created_at),
  }),
);

// ──────────────────────────────────────────────
// Purchase invoice items (syncable)
// ──────────────────────────────────────────────

export const purchaseInvoiceItems = pgTable(
  "purchase_invoice_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    purchase_invoice_id: integer("purchase_invoice_id").notNull(),
    product_id: integer("product_id").notNull(),
    product_name: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unit_price: doublePrecision("unit_price").notNull(),
    sale_price: doublePrecision("sale_price").notNull().default(0),
    subtotal: doublePrecision("subtotal").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    invoiceIdx: index("idx_purchase_invoice_items_invoice").on(table.purchase_invoice_id),
    productIdx: index("idx_purchase_invoice_items_product").on(table.product_id),
  }),
);

// ──────────────────────────────────────────────
// Comprobantes (syncable)
// ──────────────────────────────────────────────

export const comprobantes = pgTable(
  "comprobantes",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    tipo: text("tipo", { enum: ["factura", "boleta", "nota_credito", "nota_debito", "ticket"] }).notNull(),
    numero: text("numero").notNull(),
    cliente_nombre: text("cliente_nombre").notNull().default("Consumidor Final"),
    cliente_cuit: text("cliente_cuit"),
    cliente_direccion: text("cliente_direccion"),
    fecha: timestamp("fecha").notNull().defaultNow(),
    payment_method: text("payment_method", {
      enum: ["cash", "card", "mixed", "credit", "mercadopago"],
    }),
    subtotal: doublePrecision("subtotal").notNull().default(0),
    iva: doublePrecision("iva").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
    sale_id: integer("sale_id"),
    notes: text("notes"),
    cae: text("cae"),
    cae_vto: timestamp("cae_vto"),
    afip_numero: integer("afip_numero"),
    afip_pto_venta: integer("afip_pto_venta"),
    afip_tipo: integer("afip_tipo"),
    afip_status: text("afip_status", { enum: ["pending", "ok", "error"] })
      .notNull()
      .default("pending"),
    afip_error: text("afip_error"),
    modo: text("modo", { enum: ["afip", "interno"] }).notNull().default("interno"),
    created_by: text("created_by").notNull().default("—"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeTipoIdx: index("idx_comprobantes_store_tipo").on(table.store_id, table.tipo),
    numeroIdx: uniqueIndex("idx_comprobantes_numero").on(table.store_id, table.numero),
    createdIdx: index("idx_comprobantes_created").on(table.created_at),
  }),
);

// ──────────────────────────────────────────────
// AFIP config (syncable)
// ──────────────────────────────────────────────

export const afipConfig = pgTable(
  "afip_config",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    store_id: text("store_id").notNull(),
    cuit: text("cuit").notNull().default(""),
    razon_social: text("razon_social").notNull().default(""),
    domicilio: text("domicilio").notNull().default(""),
    condicion_iva: text("condicion_iva", {
      enum: ["monotributo", "responsable_inscripto", "exento"],
    })
      .notNull()
      .default("monotributo"),
    punto_venta: integer("punto_venta").notNull().default(1),
    ambiente: text("ambiente", { enum: ["homo", "prod"] }).notNull().default("homo"),
    activo: integer("activo").notNull().default(0),
    exigir_cae: integer("exigir_cae").notNull().default(0),
    cert: text("cert").notNull().default(""),
    key: text("key").notNull().default(""),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: uniqueIndex("idx_afip_config_store").on(table.store_id),
  }),
);

export const comprobanteItems = pgTable(
  "comprobante_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    comprobante_id: integer("comprobante_id").notNull(),
    product_id: integer("product_id"),
    product_name: text("product_name").notNull(),
    quantity: doublePrecision("quantity").notNull().default(1),
    unit_price: doublePrecision("unit_price").notNull(),
    subtotal: doublePrecision("subtotal").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    comprobanteIdx: index("idx_comprobante_items_comprobante").on(table.comprobante_id),
  }),
);

// ──────────────────────────────────────────────
// Users (local-only, no sync in cloud)
// ──────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    password_hash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "custom"] }).notNull().default("custom"),
    permissions: text("permissions").notNull().default("[]"),
    active: integer("active").notNull().default(1),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("idx_users_name").on(table.name),
  }),
);

// ──────────────────────────────────────────────
// Plantillas (invoice templates — syncable)
// ──────────────────────────────────────────────

export const plantillas = pgTable(
  "plantillas",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    tipo: text("tipo").notNull(),
    template_html: text("template_html").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeTipoIdx: uniqueIndex("idx_plantillas_store_tipo").on(table.store_id, table.tipo),
  }),
);

// ──────────────────────────────────────────────
// Company info (syncable)
// ──────────────────────────────────────────────

export const company = pgTable(
  "company",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    cuit: text("cuit").notNull().default(""),
    logo: text("logo").notNull().default(""),
    iva_alicuota: doublePrecision("iva_alicuota").notNull().default(0),
    iva_incluido: integer("iva_incluido").notNull().default(0),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: uniqueIndex("idx_company_store").on(table.store_id),
  }),
);

// ──────────────────────────────────────────────
// Price lists (syncable)
// ──────────────────────────────────────────────

export const priceLists = pgTable(
  "price_lists",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_price_lists_store").on(table.store_id),
  }),
);

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    price_list_id: integer("price_list_id").notNull(),
    product_id: integer("product_id").notNull(),
    price: doublePrecision("price"),
    percentage: doublePrecision("percentage"),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
  },
  (table) => ({
    listProductIdx: uniqueIndex("idx_price_list_items_list_product").on(table.price_list_id, table.product_id),
  }),
);

// ──────────────────────────────────────────────
// Sync support tables
// ──────────────────────────────────────────────

export const syncQueue = pgTable(
  "sync_queue",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    entity: text("entity").notNull(),
    entity_id: integer("entity_id").notNull(),
    operation: text("operation").notNull(),
    store_id: text("store_id").notNull(),
    payload: text("payload"),
    status: text("status", { enum: ["pending", "synced", "conflict"] })
      .notNull()
      .default("pending"),
    retry_count: integer("retry_count").notNull().default(0),
    synced_at: timestamp("synced_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_sync_queue_status").on(table.status),
    storeIdx: index("idx_sync_queue_store").on(table.store_id),
    createdAtIdx: index("idx_sync_queue_created").on(table.created_at),
  }),
);

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    entity: text("entity").notNull(),
    entity_id: integer("entity_id").notNull(),
    store_id: text("store_id").notNull(),
    local_updated_at: timestamp("local_updated_at"),
    cloud_updated_at: timestamp("cloud_updated_at"),
    verdict: text("verdict", { enum: ["cloud_won", "local_won"] }).notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    storeIdx: index("idx_sync_logs_store").on(table.store_id),
    entityIdx: index("idx_sync_logs_entity").on(table.entity),
  }),
);

// ──────────────────────────────────────────────
// Combos (syncable)
// ──────────────────────────────────────────────

export const combos = pgTable(
  "combos",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    combo_price: doublePrecision("combo_price").notNull().default(0),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] }).notNull().default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_combos_store").on(table.store_id),
  }),
);

export const comboItems = pgTable(
  "combo_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    combo_id: integer("combo_id").notNull(),
    product_id: integer("product_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] }).notNull().default("pending"),
  },
  (table) => ({
    comboIdx: index("idx_combo_items_combo").on(table.combo_id),
  }),
);

// ──────────────────────────────────────────────
// Bultos (syncable)
// ──────────────────────────────────────────────

export const bultos = pgTable(
  "bultos",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    product_id: integer("product_id"),
    quantity: integer("quantity").notNull().default(1),
    bulto_price: doublePrecision("bulto_price").notNull().default(0),
    store_id: text("store_id").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    sync_status: text("sync_status", { enum: ["pending", "synced", "conflict"] }).notNull().default("pending"),
  },
  (table) => ({
    storeIdx: index("idx_bultos_store").on(table.store_id),
  }),
);
