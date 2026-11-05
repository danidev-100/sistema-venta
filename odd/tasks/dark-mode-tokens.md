# Dark mode tokens — contraste AA y limpieza de grises fijos

Cerrar los defectos que quedaron abiertos del pase de revisión de `bloques-ui`: rellenos saturados con texto blanco que no pasan AA en modo oscuro, y las clases `dark:gray-*` hardcodeadas que esquivan los tokens y dejan el modo oscuro fuera de la identidad Bloques.
Rama: `feature/bloques-ui`. Referencia de tokens: `design/system.md` + `design/sistema/03-bloques.html`.

## Specs

S1. Instrucción del usuario, textual: «arreglar todo» — sobre la lista de pendientes del cierre anterior, que incluía: «**Modo oscuro**: `text-white` sobre relleno `bg-pos-success` da 2.28:1. Es **preexistente** y toca 8 archivos fuera del alcance actual».

S2. Todo par texto/fondo del sistema de tokens debe alcanzar 4.5:1 (AA para texto pequeño) en **ambos** temas, incluyendo los rellenos saturados con texto encima. Pares a corregir medidos hoy: `text-white` sobre `bg-pos-success` en oscuro = 2.28:1.

S3. El modo oscuro debe tomar los tokens: ninguna clase de neutro fijo (`dark:gray-*`, `dark:bg-gray-*`, `dark:text-slate-*`, negros/blancos literales usados como superficie o texto) puede quedar en componentes que ya deberían seguir la paleta de Bloques.

S4. `design/system.md` sigue siendo la única fuente de verdad y se actualiza en la misma unidad de trabajo que `src/styles.css`.

S5. Los tests existentes son contrato: `pnpm test` (417 tests, 32 archivos) y `pnpm build` deben pasar. No se borra ni debilita ningún test.

S6. El modo claro no cambia de aspecto: la identidad Bloques aprobada se mantiene.

## Tasks

- T1 · `--color-pos-on-solid` (blanco en claro, tinta oscura en oscuro) + reemplazo de `text-white` sobre rellenos `pos-success`/`pos-secondary`/`pos-accent`/`pos-danger`. `S1 S2 S4` — `943ac0e` (tokens) y `b958f66` (107 sitios en 46 archivos)
- T2 · Auditoría AA de todos los pares de tokens en ambos temas y corrección de los que fallen. `S2` — `943ac0e`
- T3 · Barrido de neutros fijos `dark:*` a tokens. `S3` — `b958f66` (136 neutros en 12 archivos) + `b50bc13` (tooltip y MercadoPago)
- T4 · Verificación: `pnpm test`, `pnpm build` y barrido visual claro/oscuro (POS, Caja, Productos, Dashboard, modales) con medición de contraste. `S5 S6` — 417/417 tests, build exit 0, matriz AA sin fallas, capturas de POS y Productos en ambos temas
- T5 · Commits por unidad de trabajo en `feature/bloques-ui`. `S5` — `1c1c353` `943ac0e` `b50bc13` `57fc770` `b958f66`

## Log

L1. Mensaje del usuario: el cierre del pase de revisión pegado completo (los cuatro hallazgos: drift de base local con 31 ventas escondidas; desborde de filas del carrito con ✕ en x=1476 sobre viewport 1440; `pos-success` a 3.30:1 y su corrección a 24 124 60; hint de escaneo a ~2:1) y la instrucción final: «arreglar todo».
L2. Alcance derivado de L1: se arreglan los defectos reportados, incluido el pendiente de modo oscuro que el propio cierre marcaba como fuera de alcance. El rediseño de las pantallas restantes (Productos, Pedidos, Estadísticas, Caja, Login) **no** forma parte de esto: «arreglar» es corregir defecto, no rediseñar.
L3. Auditoría AA del sistema de tokens (T2), 51 pares medidos en claro y oscuro, 0 fallas al cierre:
- Nuevo token `--color-pos-on-solid` (blanco en claro, tinta `17 20 28` en oscuro) para texto sobre rellenos saturados. Sustituye `text-white`, que en oscuro daba 2.28:1 sobre `success`, 3.32:1 sobre `secondary`/`accent`, 3.67:1 sobre `danger` y 1.67:1 sobre `warn`.
- `--color-pos-accent-2` en claro `120 118 232` → `106 104 218`: el extremo claro del gradiente del CTA daba 3.78:1 con blanco encima; ahora 4.56:1 y el índigo aprobado (`accent`, `secondary`) no se toca.
- `--color-pos-danger` claro `225 29 72` → `190 18 60` (texto sobre fondo 4.35:1 → 5.82:1; tinte `/10` 4.00:1 → 5.29:1) y oscuro `244 63 94` → `251 113 133` (tinte `/10` 4.21:1 → 5.47:1).
- `--color-pos-warn` claro `245 158 11` → `146 64 14`: el ámbar como texto daba 1.99:1 sobre el fondo. No hay ningún relleno `bg-pos-warn` en la app, así que oscurecerlo no rompe ninguna insignia (verificado con grep antes de cambiarlo).
- `--color-pos-success` queda en `24 124 60` (ya corregido en el pase anterior).
L4. Sustitución de `text-white` por `text-pos-on-solid`: 107 sitios en 46 archivos de `src/components` y `src/pages`, sólo donde el texto cae sobre un relleno saturado (`secondary`, `accent`, `accent-2`, `success`, `danger`, `primary`, `text`) o sobre el gradiente `from-pos-accent`. Build exit 0 y diff equilibrado 107/107, sin otros cambios de clase. Se dejaron intactos `text-white/70` y `text-white/80` (scrim de cámara y overlay de foto), el knob de `ThemeToggle` y `dark:text-white` de textos sobre superficie (esos van en T3).
L5. Dos defectos concretos que encontró el survey y se corrigieron de paso:
- `ExpensesPage.tsx` usaba `var(--color-surface, #1f2937)` — una variable que no existe — como fondo del tooltip del gráfico. Ahora usa `var(--color-chart-tooltip-bg)` / `--color-chart-tooltip-border`, igual que los otros cuatro gráficos.
- `CheckoutModal.tsx` usaba `bg-[#e5f6ff]` (superficie sólo-clara) en el indicador de Mercado Pago, y `text-[#00a1e0]` como texto, que da 2.93:1 sobre blanco. Ahora el fondo es `bg-[#00a1e0]/10` (tinte de marca, funciona en ambos temas) y el texto usa `text-[#0071a3]` en claro (5.40:1) con `dark:text-[#67c8ef]` (8.85:1 en oscuro). El logo `#00a1e0` se mantiene porque es decorativo.
