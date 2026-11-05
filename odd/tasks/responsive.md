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

- T1 · Shell: un solo header (hamburguesa + título + theme toggle), padding responsive, `dvh` para el alto real del navegador móvil, `main` sin desborde. `S5 S6 S7` — commit `0f007ca`.
- T2 · Primitivas y reglas: `.table-cards` en `src/styles.css` (con `data-label`), `.sheet` para modales, helpers de toolbar; `design/system.md`. `S3 S4 S8 S10` — commit `348edce`.
- T3 · Productos y Clientes: tabla→tarjetas, toolbar y filtros que envuelven, paneles de producto/cliente y modales de precios/import en sheet. `S3 S4 S8` — commit `451c7fa`.
- T4 · Proveedores, Pedidos, Gastos: tabla→tarjetas y toolbars. Las tablas de resumen/edición (detalle de pedido, totales por categoría, ítems de factura) siguen siendo tablas con scroll propio. `S3 S4` — commit `70c3bbe`.
- T5 · Caja, Comprobantes, Usuarios, Admin: tabla→tarjetas; `UserManagementPage` migra su vista duplicada a `.table-cards` (una sola copia, -105 líneas). `S3 S4` — commit `f0037e4`.
- T6 · POS, Dashboard, Estadísticas, Login: grillas y gráficos apilan, carrito usable a 375 px, sin desborde en recharts. `S5 S7` — commit `8ca1cc8`.
- T7 · Verificación: `pnpm test` 417/417 (32 archivos), `tsc --noEmit` limpio, `vite build` OK y chequeo estructural (13 tablas `table-cards`, cada `td` con `data-label`/`data-plain`/`data-head`). `S9 S10` — commit `2d78432`.

## Log

L1. Pedido original del usuario, textual: «biennnn ahora quiero qu sea totalmente responsive».
L2. Decisiones del usuario en la consulta de alcance: «Toda la app: shell + las 12 páginas» y «Tarjetas apiladas en mobile».
L3. Estado encontrado: el shell ya tiene drawer móvil, pero en mobile conviven dos barras (`App` h-16 con título + `NavigationBar` h-14 con marca). 9 páginas usan `<table>` con `overflow-x-auto`; sólo `UserManagementPage` tiene vista de tarjetas, duplicando el DOM y obligando a su test a elegir «la primera» coincidencia. `ProductsPage` tenía `text-xm` (clase inexistente) y renderizaba a 16 px.
L4. Decisión de arquitectura (S4): una sola copia del DOM con CSS. Evita duplicar lógica por página y evita tests ambiguos por textos repetidos.
L5. T6 reduce trabajo real: Dashboard, Estadísticas y Login ya apilaban (`grid-cols-1 sm:…`) y los gráficos usan `ResponsiveContainer` al 100 %, así que sólo hicieron falta los diez diálogos del POS como sheet.
L6. Reparto por superficies disjuntas: tres workers en paralelo (Productos+Clientes / Proveedores+Pedidos+Gastos / Caja+Comprobantes+Usuarios+Admin) y el POS+charts inline. Ninguno tocó `src/styles.css`, `design/system.md` ni los archivos de otro.
L7. Hallazgo de T5: `InvoiceDetail` y `ReconciliationForm` no son overlays (son panel lateral y sección inline); aplicarles `sheet` los habría vuelto pantalla completa sin forma de cerrar. Quedan sin `sheet` a propósito.
L8. Verificación (T7): `tsc --noEmit` limpio; `vitest run` 417/417 en 32 archivos; `vite build` OK; 13 tablas con `table-cards` y cobertura completa de `data-label`/`data-plain`/`data-head`. El único dato sin `data-head` estaba en `ProductSearchRow` (celda de componente fuera del bloque JSX de la tabla) y se corrigió con `data-plain data-head`.
L9. Contrato reforzado: `UserManagementPage.test.tsx` ahora consulta `getByLabelText` (singular) en vez de `getAllByLabelText(...)[0]`, así el test falla si alguien vuelve a duplicar el DOM.
L10. Release: merge fast-forward `feature/bloques-ui` → `master` (`66d1aaa..2d78432`, 0 conflictos) y push a `origin/master`. Deploy a producción con `vercel --prod`: deployment `dpl_DNfGKxiN8r2tkx4gyVKvkRjfgKVb`, `READY`, alias de producción `https://sistema-venta-one.vercel.app`.
L11. Smoke test post-deploy sobre `https://sistema-venta-one.vercel.app`: `/` → 200; `/api/company` y `/api/products` → 401 (la función responde y exige auth, ya no 500 por esquema); asset `/assets/index-Ggv-f-zP.css` → 200, 53.851 bytes, contiene `table-cards` y `100dvh`, o sea que las primitivas responsive sí están en producción. La verificación con sesión autenticada queda del lado del usuario (no invento credenciales).
L12. Bug reportado por el usuario: «en movile no se ve los prouctos en el carrito y no se ve el boton de cobrar al final». Medido con Chromium real sobre el CSS de producción y un carrito de 12 ítems: en 360×640 el área de ítems quedaba en **33 px** y en 390×844 en **144 px** (el `max-lg:min-h-[46vh]` del panel + el `flex-1` interno colapsaban la lista; el `overflow-hidden` del aside cortaba el resto). Arreglo: en `<lg` el POS usa dos vistas con switch (Catálogo / Venta actual con contador) en lugar de partir la altura; ocultamiento por CSS (`max-lg:hidden`) para no desmontar el DOM que usan los tests. Medición posterior: 360×640 → 238 px de ítems, 390×844 → 442 px, 414×896 → 494 px; Cobrar dentro del viewport en los tres y sin scroll de página ni horizontal. Escritorio sin cambios (switch `lg:hidden`, paneles lado a lado).
