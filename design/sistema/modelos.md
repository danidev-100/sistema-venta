# Tres modelos de sistema

Cada modelo es una propuesta completa: shell + identidad + pantalla de Punto de Venta.
Los tres muestran **el mismo carrito y los mismos totales** (subtotal $ 22.770,00 · descuento 5% $ −1.138,50 · total $ 21.631,50) para que se comparen de igual a igual.

> **Desvío deliberado de `design/system.md`**: estas propuestas son *candidatas a reemplazar* el sistema actual, así que cada una define su propia paleta, tipografía y escala de radios. Las piezas de `design/pos/` sí respetan los tokens vigentes. Elegí un modelo antes de tocar `src/styles.css` y `tailwind.config.js`.

## 01 · Mostrador — editorial y cálido

| Decisión | Valor |
| --- | --- |
| Fondo / superficie | `250 247 242` papel · `255 253 250` tarjeta |
| Tinta / secundario | `31 27 22` · `122 110 96` |
| Acento | `181 83 58` terracota (acción primaria, activo, foco) |
| Positivo | `79 107 74` oliva (descuento, vuelto) |
| Tipografía | display `ui-serif, Georgia` · cuerpo `system-ui` · números `ui-monospace` |
| Radios | 3 px (casi recto) |
| Densidad | fila de catálogo ≈ 56 px |
| Shell | riel lateral de 224 px con etiquetas de texto, sin iconos |
| Estructura POS | catálogo como **lista con hairlines** + ticket vertical de 384 px |

Tesis: el POS es una libreta de mostrador. Nada de tarjetas; las líneas separadoras y la serif para los importes hacen el trabajo de jerarquía.

## 02 · Terminal — oscuro y de alta densidad

| Decisión | Valor |
| --- | --- |
| Fondo / panel | `13 15 18` · `20 23 27` (panel 2: `26 30 35`) |
| Texto / secundario | `232 234 237` · `134 141 150` |
| Acento | `200 244 92` lima (activo, foco, cobrar) |
| Alertas | `245 185 66` stock bajo · `255 107 107` destructivo |
| Tipografía | `ui-monospace` dominante; `system-ui` solo en nombres de producto |
| Radios | 2 px |
| Densidad | fila de catálogo 30 px, barra superior 38 px, barra de estado 32 px |
| Shell | tabs superiores + barra de estado con atajos y contadores |
| Estructura POS | catálogo como **tabla con índice numérico** + columna de venta y medios de pago |

Tesis: el POS es una terminal. Todo el chrome está en monoespaciada, los atajos son visibles y la barra de estado nunca deja de mostrar items y total.

## 03 · Bloques — SaaS claro y espacioso

| Decisión | Valor |
| --- | --- |
| Fondo / superficie | `245 246 250` · `255 255 255` |
| Tinta / secundario | `20 22 31` · `107 113 131` |
| Acento | `91 91 214` índigo (gradiente a `120 118 232` en el CTA) |
| Estados | `22 163 74` ok · `245 158 11` últimas · `225 29 72` destructivo |
| Tipografía | `system-ui`, títulos 24 px/650 con tracking negativo, números `ui-monospace` |
| Radios | 12 px (controles) · 18 px (tarjetas) · 20 px (panel de venta) · pill (filtros) |
| Densidad | tarjeta de producto 132 px, panel de venta 396 px |
| Shell | sidebar de 248 px con workspace switcher + topbar con búsqueda pill |
| Estructura POS | grilla de tarjetas 3 columnas + panel de venta flotante con sombra |

Tesis: el POS es un producto SaaS. Espacio en blanco generoso, radios grandes y una única CTA con gradiente; el estado de caja vive en la topbar.

## Cómo elegir

- **Cajero con mouse, mostrador físico con poca luz** → 01 (contraste suave, filas grandes).
- **Cajero experto, teclado, muchas líneas por minuto** → 02 (densidad y atajos).
- **Mostrador con tablet, personal rotativo, demo comercial** → 03 (objetivos grandes, lectura inmediata).

No mezclar: cada modelo asume su propio sistema completo. Tomar la estructura de uno y los colores de otro rompe las decisiones de densidad que sostienen cada propuesta.
