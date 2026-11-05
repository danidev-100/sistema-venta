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

## Tasks

- T1 · Tokens: `src/styles.css` (light + dark) y `tailwind.config.js` a la paleta de Bloques; `design/system.md` actualizado. `S3 S4 S5` — commit `1227ecf`.
- T2 · Shell: navegación lateral de 248 px con marca y topbar con título + theme toggle en `src/App.tsx`. `S2 S3` — commit `ffd224c`.
- T3 · POS: `src/pages/POSPage.tsx` + `src/components/CartPanel.tsx` con grilla de tarjetas y panel de venta de 396 px. `S2 S3 S7` — commit `a253460`.
- T4 · Verificación: `pnpm test` (32 archivos verdes) + `pnpm build` (exit 0, 1046 módulos) + `tsc --noEmit` limpio. `S6 S7` — commit `a253460`.

## Log

L1. Pedido original del usuario: «03 Bloques este me gusto».
L2. Decisiones de alcance, textuales del usuario: «POS + shell de la app» y «Adoptar la identidad de Bloques».
L3. El canvas de Gentle Design no renderiza en el visor del usuario (canvas.js usa sintaxis ES2020 que su motor no parsea); se agregó `design/sistema/index.html` como vista estática de respaldo. No afecta la implementación.
L4. Desviación deliberada en T3: la fila de medios de pago del panel de venta **no** se implementa. Replicar «Efectivo / Tarjeta / Mixto» fuera de `CheckoutModal` rompe dos tests de contrato (`keyboard-shortcuts.test.tsx` exige que «Efectivo» no exista con el modal cerrado; `mixed-payment.test.tsx` exige una sola coincidencia al abrirlo) y sería un control sin función. El medio de pago se elige en `CheckoutModal`, que es donde efectivamente opera.
