# Handoff: Tratto — CRM + PM opinionated para B2B México

## Overview

Tratto es un CRM + PM **opinionated** para empresas B2B mexicanas que venden a instituciones (universidades, hospitales, gobierno). Todo en Tratto es un **board**: oportunidades, contactos, instituciones, catálogo, cotizaciones, pedidos.

Esta carpeta contiene el **rediseño completo** de la vista principal (Oportunidades) más la **vista de detalle de una oportunidad** ("expediente"), en una dirección de producto deliberadamente distinta al look Monday/Airtable genérico. El prototipo incluye 3 temas ejecutados en vivo (**Editorial**, **Taller**, **Noche**) — el theme recomendado de base es **Taller**.

## About the Design Files

Los archivos de esta carpeta son **referencias de diseño creadas en HTML + React (vía Babel in-browser)** — prototipos que muestran intención visual y comportamiento, **no código de producción para copiar directo**. La tarea es **recrear estos diseños en el entorno del codebase destino** (Next.js/React, Remix, etc.) usando sus patrones establecidos, design tokens y librería de componentes (shadcn, Radix, lo que ya tengan). Si no existe stack aún, recomiendo **Next.js 14 + TypeScript + Tailwind + Radix primitives + shadcn/ui** y usar este handoff como la base del design system.

El CSS de `styles.css` sirve como **referencia de tokens y comportamientos** (grids, spacings, motion). Los componentes JSX están escritos en React plano sin TypeScript ni build step.

## Fidelity

**High-fidelity (hifi).** Colores finales, tipografía final, spacing y grids finales, micro-interacciones definidas. El desarrollador debe recrear la UI **pixel-perfect** usando el framework destino, extrayendo los design tokens a la solución de tema de su codebase (CSS vars, Tailwind config, etc.).

---

## Tesis de diseño

1. **Opinionated, no genérico.** Tratto NO se parece a Monday. No columnas de colores saturados, no emoji, no pills pastel. Tipografía con carácter (Instrument Serif como display en tema Editorial/Noche, mono dominante en tema Taller). Bordes finos, mucho whitespace, mono para datos cuantitativos.
2. **Denso pero legible.** Las filas del board son compactas (altura ~44–48px) pero con jerarquía tipográfica clara. Responsable con avatar + nombre, montos en mono con alineación tabular, fechas en mono cortas ("23 abr").
3. **El board es el producto.** Header con 6 stats calculadas automáticamente, no "Relacionado con" ni metadata genérica. Cada stat tiene delta y sparkline.
4. **Expediente, no form.** La vista de detalle de una oportunidad no es un panel lateral con campos — es un **expediente** full-page con hero, pipeline stepper visual, tabs (Canales, Resumen, Sub-items, Cotizaciones, Actividad, Propiedades, Otras con {institución}) y un mini-sidebar persistente de canales/mensajería.
5. **Temas con personalidad.** Tres temas completos, no sólo light/dark:
   - **Editorial** — papel crema #F4EFE6, terracota #B8461E, Instrument Serif display. Premium, mexicano moderno, documento formal.
   - **Taller** *(por defecto)* — blanco roto #F7F6F3, verde pino #1F4D3F, mono-dominante. Herramienta de oficio, hecha a medida.
   - **Noche** — oscuro cálido #141210, naranja #E8815A. Para trabajo nocturno / campo, sin azul gélido.

---

## Screens / Views

### 1. Shell global (Sidebar + Main)

**Layout:** Sidebar fija izquierda 232px + main flex 1. En viewport < 1280px el sidebar colapsa a 60px rail.

**Sidebar contenidos** (top→bottom):
- **Logo "Tratto"** en display font, 22px, con pequeño indicador workspace debajo (ej "Acme Médica · MX").
- **Search global** con `⌘K` hint.
- **Nav principal** con íconos monocromos 16px + label 13px:
  - Oportunidades *(default activa, 19 abiertas)*
  - Instituciones (87)
  - Contactos (214)
  - Catálogo (156 productos)
  - Cotizaciones (42)
  - Pedidos (23)
  - Actividad
- Separador hairline
- **Boards guardados** (vistas del usuario): "Mis oportunidades", "Q2 cierre", "Por vencer", etc. Íconos pequeños de color por board.
- Footer: Configuración, avatar + nombre.

**Tokens:**
- `bg: var(--bg-2)`, `border-right: 1px solid var(--border)`
- Item activo: `background: var(--surface)`, `border-left: 2px solid var(--brand)`
- Hover: `background: var(--surface-2)`

### 2. Board de Oportunidades (vista principal)

Archivo de referencia: `board.jsx`, sección en `Tratto.html`.

**Layout:**
- **Top bar del board**: título "Oportunidades" (display 28px), botones "+ Nueva oportunidad" (primary), "Compartir", "Importar". Dropdown de **Vista** (Tabla / Kanban / Fichas) y **Tema** (Editorial / Taller / Noche).
- **Stats header** (reemplaza "Relacionado con"):
  - Grid de 6 columnas forzadas (grid-template-columns: repeat(6, minmax(0, 1fr))), gap 1px (como línea divisoria), bordes finos entre cells.
  - Cada stat: label uppercase 10.5px + valor mono 22px + delta (↑/↓ pct) + mini sparkline 60×16.
  - Stats: **Pipeline abierto** (MXN), **Cerrado este mes**, **Ticket promedio**, **Tasa de cierre** (%), **Vencen ≤14 días** (count), **En presentada** (count).
  - Fondo `var(--surface)`, border 1px `var(--border)`, radius `var(--radius-lg)`.
- **Filtros + buscador** en una barra hairline: chips activos ("Responsable: Ana", "Etapa: Presentada"), buscador ghost, toggle "Sólo mías", botón "Más filtros".
- **Tabla del board** (la vista Tabla):
  - Encabezado sticky con columnas: Nombre · Institución · Etapa · Monto · Responsable · Fecha · [expand chevron].
  - Filas compactas ~46px, hover levanta `var(--surface-2)`.
  - Click en **nombre** → abre expediente (OppDetail).
  - Click en **chevron** → expande fila in-place con tabs Catálogo/Cotizaciones.
  - Celda Etapa: dot de color + label. Colores por etapa en `--stage-*` tokens.
  - Celda Monto: mono, alineado a la derecha con números tabulares (`font-variant-numeric: tabular-nums`).
  - Celda Responsable: avatar 22px + nombre inline.
  - Celda Fecha: mono, formato "23 abr" en 12.5px.

**Variantes de vista:**
- **Kanban** (views.jsx) — 6 columnas por etapa, cards con nombre, institución (sigla), monto mono, avatar.
- **Fichas** — grid 3 columnas de cards más ricas con mini sparklines de actividad.

### 3. Expediente de Oportunidad (OppDetail)

Archivo de referencia: `opp-detail.jsx`, CSS en `styles.css` (buscar `.tr-detail-*`).

Se abre al hacer click en el nombre de una oportunidad en la tabla. **Full page overlay** sobre el shell (el sidebar global permanece visible).

**Layout (top→bottom):**

**A. Top bar**
- Izquierda: breadcrumb "← Oportunidades / #ab12cd" (id en mono dim).
- Derecha: "Copiar enlace", menú "···", botón primary "Abrir cotización".

**B. Hero**
- Grid 2 columnas: izquierda 1fr, derecha `auto`.
- **Izquierda**: chip de institución (sigla + nombre + tipo), `<h1>` con el nombre de la oportunidad (display 42px, line-height 1.1), meta-línea: etapa (dot + label), "Cierra 23 abr", "Creada 14 mar".
- **Derecha**: KPI card grande con MONTO (label uppercase 10.5px + valor mono 32px + sub "X partidas · IVA $Y").

**C. Pipeline stepper**
- 5 pasos: Nueva · Cotización · Presentada · Negociación · Cerrada.
- Cada paso: círculo 26px + label 11px. Línea conectora entre pasos.
- Estado: completado (fill brand), actual (ring brand, fill surface), pendiente (fill bg-2, ink-4).

**D. Body grid — 2 columnas: `56px 1fr`, gap 18px, position relative**

**Columna izquierda — mini-sidebar de canales** (persistente, siempre visible):
- Rail de 56px colapsado por default: sólo íconos de canales + avatar/dot. Badge de unread en esquina.
- Al hover → se expande a **240px en overlay absoluto** (no empuja el main). Fondo `var(--surface)`, shadow `var(--shadow-md)`, position absolute top 22px left 32px bottom 22px.
- Contenido expandido:
  - Header: ícono chat + "Mensajería" + badge total de unread.
  - Search "Buscar canales…".
  - Grupos: **Hilo principal** (conversación general de la oportunidad), **Por sub-item** (uno por producto del catálogo vinculado), **Externos** (canal con el contacto de la institución, canal con partners).
  - Cada item: icono 14px + nombre + dot de unread.
  - Footer: botón "Propiedades" (abre tab).

**Columna derecha — main con tabs:**
- Tabs (horizontal, sticky top): **Canales** *(default, con count + unread)* · **Resumen** · **Sub-items** · **Cotizaciones** · **Actividad** · **Propiedades** · **Otras con {sigla institución}**.
- Tab active: border-bottom 2px brand, color ink.
- Tab inactive: color ink-3, hover ink-2.
- Counts inline en tabs con estilo `<em class="tr-subtab-count">` (pill muy sutil, mono, 10.5px).

**Contenido de cada tab:**

1. **Canales** — lista de hilos activos (timeline estilo chat denso). Cada hilo muestra: avatar del último, mensaje snippet 2 líneas, timestamp, dot de unread. Click abre el hilo en una vista lateral derecha (400px).

2. **Resumen** — card grid 2 columnas:
   - **Siguiente acción** (cta prominente): "Enviar cotización revisada a Dra. Reyes", fecha, responsable, botón "Marcar completa".
   - **Contexto**: resumen de 2–3 líneas generado del hilo principal.
   - **Datos clave**: institución, contacto principal, monto, vence, probabilidad.
   - **Timeline compacto**: últimos 5 eventos relevantes.

3. **Sub-items** — tabla embedded (reutilizar estilo del board):
   - Columnas: Producto · SKU · Cantidad · Precio unitario · Subtotal · Status (cotizado / reservado / enviado).
   - Footer con suma total + IVA.
   - Botón "+ Añadir del catálogo".

4. **Cotizaciones** — lista de cotizaciones vinculadas (1–3 típicamente): id mono, fecha, monto, status (borrador / enviada / aceptada). Click abre `quote-editor.jsx`.

5. **Actividad** — feed vertical denso, timestamp relativos ("hace 2h"), iconografía por tipo (call, mail, meeting, nota, cambio de etapa).

6. **Propiedades** — grid 2 col de cards:
   - **Propiedades básicas**: Responsable, Etapa, Fecha límite, Monto, Cotización (link mono), Probabilidad.
   - **Institución**: nombre, tipo, dirección, RFC, teléfono.
   - **Contactos en esta institución**: lista con avatar, nombre, rol, email.
   - **Custom fields**: lo que el usuario haya añadido.

7. **Otras con {sigla}** — tabla compacta de otras oportunidades con la misma institución, para contexto histórico.

### 4. Editor de cotización (`quote-editor.jsx`)

Modal full-screen con:
- Header: logo de la empresa (placeholder), número de cotización mono, fecha, cliente.
- Tabla de partidas editable: SKU, descripción, cantidad, precio unitario, descuento, subtotal.
- Totales a la derecha: Subtotal, IVA (16%), Total.
- Acciones: "Guardar borrador", "Enviar al cliente", "Exportar PDF".

---

## Interactions & Behavior

- **Expandir fila en tabla**: click en chevron de la fila — anima `grid-template-rows` con `transition: 220ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Abrir expediente**: click en el nombre de la oportunidad en la tabla — transición 180ms cross-fade, el expediente reemplaza el body del main (sidebar global persiste).
- **Mini-sidebar canales hover-expand**: 180ms ease on width + box-shadow. Delay 50ms on enter para evitar flicker; sin delay en leave.
- **Theme switch**: al cambiar de tema se aplican CSS vars en `:root` con `applyTheme(themeKey)` — las transiciones de `background-color`, `border-color`, `color` tienen `transition: 240ms ease` global.
- **Hover en filas del board**: `background: var(--surface-2)` + `transform: translateX(1px)` sutil (opcional).
- **Tabs del expediente**: click cambia tab con fade 120ms en el contenido.
- **Pipeline stepper**: no-interactivo en este prototipo (show-only). En producción podría ser clickable para cambiar etapa con confirmación.

---

## State Management

Para producción, el mínimo viable es:
- `currentView` — tabla / kanban / fichas.
- `theme` — editorial / taller / noche (persistir en localStorage + user profile).
- `filters` — responsable, etapa, fecha range, texto libre.
- `expandedRowId` — id de fila expandida en tabla.
- `activeOppId` — id de oportunidad con expediente abierto (`null` si ninguno).
- `detailTab` — tab activa del expediente (canales / resumen / etc).
- `detailAsideOpen` — bool del mini-sidebar de canales.
- `activeChannelId` — hilo abierto dentro del tab canales.

**Data fetching:** el board debe poder cargar 200–1000 oportunidades sin lag (virtualización con `@tanstack/react-virtual` o similar). Las stats del header se calculan server-side o con una agregación en el cliente. El expediente carga on-demand (el ID viene de la URL: `/oportunidades/:id`).

---

## Design Tokens

Los 3 temas comparten la misma estructura de tokens. Abajo los de **Taller** (default); para Editorial y Noche ver `themes.jsx`.

### Colores (tema Taller)

```
--bg:         #F7F6F3   /* fondo global */
--bg-2:       #EFEDE8   /* sidebar, stats container */
--surface:    #FFFFFF   /* cards, filas */
--surface-2:  #FAF9F6   /* hover */
--border:     #E4E1DB   /* borders hairline */
--border-2:   #CFCAC0   /* borders más marcados */

--ink:        #161513   /* texto primario */
--ink-2:      #3D3A35   /* texto secundario */
--ink-3:      #6B665E   /* texto terciario */
--ink-4:      #9A958C   /* texto dim / placeholders */

--brand:      #1F4D3F   /* verde pino, accent primario */
--brand-ink:  #F7F6F3   /* texto sobre brand */
--brand-soft: #C8D8D0   /* brand alpha-ish soft */
--brand-deep: #0E2A22   /* brand hover */

/* Stage colors (etapas) */
--stage-new:   #6B7280
--stage-quote: #B45309
--stage-sent:  #166534
--stage-neg:   #854D0E
--stage-won:   #14532D
--stage-lost:  #991B1B
```

### Typography

```
--font-display: "Instrument Serif", "Source Serif Pro", Georgia, serif   (Editorial/Noche)
                "Geist Mono", "JetBrains Mono", ui-monospace, monospace  (Taller)
--font-ui:      "Geist", "Inter", -apple-system, sans-serif
--font-mono:    "Geist Mono", "JetBrains Mono", ui-monospace, monospace
```

Escala:
- Display H1 (hero expediente): 42px / line 1.1 / weight 400 (serif) o 500 (mono)
- Display H2 (titulo board): 28px / line 1.2 / weight 500
- Body: 13.5px / line 1.45 / weight 400
- Meta / dim: 12.5px / weight 400
- Label uppercase: 10.5px / letter-spacing 0.06em / weight 500
- KPI value: 22–32px mono / weight 500 / tabular-nums
- Tabla celda: 13px / weight 400
- Badges / counts: 10.5px mono

### Radios

```
--radius:    2px    (Taller: casi sin radio) / 6px (Editorial/Noche)
--radius-lg: 4px    (Taller) / 10px (Editorial/Noche)
```

### Shadows

```
--shadow-sm: 0 0 0 1px rgba(22,21,19,0.04)                              (Taller: hairline en vez de blur)
--shadow-md: 0 1px 3px rgba(22,21,19,0.06), 0 0 0 1px rgba(22,21,19,0.04)
--shadow-lg: 0 12px 28px rgba(22,21,19,0.10), 0 2px 6px rgba(22,21,19,0.04)
```

### Spacing

Escala múltiplo de 2: `2, 4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 32, 48`. En CSS usado directo en px.

---

## Assets

- **Fuentes**: se cargan vía Google Fonts / Vercel Fonts en producción:
  - [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) — SIL OFL
  - [Geist + Geist Mono](https://vercel.com/font) — SIL OFL
  - [Inter](https://fonts.google.com/specimen/Inter) — SIL OFL (fallback)
- **Íconos**: set monocromo custom en `icons.jsx` — stroke 1.5px, size 16px default. Son SVGs inline sin dependencia. En producción sugiero migrar a **Lucide** o **Phosphor** (regular weight) que matchean el estilo hairline.
- **Logos de institución**: placeholders — en producción usar letras/siglas 2–3 chars sobre fondo `--bg-2` con border, cuadrado 32–40px, radius `--radius`.
- **Avatares**: placeholders con iniciales — usar servicio de avatars o subir fotos; fallback iniciales sobre color derivado del id.

Ninguna imagen raster se incluye — todo es tipo, SVG, o placeholder.

---

## Files

Estructura de la carpeta:

```
design_handoff_tratto_crm/
├── README.md            ← este archivo
├── Tratto.html          ← entry point; monta el app React
├── styles.css           ← ~30KB. Todos los estilos: shell, board, stats, expediente, editor
├── themes.jsx           ← definición de los 3 temas (Editorial / Taller / Noche) + applyTheme()
├── shell.jsx            ← Sidebar, BoardHeader con stats, top nav
├── board.jsx            ← Tabla del board de oportunidades, filas expandibles
├── views.jsx            ← Vistas alternativas: Kanban, Fichas
├── opp-detail.jsx       ← Expediente de oportunidad (hero, pipeline, tabs, mini-sidebar canales)
├── quote-editor.jsx     ← Modal full-screen editor de cotizaciones
├── data.jsx             ← Mock data: oportunidades, instituciones, contactos, productos, responsables
└── icons.jsx            ← Ic.* set de íconos SVG inline
```

### Orden recomendado de lectura para el desarrollador

1. **`Tratto.html`** — ver cómo se monta el app y qué scripts cargan.
2. **`themes.jsx`** — entender los 3 temas y los tokens que cambian.
3. **`styles.css`** — skim de selectores clave: `.tr-app`, `.tr-side`, `.tr-board-*`, `.tr-stat-*`, `.tr-row`, `.tr-detail-*`.
4. **`shell.jsx`** → `board.jsx` → `opp-detail.jsx` (los 3 componentes más importantes).
5. **`data.jsx`** — forma de los datos, para saber qué types/interfaces crear.
6. **`icons.jsx`**, **`views.jsx`**, **`quote-editor.jsx`** — últimos.

### Cómo correr el prototipo localmente

Abrir `Tratto.html` directamente en el navegador (necesita conexión a internet para CDN de React/Babel). No hay build step.

---

## Recomendaciones para la implementación

1. **Stack sugerido**: Next.js 14 (app router) + TypeScript + Tailwind + shadcn/ui + Radix primitives. Tokens como CSS vars en `globals.css` + extender `tailwind.config.ts` para usarlos como utilidades (`bg-surface`, `text-ink-2`, etc.).
2. **Temas**: implementar como `data-theme="taller"` en `<html>` con CSS vars que cambian — el switch ya está demostrado en `applyTheme()`.
3. **Fuentes**: cargar con `next/font` (self-hosted) para evitar layout shift. Las 3 familias son SIL OFL, libres.
4. **Tabla del board**: `@tanstack/react-table` + `@tanstack/react-virtual` para manejar 1k+ filas.
5. **Expediente como ruta**: `/oportunidades/[id]` con layout compartido (sidebar global en layout parent).
6. **Mensajería real-time**: la UI está lista pero el backend queda a discreción — Supabase Realtime, Liveblocks, o Pusher son buenas opciones.
7. **Accesibilidad**: todos los íconos llevan `aria-label` o están decorativos junto a texto. Los botones icon-only del mini-sidebar necesitan `aria-label` explícito (ya presentes en hover-expand).

---

## Preguntas abiertas / no resuelto en el prototipo

- **Permisos y roles**: el prototipo asume un solo usuario. En producción: owner / editor / viewer por board.
- **Importación de datos**: botón "Importar" en la top bar está pero el flujo no está diseñado. Recomendación: CSV upload + mapeo de columnas, con templates para "Oportunidades", "Contactos", "Instituciones".
- **Comentarios @mentions**: el tab Canales asume chat por hilo, pero falta el detalle del hilo en sí (composer, @mention picker, reacciones). Diseñar en iteración siguiente.
- **Notificaciones**: no hay inbox global. Sugerencia: icono campana en top bar del shell con un panel tipo dropdown.
- **Mobile**: el prototipo es desktop-first. El layout del board necesitará collapsar columnas y usar cards en mobile; el expediente ya es casi responsive pero requiere ajustes.
