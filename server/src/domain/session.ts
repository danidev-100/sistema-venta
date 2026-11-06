// Sesión deslizante (auditoría P3-8).
//
// El token dura 24 horas fijas, así que un turno que cruza el vencimiento deja
// al cajero con un 401 en medio de una venta. Cuando al token le queda menos de
// un cuarto de su vida, el servidor emite uno nuevo y lo devuelve en la
// respuesta; el cliente lo guarda y la sesión se estira sola mientras trabaja.

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Se renueva cuando queda menos de esta fracción de la vida del token. */
export const REFRESH_THRESHOLD_RATIO = 0.25;

/**
 * @param expSeconds vencimiento del token en segundos (el `exp` del JWT)
 * @param nowMs reloj actual en milisegundos
 *
 * Un token ya vencido devuelve false: si la verificación falló, no hay sesión
 * que renovar, y el cliente tiene que volver a loguearse.
 */
export function shouldRefreshSession(expSeconds: number | undefined, nowMs: number): boolean {
  if (expSeconds == null || !Number.isFinite(expSeconds)) return false;

  const remainingMs = expSeconds * 1000 - nowMs;
  if (remainingMs <= 0) return false;

  return remainingMs <= SESSION_TTL_MS * REFRESH_THRESHOLD_RATIO;
}
