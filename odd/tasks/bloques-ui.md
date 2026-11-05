# Bloques UI — identidad visual + shell + POS

Implementar el modelo 03 «Bloques» (`design/sistema/03-bloques.html`) en la app real: tokens nuevos, shell de navegación y pantalla de Punto de Venta.
Rama: `feature/bloques-ui`. Artefacto visual de referencia: `design/sistema/03-bloques.html` + `design/sistema/modelos.md`.

## Specs

S1. El modelo elegido es Bloques, con esta frase del usuario: «03 Bloques este me gusto».
Fuente visual: `design/sistema/03-bloques.html` (artboard 1440×900) y la tabla de tokens de `design/sistema/modelos.md`.

S2. Alcance autorizado: «POS + shell de la app».
Incluye tokens base (`src/styles.css`, `tailwind.config.js`), shell (`src/App.tsx` y navegación) y Punto de Venta (`src/pages/POSPage.tsx` y sus componentes de carrito/cobro).
No incluye rediseñar Productos, Pedidos, Estadísticas, Caja ni Login más allá de lo que el shell nuevo impone.

S3. Paleta autorizada: «Adoptar la identidad de Bloques».
Tokens a adoptar (tomados del artboard, no inventados):
- Fondo `245 246 250` · superficie `255 255 255`
- Tinta `20 22 31` · secundario `107 113 131`
- Acento índigo `91 91 214`, gradiente a `120 118 232`
- Estados: ok `22 163 74` · atención `245 158 11` · destructivo `225 29 72`
- Radios: 12 px controles · 18 px tarjetas · 20 px panel de venta · pill en filtros
- Tipografía: `system-ui`, títulos 24 px / 650 con tracking negativo, números en mono con `tabular-nums`

S4. El sistema de diseño del proyecto debe seguir siendo la única fuente de verdad: `design/system.md` se actualiza a los tokens de Bloques en la misma unidad de trabajo que `src/styles.css`.

S5. Dark mode debe seguir funcionando: los tokens nuevos se definen también bajo `.dark` con contraste AA.

S6. Los tests existentes son contrato: `pnpm test` debe pasar. Un test que fije comportamiento previo del shell o del POS se actualiza sólo si el cambio de diseño lo vuelve obsoleto, nunca se borra para tapar una regresión.

S7. El POS conserva su comportamiento observable: agregar producto por click y por escaneo, editar cantidad, subtotal/descuento/total, cobro y cierre. El rediseño cambia la forma, no la lógica de venta.

S8. La tarjeta del catálogo del POS muestra la imagen del producto, con el mismo fallback que usa el carrito (`ProductImage`: ícono de placeholder cuando no hay imagen o la URL falla). Instrucción del usuario, textual: «tambien en la card del pos tendiria que traer la imagen del proucto». La imagen no debe cambiar el nombre accesible de la tarjeta (alt vacío) porque los tests consultan la tarjeta por su texto.

## Tasks

- T1 · Tokens: `src/styles.css` (light + dark) y `tailwind.config.js` a la paleta de Bloques; `design/system.md` actualizado. `S3 S4 S5` — commit `1227ecf`.- T2 · Shell: navegación lateral de 248 px con marca y topbar con título + theme toggle en `src/App.tsx`. `S2 S3` — commit `ffd224c`.
- T3 · POS: `src/pages/POSPage.tsx` + `src/components/CartPanel.tsx` con grilla de tarjetas y panel de venta de 396 px. `S2 S3 S7` — commit `a253460`.
- T4 · Verificación: `pnpm test` (32 archivos verdes) + `pnpm build` (exit 0, 1046 módulos) + `tsc --noEmit` limpio. `S6 S7` — commit `a253460`.
- T5 · Imagen del producto en la tarjeta del catálogo del POS (`src/pages/POSPage.tsx` + `ProductImage`). `S8` — commit `57fc770`

## Log

L1. Pedido original del usuario: «03 Bloques este me gusto».
L2. Decisiones de alcance, textuales del usuario: «POS + shell de la app» y «Adoptar la identidad de Bloques».
L3. El canvas de Gentle Design no renderiza en el visor del usuario (canvas.js usa sintaxis ES2020 que su motor no parsea); se agregó `design/sistema/index.html` como vista estática de respaldo. No afecta la implementación.
L4. Desviación deliberada en T3: la fila de medios de pago del panel de venta **no** se implementa. Replicar «Efectivo / Tarjeta / Mixto» fuera de `CheckoutModal` rompe dos tests de contrato (`keyboard-shortcuts.test.tsx` exige que «Efectivo» no exista con el modal cerrado; `mixed-payment.test.tsx` exige una sola coincidencia al abrirlo) y sería un control sin función. El medio de pago se elige en `CheckoutModal`, que es donde efectivamente opera.
L6. Pedido del usuario (5/11): «tambien en la card del pos tendiria que traer la imagen del proucto» → S8 y T5.
L5. Pase de revisión en vivo (1440×900, claro y oscuro), sin cambios de alcance:
- Drift de base local: faltaban las migraciones `0008` y `0009` (`sales.iva`, `company.iva_alicuota`, `company.iva_incluido`, `invoice_items.product_id`, `invoices.created_by`, `bultos.product_id` nullable). `GET /api/sales` y `GET /api/company` respondían 500 y 31 ventas quedaban invisibles para estadísticas, cierre de caja e historial de turnos. Aplicado el DDL aditivo exacto de ambas migraciones; ambos endpoints responden 200.
- Regresión de T3 corregida: con el panel fijo de 396 px las filas del carrito desbordaban y el botón «Eliminar» terminaba en x=1476 sobre un viewport de 1440, fuera de pantalla. La fila pasa a grilla de dos líneas (índice/thumbnail/nombre/eliminar arriba; cantidad, precio unitario y subtotal abajo), sin tocar los `aria-label` que fijan los tests. El precio unitario sólo se muestra cuando aporta información (cantidad ≠ 1 o venta por peso).
- `--color-pos-success` en claro pasa de `22 163 74` a `24 124 60` para cumplir S5 en todos sus usos: 5.27:1 como texto sobre superficie, 4.88:1 sobre el fondo, 5.27:1 con texto blanco encima del relleno y 4.60:1 sobre el tinte `bg-pos-success/10` (que usan CheckoutModal, ShiftPanel, ClosureReport, ReconciliationForm y CashClosingPage). Con `22 163 74` esos pares daban 3.30 / 3.05 / 3.30 / 2.96. `design/system.md` sincronizado.
- El hint «O escaneá el código de barras directamente» se alinea a la izquierda con los chips y usa `pos-muted` pleno (4.51:1) en lugar de `pos-muted/50`.
- Verificación: `pnpm test` 417/417 en 32 archivos y `pnpm build` sin errores.
- Fuera de alcance, reportado: en modo oscuro `text-white` sobre relleno `bg-pos-success` queda en 2.28:1 (BrandFilter, CategoryList, CategoryTree, CollectPaymentModal, OpenShiftModal, ShiftPanel, CashMovementModal, CustomersPage). Es preexistente y necesita decidir entre texto oscuro sobre el verde o un token de tinta propio; toca 8 archivos fuera de POS + shell.
L6. Pedido del usuario sobre el POS: «en el pos las card pueden ser mas angosta para que se vea mejor la parte de caja mas ancha». Cambia densidad, no lógica: grilla de tarjetas a `sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5` (antes 2 / 3) y panel de venta a 440 px (antes 396). `design/system.md` sincronizado. S7 se mantiene: `pnpm test` verde y `tsc --noEmit` limpio.
L7. Pedido del usuario sobre las filas del carrito: «en cajero las card de producto en donde se pone mas o menos cantidad la quiero al lado del nombre del producto no abajo». La fila pasa a `grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_auto_1.5rem]`: índice, miniatura, nombre, stepper y eliminar en la línea 1; precio unitario a la izquierda y subtotal de línea a la derecha en la línea 2. Los productos por peso conservan sus seis botones de gramos en una línea propia debajo (no entran al lado del nombre en 440 px). Sin cambios de comportamiento: mismos `aria-label` y mismos handlers. Verificación: `pnpm test` 39/39 en los tres archivos de POS, `tsc --noEmit` limpio, `vite build` OK. `design/system.md` sincronizado con la regla «Cart row».
