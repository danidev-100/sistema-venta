import { describe, it, expect } from "vitest";
import { decideStoreAccess, type StoreAccessInput } from "./store-access";

// La sucursal activa de un usuario sale de su turno de caja abierto.
// Estas reglas son el contrato de la auditoría P0-2: ningún cajero puede quedar
// bloqueado para siempre, y ninguno puede escribir en la sucursal de otro.

const base: StoreAccessInput = {
  role: "custom",
  method: "GET",
  pathname: "/api/products",
  requestedStoreId: "store_1",
  openShifts: [],
  hasShiftHistory: false,
  storeIsActive: true,
};

function decide(overrides: Partial<StoreAccessInput>) {
  return decideStoreAccess({ ...base, ...overrides });
}

describe("decideStoreAccess — admin", () => {
  it("admin opera en la sucursal que pide", () => {
    expect(decide({ role: "admin", requestedStoreId: "store_2" })).toEqual({
      allow: true,
      store: "store_2",
      rule: "admin",
    });
  });

  it("admin no queda atado a su turno abierto", () => {
    expect(
      decide({ role: "admin", openShifts: ["store_1"], requestedStoreId: "store_2" }),
    ).toEqual({ allow: true, store: "store_2", rule: "admin" });
  });
});

describe("decideStoreAccess — cajero con turno abierto", () => {
  it("opera en la sucursal de su turno", () => {
    expect(decide({ openShifts: ["store_1"], hasShiftHistory: true })).toEqual({
      allow: true,
      store: "store_1",
      rule: "open-shift",
    });
  });

  it("no puede pedir otra sucursal", () => {
    expect(
      decide({ openShifts: ["store_1"], hasShiftHistory: true, requestedStoreId: "store_2" }),
    ).toEqual({ allow: false, status: 403, error: "No tenés acceso a esta tienda" });
  });

  it("si no pide sucursal, usa la de su turno", () => {
    expect(
      decide({ openShifts: ["store_1"], hasShiftHistory: true, requestedStoreId: null }),
    ).toEqual({ allow: true, store: "store_1", rule: "open-shift" });
  });
});

describe("decideStoreAccess — dos turnos abiertos", () => {
  it("rechaza con 409 y nombra las sucursales para que cierre una", () => {
    const result = decide({
      openShifts: ["store_1", "store_2"],
      hasShiftHistory: true,
      requestedStoreId: "store_1",
    });
    expect(result.allow).toBe(false);
    if (!result.allow) {
      expect(result.status).toBe(409);
      expect(result.error).toContain("store_1");
      expect(result.error).toContain("store_2");
    }
  });
});

describe("decideStoreAccess — cajero sin turno abierto", () => {
  it("con historia previa no opera: le pide abrir turno", () => {
    expect(decide({ openShifts: [], hasShiftHistory: true })).toEqual({
      allow: false,
      status: 403,
      error: "Abrí un turno de caja para operar",
    });
  });

  it("sin historia puede abrir su primer turno en una sucursal activa", () => {
    expect(
      decide({
        method: "POST",
        pathname: "/api/cash/shifts",
        openShifts: [],
        hasShiftHistory: false,
        requestedStoreId: "store_1",
      }),
    ).toEqual({ allow: true, store: "store_1", rule: "open-shift-request" });
  });

  it("no puede abrir turno en una sucursal inactiva o inexistente", () => {
    expect(
      decide({
        method: "POST",
        pathname: "/api/cash/shifts",
        openShifts: [],
        hasShiftHistory: false,
        storeIsActive: false,
      }),
    ).toEqual({ allow: false, status: 400, error: "Sucursal inexistente o inactiva" });
  });

  it("mientras no tiene turno puede leer el catálogo para poder abrirlo", () => {
    for (const pathname of ["/api/products", "/api/categories", "/api/company", "/api/price-lists", "/api/cash/shifts"]) {
      expect(decide({ pathname, openShifts: [], hasShiftHistory: false })).toEqual({
        allow: true,
        store: "store_1",
        rule: "bootstrap",
      });
    }
  });

  it("mientras no tiene turno NO puede vender ni tocar plata", () => {
    for (const pathname of ["/api/sales", "/api/expenses", "/api/customers"]) {
      expect(decide({ method: "POST", pathname, openShifts: [], hasShiftHistory: false })).toEqual({
        allow: false,
        status: 403,
        error: "Abrí un turno de caja para operar",
      });
    }
  });
});
