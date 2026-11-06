# POS hardening — los ocho hallazgos de la auditoría

Cerrar de raíz los defectos de la auditoría del POS, en el orden acordado: sucursal derivada del turno abierto y servidor como autoridad del precio, más los P1/P2/P3.
Rama: `master`. Auditoría de origen: `audit/pos-findings` (memoria) y el informe del 5/11.

## Specs

S1. Instrucción del usuario, textual: «hagamos tod en orden que quede sin errores». Alcance: los ocho hallazgos (P0-1, P0-2, P1-3, P1-4, P2-5, P2-6, P2-7, P3-8) en el orden propuesto en el informe.

S2. Decisión del usuario para P0-2, textual: «Derivar la sucursal del turno abierto». El token no lleva `storeId`; el backend resuelve la tienda desde el turno abierto del usuario, con fallback cuando no hay turno. Como `shifts` solo guarda `employee` (texto) y no `user_id`, la derivación exige registrar el usuario real del turno.

S3. Decisión del usuario para P0-1, textual: «El servidor recalcula y es la autoridad». `POST /sales` busca cada producto en la DB, aplica lista de precios y descuento global, calcula el IVA según `company`, y si el body no coincide responde 409 con el total correcto. El cliente no puede inventar importes.

S4. Los ocho hallazgos se corrigen en este orden: P0-2 (cajeros bloqueados), P0-1 (totales del cliente), P1-3 (devoluciones sin rol ni autor), P1-4 (`safe()` que convierte basura en 0), P2-5 (rutas `/api/*` inexistentes devuelven 200 HTML), P2-6 (pertenencia de ítems a la tienda), P2-7 (idempotencia del cobro), P3-8 (sesión de 24 h fijas).

S5. La data existente no se pierde ni se reescribe a ciegas: migraciones aditivas, backfill best-effort, y las filas históricas quedan con `user_id` nulo cuando el nombre no matchea un usuario real.

S6. Cada corrección deja un test que fija el comportamiento observable por la interfaz pública (código de estado y cuerpo), y un input rechazado no deja datos ni contadores cambiados. La lógica pura de dinero se extrae a un módulo con tests unitarios (primero en rojo).

S7. `pnpm test` y `pnpm build` deben seguir verdes, y el POS debe seguir operando para admin y para un cajero con turno abierto.

## Tasks

- T1 · `shifts.user_id` (migración aditiva + backfill por nombre) y `POST /cash/shifts` toma el usuario del token, no del body. `S2 S5` — commit `cd87ab5`
- T2 · `resolveUserStore(userId)` + `requireStoreAccess` reescrito: turno abierto → último turno → ventana acotada sin turno; 409 si hay más de un turno abierto. `S2 S4` — commit `cd87ab5` (módulo puro `server/src/domain/store-access.ts`, 11 tests)
- T3 · `POST /sales` recalcula totales desde la DB (módulo puro `sale-totals` con tests) y rechaza 409 si el body difiere. `S3 S4 S6` — commit `83c2f10`
- T4 · Devoluciones: rol requerido y autor registrado. `S4` — commit `5dad9fa`
- T5 · `404` explícito para `/api/*` desconocidas, antes del fallback del SPA. `S4` — commit `f5076af` (+ `scripts/smoke-api.mjs`)
- T6 · Idempotencia en el cobro (`idempotencyKey` + índice único). `S4` — commit `7089895`
- T7 · Los ítems de una venta deben pertenecer a la tienda de la venta. `S4` — commit `5dad9fa`
- T8 · Sesión deslizante: no morir a las 24 h en medio del turno. `S4` — módulo `server/src/domain/session.ts` con 6 tests, cabecera `X-Refreshed-Token` expuesta por CORS y leída por `src/lib/api.ts`; verificado con un token de 1 h (renueva) y uno de 23 h (no renueva)
- T9 · Verificación: tests, build, y recorrido integral de cajero. `S6 S7` — hecho: catálogo 200 sin turno → ventas 403 → abrir turno 201 con `user_id 2` → ventas 200 → cobro 201 atado al turno → reintento con la misma clave 200 → devolución del cajero 403 → devolución del admin 200 con `refunded_by=admin` → cierre de turno 200; filas de prueba borradas y stock intacto. Queda la revisión nativa, bloqueada por configuración del harness

## Log

L1. Pedido original: «quiero que audites el pos para ver que fallos tiene de prioridad alta a baja». Salida: informe con P0-1 (la API guarda los totales que manda el cliente), P0-2 (dani y lola reciben 403 en products/sales/cash/customers/company porque `users` no tiene `store_id` y el token sale sin tienda), P1-3 (refund sin rol ni autor), P1-4 (`Number(x) || 0`), P2-5 (`/api/shifts` devuelve 200 HTML), P2-6 (tenencia por query/body), P2-7 (sin idempotencia), P3-8 (token 24 h).
L2. Respuesta del usuario: «hagamos tod en orden que quede sin errores», y las dos decisiones de diseño: sucursal derivada del turno abierto, servidor autoridad del precio.
L3. Hallazgo de terreno: `shifts` no tiene `user_id` (solo `employee`, texto), así que la derivación de sucursal exige agregarlo y backfillear por nombre. Además admin tiene dos turnos abiertos (store_1 y store_2) y uno histórico en `store_3`, que ya no existe: la ambigüedad se resuelve rechazando el estado y pidiendo cerrar uno.
L4. El import de `requireRole` en `sales.ts` destapó un defecto latente: `middleware/auth.ts` resolvía `JWT_SECRET` en un IIFE de nivel de módulo y hacía `process.exit(1)`, así que cualquier test que importara una ruta con ese middleware mataba el proceso de vitest sin reportar nada. Se resolvió lazy (`getJwtSecret`) y el fail-fast quedó en `index.ts` (`assertJwtConfigured`).
L5. Los totales se recalculan con el servidor como autoridad, pero los ahorros de combo y bulto se cotizan sobre el precio base del producto (no sobre el precio de lista), igual que `cartTotal()`: es lo que evita que una venta legítima con lista + combo rebote con 409.
L6. Revisión nativa: hay candidato sin revisar y la lineage `review-1cc963e50cc77845` quedó abierta en `collect`, pero los reviewers no arrancan porque el harness no tiene modelo asignado a `review-risk` ni a `review-reliability` (`reviewer-config-invalid`). Es configuración fuera del repo; queda pendiente de decisión del dueño.
