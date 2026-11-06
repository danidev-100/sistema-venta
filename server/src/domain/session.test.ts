import { describe, it, expect } from "vitest";
import { shouldRefreshSession, SESSION_TTL_MS } from "./session";

// P3-8: el token dura 24 h fijas, así que un turno que cruza el vencimiento
// deja al cajero con un 401 en medio de una venta. La sesión se desliza:
// cuando al token le queda poco, el servidor entrega uno nuevo.

const now = Date.UTC(2026, 10, 5, 12, 0, 0);
const expIn = (ms: number) => Math.floor((now + ms) / 1000);

describe("shouldRefreshSession", () => {
  it("no renueva un token recién emitido", () => {
    expect(shouldRefreshSession(expIn(SESSION_TTL_MS), now)).toBe(false);
  });

  it("no renueva cuando todavía le queda más de un cuarto de vida", () => {
    expect(shouldRefreshSession(expIn(SESSION_TTL_MS * 0.26), now)).toBe(false);
  });

  it("renueva cuando le queda menos de un cuarto de vida", () => {
    expect(shouldRefreshSession(expIn(SESSION_TTL_MS * 0.24), now)).toBe(true);
  });

  it("renueva cuando está por vencer en minutos", () => {
    expect(shouldRefreshSession(expIn(60 * 1000), now)).toBe(true);
  });

  it("un token ya vencido no se renueva: lo rechaza la verificación", () => {
    // Llega acá sólo si la verificación falló, así que no debe renovar nada.
    expect(shouldRefreshSession(expIn(-1000), now)).toBe(false);
  });

  it("sin exp o con basura, no renueva", () => {
    expect(shouldRefreshSession(undefined, now)).toBe(false);
    expect(shouldRefreshSession(Number.NaN, now)).toBe(false);
  });
});
