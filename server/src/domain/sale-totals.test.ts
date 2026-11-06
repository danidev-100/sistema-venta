import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from "vitest";
import express from "express";
import http from "node:http";
import { getTableName } from "drizzle-orm";
import {
  computeSaleTotals,  type BultoRef,
  type ClaimedTotals,
  type ComboRef,
  type IvaSettings,
  type PriceListItem,
  type ProductPrice,
  type SaleTotalsItemInput,
} from "./sale-totals";
import { computeIva } from "../../../src/lib/iva";

// P0-1: el servidor es la autoridad del precio. Los importes de una venta se
// recalculan desde la base y lo que mandó el cliente sólo se compara: si no
// coincide, la venta no existe. Estas reglas tienen que dar exactamente lo
// mismo que el carrito del POS (src/lib/iva.ts, cartTotal() y src/lib/combos.ts),
// porque si no, una venta legítima empezaría a rebotar con 409.

const NO_IVA: IvaSettings = { alicuota: 0, incluido: false };
const IVA_21_EXCLUIDO: IvaSettings = { alicuota: 21, incluido: false };
const IVA_21_INCLUIDO: IvaSettings = { alicuota: 21, incluido: true };

function item(overrides: Partial<SaleTotalsItemInput> & { productId: number }): SaleTotalsItemInput {
  return {
    productName: `Producto ${overrides.productId}`,
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    saleUnit: "unit",
    ...overrides,
  };
}

/** Lo que manda el cliente cuando los totales están bien: subtotal, IVA y total. */
function claimed(overrides: Partial<ClaimedTotals>): ClaimedTotals {
  return {
    total: 0,
    subtotal: 0,
    iva: 0,
    discountAmount: 0,
    discountPercent: 0,
    ...overrides,
  };
}

function compute(input: {
  items: SaleTotalsItemInput[];
  products: ProductPrice[];
  claimed: ClaimedTotals;
  iva?: IvaSettings;
  priceListItems?: PriceListItem[];
  combos?: ComboRef[];
  bultos?: BultoRef[];
}) {
  return computeSaleTotals({
    items: input.items,
    products: input.products,
    priceListItems: input.priceListItems ?? [],
    combos: input.combos ?? [],
    bultos: input.bultos ?? [],
    iva: input.iva ?? NO_IVA,
    claimed: input.claimed,
  });
}

describe("computeSaleTotals — IVA", () => {
  it("da el mismo IVA que el POS para cualquier alícuota", () => {
    // El POS calcula el IVA con src/lib/iva.ts. Si el servidor se despega de esa
    // cuenta, una venta legítima empieza a rebotar con 409.
    for (const [alicuota, incluido] of [
      [21, false],
      [21, true],
      [10.5, false],
      [10.5, true],
      [0, false],
    ] as const) {
      for (const neto of [0, 0.01, 99.99, 1000, 1234.56, 50000]) {
        const result = compute({
          products: [{ id: 1, price: neto }],
          items: [item({ productId: 1, quantity: 1, unitPrice: neto })],
          iva: { alicuota, incluido },
          claimed: claimed({ subtotal: neto }),
        });

        const expectedIva = computeIva(neto, alicuota, incluido);
        expect({ neto, alicuota, incluido, iva: result.iva, total: result.total }).toEqual({
          neto,
          alicuota,
          incluido,
          iva: expectedIva.iva,
          total: expectedIva.total,
        });
      }
    }
  });

  it("acepta una venta con IVA excluido que coincide con la base", () => {
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 2, unitPrice: 1000 })],
      iva: IVA_21_EXCLUIDO,
      claimed: claimed({ subtotal: 2000, iva: 420, total: 2420 }),
    });

    expect(result.subtotal).toBe(2000);
    expect(result.iva).toBe(420);
    expect(result.total).toBe(2420);
    expect(result.discountAmount).toBe(0);
    expect(result.mismatches).toEqual([]);
  });

  it("acepta una venta con IVA incluido y saca el IVA del neto", () => {
    // base = 2000 / 1,21 = 1652,89 → iva = 2000 − 1652,89 = 347,11, total = 2000
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 2, unitPrice: 1000 })],
      iva: IVA_21_INCLUIDO,
      claimed: claimed({ subtotal: 2000, iva: 347.11, total: 2000 }),
    });

    expect(result.iva).toBe(347.11);
    expect(result.total).toBe(2000);
    expect(result.mismatches).toEqual([]);
  });
});

describe("computeSaleTotals — descuentos", () => {
  it("aplica el descuento global sobre el neto y descuenta el IVA del total", () => {
    // neto 2000 − 10% = 1800; iva 21% = 378; total 2178
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 2, unitPrice: 1000 })],
      iva: IVA_21_EXCLUIDO,
      claimed: claimed({ subtotal: 2000, discountPercent: 10, discountAmount: 200, iva: 378, total: 2178 }),
    });

    expect(result.discountPercent).toBe(10);
    expect(result.discountAmount).toBe(200);
    expect(result.total).toBe(2178);
    expect(result.mismatches).toEqual([]);
  });

  it("aplica el descuento por ítem antes del descuento global", () => {
    // 1000 + 500 = 1500; el 10% del ítem 1 saca 100 → 1400; iva 21% = 294; total 1694
    const result = compute({
      products: [
        { id: 1, price: 500 },
        { id: 2, price: 500 },
      ],
      items: [
        item({ productId: 1, quantity: 2, unitPrice: 500, discountPercent: 10 }),
        item({ productId: 2, quantity: 1, unitPrice: 500 }),
      ],
      iva: IVA_21_EXCLUIDO,
      claimed: claimed({ subtotal: 1500, discountAmount: 100, iva: 294, total: 1694 }),
    });

    expect(result.items[0].subtotal).toBe(1000);
    expect(result.items[0].subtotal - result.items[0].net).toBe(100);
    expect(result.subtotal).toBe(1500);
    expect(result.discountAmount).toBe(100);
    expect(result.total).toBe(1694);
    expect(result.mismatches).toEqual([]);
  });
});

describe("computeSaleTotals — combos", () => {
  const products = [
    { id: 1, price: 100 },
    { id: 2, price: 200 },
  ];
  const combo: ComboRef = {
    id: 7,
    comboPrice: 250,
    items: [
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
    ],
  };

  it("descuenta el ahorro del combo como el carrito del POS", () => {
    // 100 + 200 = 300 − combo 250 = 50 de ahorro → cobra 250
    const result = compute({
      products,
      combos: [combo],
      items: [
        item({ productId: 1, unitPrice: 100 }),
        item({ productId: 2, unitPrice: 200 }),
      ],
      claimed: claimed({ subtotal: 300, discountAmount: 50, total: 250 }),
    });

    expect(result.comboDiscount).toBe(50);
    expect(result.total).toBe(250);
    expect(result.mismatches).toEqual([]);
  });

  it("no descuenta el combo si falta uno de sus productos", () => {
    const result = compute({
      products,
      combos: [combo],
      items: [item({ productId: 1, unitPrice: 100 })],
      claimed: claimed({ subtotal: 100, discountAmount: 0, total: 100 }),
    });

    expect(result.comboDiscount).toBe(0);
    expect(result.total).toBe(100);
    expect(result.mismatches).toEqual([]);
  });

  it("no acumula dos combos que comparten un producto", () => {
    const otherCombo: ComboRef = {
      id: 8,
      comboPrice: 180,
      items: [
        { productId: 1, quantity: 1 },
        { productId: 3, quantity: 1 },
      ],
    };
    const withThird = [...products, { id: 3, price: 150 }];

    const result = compute({
      products: withThird,
      combos: [otherCombo, combo],
      items: [
        item({ productId: 1, unitPrice: 100 }),
        item({ productId: 2, unitPrice: 200 }),
        item({ productId: 3, unitPrice: 150 }),
      ],
      // Gana el combo de mayor ahorro (p1+p3: 250−180 = 70) y el otro queda bloqueado.
      claimed: claimed({ subtotal: 450, discountAmount: 70, total: 380 }),
    });

    expect(result.comboDiscount).toBe(70);
    expect(result.total).toBe(380);
    expect(result.mismatches).toEqual([]);
  });
});

describe("computeSaleTotals — bultos", () => {
  it("descuenta el ahorro del bulto por cada conjunto completo", () => {
    // 4 × 100 = 400; bulto de 2 a 150 → ahorro 50 por conjunto × 2 = 100
    const result = compute({
      products: [{ id: 1, price: 100 }],
      bultos: [{ id: 3, productId: 1, quantity: 2, bultoPrice: 150 }],
      items: [item({ productId: 1, quantity: 4, unitPrice: 100 })],
      claimed: claimed({ subtotal: 400, discountAmount: 100, total: 300 }),
    });

    expect(result.bultoDiscount).toBe(100);
    expect(result.total).toBe(300);
    expect(result.mismatches).toEqual([]);
  });
});

describe("computeSaleTotals — listas de precios", () => {
  it("usa el precio de la lista sobre el precio de la base", () => {
    const result = compute({
      products: [{ id: 3, price: 1000 }],
      priceListItems: [{ productId: 3, price: 750, percentage: null }],
      items: [item({ productId: 3, quantity: 1, unitPrice: 750 })],
      claimed: claimed({ subtotal: 750, total: 750 }),
    });

    expect(result.items[0].unitPrice).toBe(750);
    expect(result.items[0].subtotal).toBe(750);
    expect(result.mismatches).toEqual([]);
  });

  it("aplica el porcentaje de la lista sobre el precio de la base", () => {
    // 1000 − 10% = 900
    const result = compute({
      products: [{ id: 3, price: 1000 }],
      priceListItems: [{ productId: 3, price: null, percentage: -10 }],
      items: [item({ productId: 3, quantity: 2, unitPrice: 900 })],
      claimed: claimed({ subtotal: 1800, total: 1800 }),
    });

    expect(result.items[0].unitPrice).toBe(900);
    expect(result.subtotal).toBe(1800);
    expect(result.mismatches).toEqual([]);
  });
});

describe("computeSaleTotals — ítems sin producto en la base", () => {
  it("conserva el precio que mandó el cliente para una venta libre", () => {
    // Un ítem con productId negativo no existe en la base: no hay precio que
    // imponer, y el POS ya lo trata como venta libre sin stock.
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: -1, productName: "Venta libre", quantity: 1, unitPrice: 500 })],
      claimed: claimed({ subtotal: 500, total: 500 }),
    });

    expect(result.subtotal).toBe(500);
    expect(result.mismatches).toEqual([]);
  });

  it("calcula el subtotal de un ítem por gramos con el precio por kilo", () => {
    // 250 g a 1000 el kilo = 250; el POS guarda la cantidad en gramos.
    const result = compute({
      products: [{ id: 4, price: 1000 }],
      items: [
        item({ productId: 4, quantity: 250, unitPrice: 1000, saleUnit: "gram" }),
      ],
      claimed: claimed({ subtotal: 250, total: 250 }),
    });

    expect(result.subtotal).toBe(250);
    expect(result.mismatches).toEqual([]);
  });
});

describe("computeSaleTotals — rechazo del total del cliente", () => {
  it("marca el total cuando el cliente lo baja más de un centavo", () => {
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 2, unitPrice: 1000 })],
      iva: IVA_21_EXCLUIDO,
      claimed: claimed({ subtotal: 2000, iva: 420, total: 2400 }),
    });

    expect(result.total).toBe(2420);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toEqual({
      field: "total",
      claimed: 2400,
      expected: 2420,
      difference: -20,
    });
  });

  it("marca el subtotal cuando el cliente inventa el precio de sus ítems", () => {
    // El cliente dice que el ítem sale 1 peso: el total y el subtotal son basura.
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 50, unitPrice: 1 })],
      claimed: claimed({ subtotal: 50, iva: 0, total: 50 }),
    });

    expect(result.items[0].unitPrice).toBe(1000);
    expect(result.items[0].subtotal).toBe(50000);
    expect(result.mismatches.map((m) => m.field).sort()).toEqual(["subtotal", "total"]);
  });

  it("tolera una diferencia de un centavo por redondeo", () => {
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 2, unitPrice: 1000 })],
      iva: IVA_21_EXCLUIDO,
      claimed: claimed({ subtotal: 2000, iva: 420, total: 2420.01 }),
    });

    expect(result.mismatches).toEqual([]);
  });

  it("marca el IVA cuando el cliente lo deja en cero", () => {
    const result = compute({
      products: [{ id: 1, price: 1000 }],
      items: [item({ productId: 1, quantity: 2, unitPrice: 1000 })],
      iva: IVA_21_EXCLUIDO,
      claimed: claimed({ subtotal: 2000, iva: 0, total: 2000 }),
    });

    expect(result.mismatches.map((m) => m.field).sort()).toEqual(["iva", "total"]);
  });
});

// ──────────────────────────────────────────────
// POST /api/sales — lo observable por la interfaz pública (S3, S6)
//
// La ruta real se monta contra una base falsa: alcanza para fijar el código de
// estado y el cuerpo, y sobre todo para probar que una venta rechazada no
// escribe nada (ni venta, ni ítems, ni movimientos de stock).
// ──────────────────────────────────────────────

const dbState = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  transactions: 0,
  inserts: [] as { table: string; values: any }[],
}));

vi.mock("../db.js", () => ({ getDb: () => fakeDb, getPool: () => ({}) }));

function thenable(rows: any[]): any {
  const query: any = {
    where: () => query,
    limit: () => query,
    orderBy: () => query,
    set: () => query,
    returning: () => query,
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  };
  return query;
}

function insertInto(table: any) {
  return {
    values: (values: any) => {
      dbState.inserts.push({ table: getTableName(table), values });
      return thenable([{ id: 901, ...values }]);
    },
  };
}

const fakeDb: any = {
  select: () => ({ from: (table: any) => thenable(dbState.rows[getTableName(table)] ?? []) }),
  insert: (table: any) => insertInto(table),
  update: () => ({ set: () => thenable([]) }),
  transaction: async (callback: (tx: any) => Promise<unknown>) => {
    dbState.transactions += 1;
    return callback(fakeDb);
  },
};

const { default: salesRouter } = await import("../routes/sales.js");

const httpApp = express();
httpApp.use(express.json());
httpApp.use("/api/sales", salesRouter);

let server: http.Server;
let port = 0;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = httpApp.listen(0, "127.0.0.1", () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  dbState.transactions = 0;
  dbState.inserts = [];
  dbState.rows = {
    products: [{ id: 1, price: 1000, store_id: "store_1", stock: 10 }],
    combos: [],
    combo_items: [],
    bultos: [],
    price_list_items: [],
    company: [{ id: 1, store_id: "store_1", iva_alicuota: 21, iva_incluido: 0 }],
    sale_items: [],
  };
});

function postSale(body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/sales",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => (raw += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body: raw ? JSON.parse(raw) : null }),
        );
      },
    );
    request.on("error", reject);
    request.end(payload);
  });
}

function saleBody(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "store_1",
    paymentMethod: "cash",
    items: [
      {
        productId: 1,
        productName: "Producto 1",
        quantity: 2,
        unitPrice: 1000,
        subtotal: 2000,
        discountPercent: 0,
        saleUnit: "unit",
      },
    ],
    subtotal: 2000,
    discountPercent: 0,
    discountAmount: 0,
    iva: 420,
    total: 2420,
    amountPaid: 2500,
    change: 80,
    createdBy: "admin",
    ...overrides,
  };
}

describe("POST /api/sales", () => {
  it("guarda la venta cuando los totales coinciden con la base", async () => {
    const response = await postSale(saleBody());

    expect(response.status).toBe(201);
    expect(response.body.total).toBe(2420);
    expect(response.body.subtotal).toBe(2000);
    expect(response.body.iva).toBe(420);

    const saleInsert = dbState.inserts.find((insert) => insert.table === "sales");
    expect(saleInsert?.values).toMatchObject({
      store_id: "store_1",
      total: 2420,
      subtotal: 2000,
      iva: 420,
      discount_amount: 0,
      amount_paid: 2500,
      change: 80,
    });
    expect(dbState.inserts.map((insert) => insert.table).sort()).toEqual([
      "sale_items",
      "sales",
      "stock_movements",
    ]);
    const movement = dbState.inserts.find((insert) => insert.table === "stock_movements");
    expect(movement?.values).toMatchObject({ quantity: 2, delta: -2, reference_id: "sale-901" });
  });

  it("rechaza con 409 y no escribe nada cuando el total no coincide", async () => {
    const response = await postSale(saleBody({ total: 2400, amountPaid: 2400, change: 0 }));

    expect(response.status).toBe(409);
    expect(response.body.expected).toEqual({ total: 2420, subtotal: 2000, iva: 420 });
    expect(typeof response.body.error).toBe("string");
    expect(dbState.transactions).toBe(0);
    expect(dbState.inserts).toEqual([]);
  });

  it("rechaza con 409 cuando el cliente inventa el precio de sus ítems", async () => {
    const response = await postSale(
      saleBody({
        items: [
          {
            productId: 1,
            productName: "Producto 1",
            quantity: 50,
            unitPrice: 1,
            subtotal: 50,
            discountPercent: 0,
            saleUnit: "unit",
          },
        ],
        subtotal: 50,
        iva: 0,
        total: 50,
        amountPaid: 50,
      }),
    );

    expect(response.status).toBe(409);
    expect(response.body.expected).toEqual({ total: 60500, subtotal: 50000, iva: 10500 });
    expect(dbState.transactions).toBe(0);
    expect(dbState.inserts).toEqual([]);
  });

  it("responde 400 y no escribe nada con un total que no es número", async () => {
    const response = await postSale(saleBody({ total: "mucho" }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("total");
    expect(dbState.transactions).toBe(0);
    expect(dbState.inserts).toEqual([]);
  });

  it("responde 400 y no escribe nada con un precio de ítem que no es número", async () => {
    const response = await postSale(
      saleBody({
        items: [
          {
            productId: 1,
            productName: "Producto 1",
            quantity: 2,
            unitPrice: "mil",
            subtotal: 2000,
            discountPercent: 0,
            saleUnit: "unit",
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("items[0].unitPrice");
    expect(dbState.transactions).toBe(0);
    expect(dbState.inserts).toEqual([]);
  });

  it("nunca guarda un 0 silencioso cuando el importe viene vacío", async () => {
    const response = await postSale(saleBody({ iva: "" }));

    expect(response.status).toBe(400);
    expect(dbState.inserts).toEqual([]);
  });

  it("responde 400 con un importe de cobro que no es número, sin abrir la venta", async () => {
    const response = await postSale(saleBody({ amountPaid: "dos mil" }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("amountPaid");
    expect(dbState.transactions).toBe(0);
    expect(dbState.inserts).toEqual([]);
  });
});
