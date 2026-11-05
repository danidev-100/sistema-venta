# Design system — Sistema de Ventas

Synced from project sources on 2026-11-04. Only values found in the sources below are recorded here.
Sources read: `src/styles.css` (CSS custom properties, light + dark), `tailwind.config.js` (color mapping, radius scale, font families).
The palette and radius scale now follow the **Bloques** model, taken from `design/sistema/03-bloques.html` (model 03)
and implemented in `src/styles.css` + `tailwind.config.js`.

The system is dual-theme via a `.dark` class on the root (Tailwind `darkMode: "class"`).
Every color token is stored as RGB channel triplets and consumed as `rgb(var(--token) / <alpha>)`,
mapped to Tailwind utilities `pos-<name>`.

## Colors

| Token | Value (light) | Value (dark) | Usage | Source |
| --- | --- | --- | --- | --- |
| `--color-pos-primary` | `20 22 31` | `236 238 243` | Ink: primary text and active chip/segment background | `src/styles.css` |
| `--color-pos-secondary` | `91 91 214` | `129 129 240` | Primary action (indigo), active states, links | `src/styles.css` |
| `--color-pos-accent` | `91 91 214` | `129 129 240` | Gradient start of the single CTA | `src/styles.css` |
| `--color-pos-accent-2` | `120 118 232` | `150 148 246` | Gradient end of the single CTA | `src/styles.css` |
| `--color-pos-danger` | `225 29 72` | `244 63 94` | Delete, cancellation, negative amounts | `src/styles.css` |
| `--color-pos-success` | `22 163 74` | `34 197 94` | Payment success, scan flash, stock OK | `src/styles.css` |
| `--color-pos-warn` | `245 158 11` | `251 191 36` | Low stock, last units, attention states | `src/styles.css` |
| `--color-pos-background` | `245 246 250` | `17 20 28` | Page background | `src/styles.css` |
| `--color-pos-surface` | `255 255 255` | `24 28 37` | Cards, panels, input backgrounds | `src/styles.css` |
| `--color-pos-text` | `20 22 31` | `236 238 243` | Primary text | `src/styles.css` |
| `--color-pos-muted` | `107 113 131` | `148 155 171` | Secondary text, borders at low alpha, icons | `src/styles.css` |
| `--color-pos-ring` | `91 91 214` | `129 129 240` | Focus ring (`ring-pos-ring`) | `src/styles.css` |
| `--color-chart-grid` | `#e8eaf0` | `#2a2f3a` | Chart gridlines | `src/styles.css` |
| `--color-chart-axis` | `#6b7183` | `#949bab` | Chart axis labels | `src/styles.css` |
| `--color-chart-tooltip-bg` | `#ffffff` | `#181c25` | Chart tooltip background | `src/styles.css` |
| `--color-chart-tooltip-border` | `#e8eaf0` | `#2a2f3a` | Chart tooltip border | `src/styles.css` |
| `--color-chart-bar` | `#5b5bd6` | `#8181f0` | Chart bar/line series | `src/styles.css` |

Borders are drawn as `pos-muted` at reduced alpha (observed in components: `/20`, `/30`).
Dark-mode text and status tokens hold WCAG AA contrast against `17 20 28`.

## Typography

| Role | Family | Declared stack | Usage | Source |
| --- | --- | --- | --- | --- |
| Sans / Display | DM Sans | `DM Sans, system-ui, sans-serif` | All UI copy, headings, labels | `tailwind.config.js` |
| Mono | JetBrains Mono | `JetBrains Mono, monospace` | Prices, quantities, IDs — always `tabular-nums`, right-aligned via `.num` | `tailwind.config.js`, `src/styles.css` |

Notes from sources:
- `.font-mono` forces `font-variant-numeric: tabular-nums`.
- `.num` = mono + right align + tabular digits; use it for every price/cost/total field.

Observed sizes (from component classes, not a formal scale): headings `text-lg`/`text-base`/`text-sm`,
body `text-sm`, micro labels `text-xs`, monetary totals `text-2xl`/`text-xl`, display numbers `text-3xl`.

## Spacing and radius

| Item | Value | Usage | Source |
| --- | --- | --- | --- |
| Panel padding | `p-4` / `px-4 py-3` | Card and toolbar interiors | components |
| Panel gap | `gap-2`, `gap-3`, `gap-4` (`3`/`4` on `lg`) | Stacked panels and toolbars | components |
| Control radius | `12px` (`rounded-control`) | Inputs, buttons, chips | `tailwind.config.js` |
| Card radius | `18px` (`rounded-card`) | Product and summary cards | `tailwind.config.js` |
| Panel radius | `20px` (`rounded-panel`) | Sale panel, modals and dialogs | `tailwind.config.js` |
| Pill radius | `999px` (`rounded-pill`) | Filters, search field, topbar search | `tailwind.config.js` |
| Icon-only control | `w-12 h-12` | Square touch controls | `POSPage.tsx` |
| Touch target | `min-height: 44px; min-width: 44px` (`.touch-target`) | Every interactive control in POS mode | `src/styles.css` |

## Shadows

| Item | Value | Usage | Source |
| --- | --- | --- | --- |
| Modal | `shadow-2xl` | Checkout and quantity dialogs | components |

No other custom shadow tokens exist in the sources.

## Component rules

- **Buttons**: `rounded-control`, `text-sm font-medium`, `touch-target`. Primary (single CTA per view) = `bg-pos-secondary text-white`, or the indigo gradient `bg-gradient-to-r from-pos-accent to-pos-accent-2`; secondary = `border border-pos-muted/30 text-pos-text hover:bg-pos-background`; destructive = `bg-pos-danger text-white`; disabled = `opacity-40`.
- **Inputs**: `bg-pos-surface border border-pos-muted/20 rounded-control px-4 py-3.5 text-sm`; focus = `ring-2 ring-pos-ring`; in dark mode inputs take `bg-pos-background` and `text-pos-text` (`src/styles.css`).
- **Modals**: fixed overlay `bg-black/40`, panel `bg-pos-surface rounded-panel shadow-2xl max-w-sm p-6`; numeric entry uses a `w-32 text-2xl font-bold font-mono` field.
- **Cards**: `bg-pos-surface`, `rounded-card`, `border border-pos-muted/20`; entrance animation `.card-enter` (8px rise + 0.98 scale, 0.35s, staggered 0.04s) — must respect `prefers-reduced-motion`.
- **Filters and search**: `rounded-pill`; the active chip flips to `bg-pos-primary text-white` (ink), inactive stays on `bg-pos-surface` with `text-pos-muted`.
- **Sale panel**: `rounded-panel`, 396px wide, `bg-pos-surface` with a soft shadow; totals read primary text on surface, muted labels for subtotal and discount.
- **Status copy**: OK = `text-pos-success`, last units = `text-pos-warn`, destructive/negative = `text-pos-danger`.
- **Scan feedback**: `.scan-flash` green pulse (0.5s) confirms a barcode add.
- **POS mode**: `.no-select` on chrome; never text-selectable UI.
- **Motion budget**: `0.15s` shell theme transitions, `0.35s` card entrance, `0.5s` scan flash. Nothing longer.

## Artboard constraints

- No external URLs, CDNs, remote fonts, images, or scripts → DM Sans and JetBrains Mono degrade to `system-ui` / `ui-monospace`.
- WCAG AA contrast, visible focus styles, semantic landmarks.
