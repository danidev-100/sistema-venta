# Cierre de turnos: vínculo real, regla única y formularios en teléfono

Cierra los tres pendientes que el usuario pidió «dejalo bien»: persistir el turno en la venta, eliminar la regla de asociación duplicada y dejar de tapar el header con los formularios inline en mobile.
Rama: `master`.

## Specs

S1. Pedido del usuario: «que queda pendiente, con nombre y apellido … dejalo bien».

S2. `sales.shift_id` se persiste al cobrar. `POST /api/sales` acepta `shiftId` y lo escribe; el cliente lo resuelve con el turno abierto del local en el momento del checkout; la venta normalizada expone `shiftId`. La columna ya existe en el esquema (nullable), así que no hay migración: las filas viejas quedan en `null`.

S3. El `shiftId` de la venta manda sobre la ventana horaria. Si la venta trae turno, decide inclusión aunque los horarios digan otra cosa (turnos solapados, sincronización tardía, reloj desfasado). Sin `shiftId`, se cae a la ventana `[openTime, closeTime]` con bordes incluidos.

S4. Una sola implementación de la regla: `src/lib/shift-sales.ts`. Los cuatro lugares que la repetían (`getShiftSummary` y `computeExpectedCash` en `src/store/cash-closing.ts`, el builder de exportación y la tabla de cierre en `src/pages/CashClosingPage.tsx`, y `ShiftQuickStats` en la misma página) delegan en el helper. `ClosureReport` queda cubierto al usar `getShiftSummary`.

S5. Los formularios inline de Productos y Clientes (también Proveedores y Pedidos si comparten el patrón) dejan de ocupar la pantalla completa en mobile: `.sheet` se reserva para overlays reales. El header y el menú siguen visibles y accesibles mientras se edita; el formulario conserva su propio encabezado y acciones.

S6. Comportamiento y tests: los 427 tests existentes siguen verdes; se agregan los del vínculo por `shiftId`. `tsc --noEmit` limpio en cliente y servidor (`cd server && npx tsc --noEmit`), y `vite build` OK.

S7. Ningún cambio de copy, de `aria-label` ni de handlers fuera de lo necesario.

## Tasks

- T1 · Persistir `shiftId`: `server/src/routes/sales.ts`, `src/store/index.ts` (tipo, normalizador, checkout) y precedencia en `src/lib/shift-sales.ts` con tests. `S2 S3 S4` — commit pendiente.
- T2 · Consolidar la regla: `src/store/cash-closing.ts` y `src/pages/CashClosingPage.tsx` usan el helper. `S4` — commit pendiente.
- T3 · Formularios inline sin `sheet` en mobile. `S5` — commit pendiente.
- T4 · Verificación: tests, `tsc` cliente y servidor, build, y medición real en 375/390. `S6 S7` — commit pendiente.

## Log

L1. Pedido original, textual: «que queda pendiente, con nombre y apellido … dejalo bien».
L2. Estado previo: `sales.shift_id` existía en el esquema pero `POST /sales` no lo escribía; la asociación venta↔turno se calculaba por ventana horaria en cuatro lugares distintos; los paneles inline de Productos/Clientes usaban `.sheet` y en mobile tapaban el header.
