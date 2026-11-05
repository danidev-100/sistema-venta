# Responsive total — shell + 12 páginas

Hacer que toda la app funcione en celular (360-430 px) y tablet (640-1023 px) sin scroll horizontal de página, sin barras duplicadas y sin perder acciones.
Rama: `feature/bloques-ui`. Continúa el trabajo de `odd/tasks/bloques-ui.md`.

## Specs

S1. Pedido del usuario: «biennnn ahora quiero qu sea totalmente responsive».

S2. Alcance elegido por el usuario: «Toda la app: shell + las 12 páginas». Entran shell (App + NavigationBar), POS, Productos, Caja, Comprobantes, Clientes, Proveedores, Pedidos, Gastos, Estadísticas, Usuarios, Admin y Login.

S3. Tablas en celular, decisión del usuario: «Tarjetas apiladas en mobile». Debajo de `lg` cada fila se lee como tarjeta con etiqueta y valor; desde `lg` sigue siendo la tabla.

S4. **Una sola copia del DOM.** La transformación fila→tarjeta se hace con CSS (`.table-cards` + `data-label` en cada `td`), nunca renderizando dos vistas. Motivo: `UserManagementPage` ya duplica tabla y tarjetas y su test tiene que elegir «la primera» coincidencia; con 9 tablas más eso multiplica el riesgo de tests ambiguos. Regla: ningún texto de dato aparece dos veces en el DOM.

S5. Breakpoints: base 360 px sin desbordar; `sm` 640 tablet chica; `lg` 1024 escritorio (donde aparece la sidebar). Nada crítico puede requerir más de 1024 px.

S6. Un solo header por breakpoint. Hoy en mobile se apilan dos barras: la de `NavigationBar` (`lg:hidden`, «Sistema Ventas») y la de `App` (título de página + theme toggle). Queda una sola con hamburguesa, título y theme toggle. `NavigationBar` debe seguir renderizando sin props obligatorias (`navigation-bar.test.tsx` lo monta como `<NavigationBar />`).

S7. Sin scroll horizontal de página: `main` no desborda a lo ancho; los contenedores de tabla conservan `overflow-x-auto` sólo donde la tabla real supera el ancho (desktop).

S8. Modales y formularios: en mobile ocupan la pantalla y hacen scroll interno (sheet), en desktop quedan como hoy. Ningún botón de acción fuera del viewport.

S9. Comportamiento observable intacto: `pnpm test` sigue en 417/417 (los tests de páginas consultan roles y textos; el CSS no cambia el DOM). `tsc --noEmit` limpio y `vite build` OK.

S10. Dark mode y `design/system.md` siguen siendo fuente de verdad: la regla responsive se documenta ahí, no en comentarios sueltos.

## Tasks

- T1 · Shell: un solo header (hamburguesa + título + theme toggle), padding responsive, `dvh` para el alto real del navegador móvil, `main` sin desborde. `S5 S6 S7` — commit `T1 (shell)`.
- T2 · Primitivas y reglas: `.table-cards` en `src/styles.css` (con `data-label`), `.sheet` para modales, helpers de toolbar; `design/system.md`. `S3 S4 S8 S10` — commit pendiente.
- T3 · Productos: tabla→tarjetas, toolbar y filtros que envuelven, modales de producto/precios/import en sheet. `S3 S4 S8` — commit pendiente.
- T4 · Clientes, Proveedores, Pedidos: tabla→tarjetas y toolbars. `S3 S4` — commit pendiente.
- T5 · Caja, Comprobantes, Gastos, Usuarios, Admin: tabla→tarjetas; `UserManagementPage` migra su vista duplicada a `.table-cards` (una sola copia). `S3 S4` — commit pendiente.
- T6 · POS, Dashboard, Estadísticas, Login: grillas y gráficos apilan, carrito usable a 375 px, sin desborde en recharts. `S5 S7` — commit pendiente.
- T7 · Verificación: `pnpm test` 417/417, `tsc --noEmit`, `vite build`, y revisión a 375 / 768 / 1440 en claro y oscuro. `S9 S10` — commit pendiente.

## Log

L1. Pedido original del usuario, textual: «biennnn ahora quiero qu sea totalmente responsive».
L2. Decisiones del usuario en la consulta de alcance: «Toda la app: shell + las 12 páginas» y «Tarjetas apiladas en mobile».
L3. Estado encontrado: el shell ya tiene drawer móvil, pero en mobile conviven dos barras (`App` h-16 con título + `NavigationBar` h-14 con marca). 9 páginas usan `<table>` con `overflow-x-auto`; sólo `UserManagementPage` tiene vista de tarjetas, duplicando el DOM y obligando a su test a elegir «la primera» coincidencia. `ProductsPage` tenía `text-xm` (clase inexistente) y renderizaba a 16 px.
L4. Decisión de arquitectura (S4): una sola copia del DOM con CSS. Evita duplicar lógica por página y evita tests ambiguos por textos repetidos.
