# log

## 2026-04-14

**~sesión 29**
- Diseño completo Fases 16-19: herencia de permisos, quote engine, AI agent sidebar, WhatsApp
- Fase 16 (nueva): column permission inheritance + row-level restrict_to_own audit en sub-items/snapshot/RelationCell
- Fase 17 Quote Engine: board `quotes` como sistema, snapshot sub-items, folio B2G, IVA 16%, vigencia, firma → regenera PDF
- Fase 18 Tratto AI Agent: engine compartido sidebar+WA+móvil, 8 tools, security 6 capas, rol-aware filtering
- `/start` actualizado: regla drástica de usar Haiku para todo código

**~sesión 28**
- Stage gates rediseñados: gates viven en columna Etapa (`settings.stage_gates`), checklist de validaciones por etapa expandido; botón solo necesita `target_stage_id`
- `ColumnSettingsPanel` columna Botón: config completa (label, acción radio, stage destino, confirmación)
- Fix `AddColumnButton` + `AddColumnInline`: popover se alinea al borde derecho, `<select>` nativo reemplazado por lista de botones portal, `z-20` en wrapper sub-items para no conflictar con resize handles
- Fix `isStageCol` matchea `col_key==='stage'`; `GET /api/stages` usa serviceClient (RLS bloqueaba silenciosamente)
- Plan.md actualizado con tareas 15.B completas

**~sesión 27**
- Fase 15 completa: validaciones por columna, IF formula UI, valores por defecto, botón change_stage con gate
- Fix `conditionMatches`: null/undefined ya no pasa operadores `>` / `<` (String(null)>"0" era true lexicográfico)
- Fix NativeRow en SubItemsView: formulaCols y rollupCols ahora muestran overlay rojo ❌ cuando validación falla

**~sesión 26**
- Fix `ColumnSettingsPanel` input inutilizable: `stopPropagation` en drawer evita que el click burbujee al contenedor de la tabla y robe el foco
- Fix `SelectCell` en sub-items: reemplazado `<select>` nativo por `SelectCell` custom con `stopPropagation`; hit area corregido a `w-full`; `opt.value` → `opt.label` en display
- Fix rollup `%` no calculaba: items route ahora lee opciones `is_closed` actuales de la columna fuente (no los `closed_values` guardados estáticamente); leyenda del candado agregada en panel de opciones
- Fix board se borraba al cambiar agregado de rollup: `saveRollupUp` hace PATCH en columna existente (no siempre POST); removido guard `rawCols.length === 0` en `rows` memo de BoardView
- Eliminar columnas: `ColumnSettingsPanel` con prop `onDeleted` + footer "Eliminar columna" con confirmación inline; stale `columnSizing` limpiado en `GenericDataTable` al cambiar columnas (error "Column does not exist")

**~sesión 25**
- Fix RLS en `POST /api/sub-items`: snapshot no copiaba valores del catálogo — mismo patrón `createClient()` silenciando `sub_item_columns`; cambiado a `createServiceClient()` en todas las queries post-ownership-check
- `SubItemDetailDrawer` upgrade: nombre grande editable + badge de estado (primer select col) + info panel con ⋯ por campo → `ColumnSettingsPanel` con `patchEndpoint=/api/sub-item-columns/[id]`
- `ItemDetailView` info panel: ⋯ al hover en cada campo → `ColumnSettingsPanel` con tab Permisos completo
- Column permissions parity (14.C): `column_permissions` polimórfico (nullable `column_id` + `sub_item_column_id` FK), 2 rutas nuevas, `permissionsEndpoint` prop en `ColumnSettingsPanel`; migration aplicada en remoto
- Items y sub-items comparten 100% las features de columna: rename, tipo, opciones, fórmula, rollup, permisos view/edit por usuario/equipo

**~sesión 24**
- Fix RLS silencioso: `nativeHandler` usaba `createClient()` (JWT) → `sub_item_columns` retornaba 0 filas; cambiado a `createServiceClient()` tras validar workspace_id con `requireAuthApi()`
- Aislamiento de columnas por vista: migration `20260414000008` agrega `view_id FK sub_item_views` en `sub_item_columns`; filtrado por `view_id` en nativeHandler, POST y AddColumnInline/SourceColumnMapper
- Protección vista default: botón eliminar deshabilitado para la primera vista (Sub-items) en `SubItemsView`
- ⋯ en headers de sub-item-columns: abre `ColumnSettingsPanel` con `patchEndpoint=/api/sub-item-columns/[colId]`; layout corregido: texto `flex-1 truncate min-w-0` izquierda, dots `shrink-0` derecha, resize handle `absolute right-0`
- `ColumnSettingsPanel` extendido con prop `patchEndpoint` opcional; tab Permisos se oculta automáticamente

**~sesión 23**
- Fase 13 completa: formula engine, FormulaCell, ColumnSettingsPanel tab, BoardView pre-compute, resize handles en todas las columnas, width persistence localStorage, revalidateTag fix, realtime para board_columns/stages
- Fix: formula column picker vacío — fetch interno en ColumnSettingsPanel fallaba silenciosamente por RLS; reemplazado con `allColumns` prop desde BoardView (ya en estado, cero fetch extra)
- Idea documentada en plan.md Fase 15: column-level gate conditions (condición vive en la columna, el gate la agrega automáticamente) vs el diseño actual (condiciones en la etapa); decisión pendiente antes de implementar

**~sesión 22**
- Fix: L2 sub-items no renderizaban — query en `sub-item-views/[viewId]/data` ordenaba solo por `position`; L2 con position < L1 padre llegaba primero al tree-builder y se descartaba; fix: `.order('depth').order('position')`
- Fix: columnas ocultas en vistas volvían al refresh — `getBoardViews` usaba `unstable_cache(60s)`; al persistir en DB el estado tardaba hasta 1 min en reflejarse; fix: convertido a función directa sin cache
- Plan: Fases 13 (Formula Columns) y 14 (Rollup Columns) insertadas antes de Stage Gates; fases anteriores renumeradas 15–18

**~sesión 21**
- plan.md actualizado: Fase 12 completa con 15 tareas marcadas [x], decisiones clave, verificaciones y archivos

**~sesión 20**
- Fix: `POST /api/boards/[id]/sub-item-columns` 404 — `createClient()` con RLS bloqueaba lookup del board; cambiado a `createServiceClient()` en route sub-item-columns + boards/[id] PATCH/DELETE
- Fix: columnas guardadas (201) pero UI no refrescaba — `columnsVersion` counter en BoardView → key de NativeRenderer cambia → re-fetch automático; `setSubItemColumns` acumula en vez de reemplazar
- Fase 12 completa: variantes L2 (expand cartesiano), import-children (↓), refresh (⟳ bloqueado si is_closed), SubItemDetailDrawer, source navigation (↗ link al catálogo)
- Estado column migration: select con is_closed en Terminado/Entregado; boards.settings con status_sub_col_key; ColumnSettingsPanel con lock toggle por opción
- is_closed rename-safe: reemplaza closed_sub_values[] en boards.settings; source_item_sid + source_board_sid batch-resueltos en data endpoint

## 2026-04-13

**~sesión 19**
- Sub-item views system completo: migration 009 (`sub_item_views` con type/config/workspace_id/generate_sid), 3 API routes (GET+POST boards/[id]/sub-item-views, PATCH+DELETE /[viewId], data endpoint con 3 handlers paralelos)
- `SubItemViewWizard`: modal 2 pasos, 4 presets (Catálogo/Archivos/Cotizaciones/Manual), Snapshot vs Referencia; se abre desde botón "Sub-items" en BoardView toolbar
- `SubItemsView` reescrito: tab strip (>1 view), NativeRenderer + BoardItemsRenderer + BoardSubItemsRenderer, prop `onCountChange`+`compact`
- InlineSubItems reemplazado por SubItemsView en BoardView inline expansion (con `views={subItemViews}`) → view switching disponible inline
- Fixes: migration usaba `tratto_sid_seq` (borrada en 003) → cambiado a `generate_sid()`; board not found → service client bypasea RLS; crash key prop → guard `res.ok` en submitAdd

**~sesión 18**
- Fase 11 completa: FileCell (upload + preview por tipo: img/PDF/video/fallback), ButtonCell (`change_stage`), SignatureCell (inmutable, OTP-linked)
- Fix: `board_columns_kind_check` no incluía `button`/`signature` → migration 008 añade ambos kinds
- FileCell chips rediseñados: solo emoji-icono (28px), tooltip con nombre, × badge flotante, overflow-hidden garantizado
- SignatureCell mejorada: muestra hora en badge, label de columna en modal, `settings.description` configurable desde ColumnSettingsPanel
- Arquitectura confirmada: quotes + documentos = sub-items con columna `signature` por fila; `FileCell` para adjuntos rápidos

**~sesión 17**
- Brainstorm: buttons, files, signature, stage gates, variantes L2, cross-board automations
- plan.md: Fases 11-16 rediseñadas — Column Upgrades / Variantes / Stage Gates / Automations / Quotes / WhatsApp
- Signature = kind:'signature' con watermark DocuSeal-style, $0, ligado a auth OTP
- Variantes: producto cartesiano N dimensiones (talla × color × ...) → L2 auto-generados
- Stage gates: blockers con auto-post a canal Sistema + mención WhatsApp al vendedor

**~sesión 16**
- plan.md: Fase 11 (WhatsApp+Quote) separada en Fase 11 Quote Engine + Fase 12 WhatsApp — specs completos para cada una
- performance: `getBoardItems`, `getBoardViews`, `getSubItemColumns` envueltos en `unstable_cache` (15s/60s/60s)
- `loading.tsx` nuevo en `/app/b/[boardSid]/` — skeleton animado, navegación se siente instantánea
- Supabase Realtime en BoardView: suscripción a `items` por `board_id` — INSERT/UPDATE/DELETE llegan a todos los usuarios en ~100-200ms
- Build 72 rutas 0 errores

**~sesión 15**
- ⋯ en headers de columna en GenericDataTable → abre ColumnSettingsPanel directamente desde la tabla (no solo desde el picker)
- Todos los dropdowns de permisos (columnas, board members, view members) soportan Equipos + Usuarios con optgroup
- Fix: SelectCell/PeopleCell no mostraban dropdown — overflow-hidden en `td` clipaba position:absolute; removido, confirmado funcional
- Build 72 rutas 0 errores

**~sesión 14**
- Fase 10 completa: ColumnSettingsPanel — drawer deslizante derecho, tabs General/Opciones/Permisos
- General: nombre editable, tipo (kind) con selector + advertencia al cambiar, Number format, Relation target board
- Opciones: lista CRUD con color picker para select/multiselect — guarda en board_columns.settings.options
- Permisos: gestión view/edit por usuario (misma API que antes)
- PATCH /api/boards/[id]/columns/[colId]: extendido para aceptar kind + settings (jsonb)
- BoardView: ⋯ en panel Columnas → ColumnSettingsPanel (reemplaza panel inline)
- Settings → Boards → Columnas: ⋯ → ColumnSettingsPanel (reemplaza panel inline)
- Build 72 rutas 0 errores

**~sesión 13**
- Fix: vistas no guardaban columnas (upsert pasaba null a campos NOT NULL — position/width); ahora persiste correctamente
- Fix: ⋯ en vistas y columnas invisible → cambiado a siempre visible (gris claro, hover indigo)
- Fase 9 completa: 9.3 territory filter en BoardView toolbar + 9.4 verificado (RLS + restrict_to_own API ok)
- BoardView: botón "Configurar" (engrane) → settings del board; panel Columnas con ⋯ por columna → permisos inline (misma API que Settings)
- Fase 10 documentada en plan.md: ColumnSettingsPanel (editor completo — nombre, tipo, opciones select, fórmulas, relation, permisos)

**~sesión 12**
- Fase 9 completa (9.1–9.6): permisos granulares por columna y por vista
- Migration 012: `board_view_members` table + RLS (sin registros = visible para todos; con registros = acceso restringido)
- 4 API routes nuevas: CRUD permisos de columna + CRUD miembros de vista
- Settings → Boards → Columnas tab: 3-dot (⋯) hover por columna → panel inline de permisos (ver/editar por usuario)
- BoardView tab strip: 3-dot (⋯) hover por vista → popup de gestión de acceso por vista
- GET /api/boards/[id]/columns filtra columnas según column_permissions + devuelve user_access; GET /api/boards/[id]/views incluye members
- Build 70+ rutas 0 errores



**~sesión 11**
- Fix cells: SelectCell + MultiSelectCell + PeopleCell abren con single click (era double click — no funcionaba etapa)
- Fix bug: vista duplicada al crear — onBlur + onKeyDown Enter disparaban handleCreateView dos veces; resuelto con viewSubmittingRef
- Fase 9.0 (pre-requisito seguridad): 35 API routes migradas de createServiceClient → createClient (user JWT); RLS ahora es enforcement real
- Solo admin/seed y superadmin/workspaces conservan service client (legítimo: bypass intencional)
- Build 64+ rutas 0 errores

**~sesión 10**
- Board Views (Fase 8.7): tab strip entre header y tabla, column picker dropdown, rename/delete vistas
- Migration 011: `board_views` + `board_view_columns` aplicada en Supabase remoto
- 4 API routes nuevas: CRUD vistas + toggle visibilidad de columnas por vista
- Auto-crea vista "Default" en primer load; sin board_view_columns = columna visible por default
- Plan actualizado: 8.7 done, `board_view_members` + billing diferidos a Fase 9; build 64 rutas 0 errores

**~sesión 9**
- Fase 8 Settings completa: layout Cursor-inspired, 9 páginas (profile, workspace, members, teams, territories, boards, billing, superadmin), 56 rutas build limpio
- Permisos `restrict_to_own` en `board_members`: miembro solo ve items donde es owner; toggle en Acceso tab; enforcement en `GET /api/items`
- Migration 010: `users.job_title` + `board_members.restrict_to_own` (pendiente aplicar en Supabase remoto)
- Arquitectura Board Views documentada en plan.md como Fase 8.X: `board_views` + `board_view_columns` + `board_view_members` — columnas creadas en vista X son invisibles en las demás por default

**~sesión 8**
- Fase 7 completa: ItemChannels (mini Slack), ActivityFeed, 5 API routes, migration 008
- Canales por item: lista sidebar + mensajes + @mentions (`@[Nombre](SID)`) + permisos por canal
- SIDs cambiados de secuencial a random 8 dígitos via `generate_sid()` + `sid_registry` (migration 009)
- Migration 008+009 aplicadas en Supabase remoto; build limpio 30 rutas 0 errores

**~sesión 7**
- AirtableSource rediseñado: 3 pasos numerados (API Key → Base → Tabla), dropdowns desde API real
- Paso completado = círculo verde con ✓; activo = indigo con ring; línea verde entre pasos
- Auto-detección de tipo: 30+ tipos Airtable → kind Tratto (`singleSelect→select`, etc.) via `sourceKind` en `ImportField`
- ColumnMapper simplificado: crear columna = inline nombre editable + badge tipo auto + botón Crear (sin picker)
- `__airtable_id` capturado en todos los registros para future refresh/sync

**~sesión 6**
- Fase 6 completa: Import Wizard arquitectura de plugins — agregar fuente = 1 archivo + 1 línea en registry
- `ImportWizard` genérico orquesta: source picker → ConnectStep → ColumnMapper → `/api/import/bulk`
- `ColumnMapper` con "✦ Crear columna nueva" inline: nombre + tipo → POST columns → auto-mapea
- `AirtableSource` + `CsvSource` como ConnectStep plugins; endpoint único `bulk` reemplaza csv+airtable
- Build limpio 25 rutas 0 errores; `POST /api/boards/[id]/columns` nuevo

**~sesión 5**
- Fase 5 completa: migration 007 aplicada (sub_item_columns, source_item_id, drop qty/unit_price/notes/catalog_item_id)
- APIs nuevas: sub-item-columns CRUD, sub-items con snapshot engine, /[id]/values PUT
- InlineSubItems + SubItemsView reescritos con columnas dinámicas + fórmulas client-side
- SourceColumnMapper modal nuevo (2 pasos: elegir source board + mapear columnas)
- Arquitectura de subagentes Haiku: 5 agentes en paralelo, build limpio 24 rutas 0 errores

**~sesión 4**
- Fase 5 UX refactor: `>` chevron expande sub-items inline entre rows, `→` abre detalle (row click eliminado), edit inline en tabla
- Fix React key warning (`<Fragment key>`) + infinite loop en sub-items (`useRef` para `onCountChange`)
- `SourceSelector` dropdown en barra superior de InlineSubItems (reemplaza LevelSelector del fondo)
- Arquitectura Fase 5 rediseñada: columnas dinámicas (`sub_item_columns`), snapshot engine, formula columns predefinidas, 1 source por board
- plan.md + start.md actualizados con nueva arquitectura — `qty/unit_price/notes` eliminados de sub_items, reemplazados por sub_item_columns

**~sesión 3**
- Fase 4 completa: `ItemDetailView` (header editable + stage badge + info panel + tabs placeholder), `[itemSid]/page.tsx` server page, `resolveItemBySid` en lib/boards
- Optimización de velocidad: datos pre-fetcheados en servidor y pasados como props — 0 client fetches al cargar board o item
- Caches: `resolveBoardBySid`, `getBoardContext`, `getWorkspaceUsers` con `unstable_cache` 60s; profile lookup 30s
- Service client singleton; `requireAuthApi` sin SELECT users redundante
- Prev/Next eliminado de ItemDetailView por decisión de diseño

**~sesión 2**
- Rutas migradas de `[boardSlug]` → `[boardSid]`: boards ahora en `/app/b/10000039`
- `resolveBoardBySid()` + `getFirstBoard()` reemplazan lógica de slug; redirect `/app` dinámico por `system_key`
- Sidebar usa `board.sid` en links y active-check; plan.md + start.md actualizados (nunca slug en URLs)
- Debug pendiente: `resolveBoardBySid` retorna null en dev → 404; log de error añadido, requiere restart dev server

**~sesión 1**
- Fase 3 completa: GenericDataTable (TanStack Table v8 + Virtual), 11 cell types, BoardView, 8 API routes, lib/boards
- Sidebar rediseñada: iconos SVG por tipo de board (funnel, person, building, truck, layers), sin colores, active=negro
- Fix col_key: BoardView usaba `_name`/`_stage` pero BD tiene `name`/`stage`; corregido + columna virtual `__sid`
- Endpoint `/api/admin/seed` para poblar workspace CMP con boards + 28 items desde browser (idempotente)
- `npm run build` limpio — 15 rutas

## 2026-04-12

**~sesión 5**
- Fase 2 completa: sidebar + layout + API boards + redirect /app→/app/b/oportunidades + placeholder BoardPage
- Auth fix: `window.location.href` en lugar de `router.push` post-OTP (cookies no se sincronizaban)
- Auth fix: auto-provision fallback en `getCurrentUser()` — trigger `handle_new_auth_user` falla silencioso en este proyecto
- Auth fix: phone format mismatch — Supabase guarda `521234567890`, seed tiene `+521234567890`; normalizado con `in([withPlus, withoutPlus])`
- App corriendo: sidebar muestra 5 boards del workspace CMP, navegación activa, login→/app funciona

**~hora 1**
- Next.js 16 + Supabase instalado y corriendo en localhost:3000
- proxy.ts (auth guard para /app y /api)
- Login page con phone OTP
- /app protegido, muestra "estoy logged in"
- Auth module con server-only + cache() + dos páginas de prueba
- Commit inicial

**~hora 2**
- Comandos de proyecto creados: `/start` y `/end` en `.claude/commands/`
- `/start` carga contexto mínimo (fase actual, git, log) en caveman mode
- `/end` loggea sesión + commit + push automático

**~hora 4**
- Fase 1 completada: middleware (proxy.ts), auth helpers, login, logout
- AuthUser ahora incluye workspaceId, role, userSid desde tabla users
- proxy.ts confirmado como middleware en Next.js 16 (`ƒ Proxy (Middleware)` en build)
- Pendiente: test manual OTP (+521234567890 / 123456) antes de Fase 2

**~hora 3**
- Fase 0 completa: 6 migrations aplicadas en Supabase remoto
- 001: 23 tablas, sequence global `tratto_sid_seq`, indexes
- 002: `find_by_sid`, `seed_system_boards`, `handle_new_auth_user`, triggers activity/channels/updated_at
- 003: RLS en todas las tablas (workspace isolation + board access + permisos granulares)
- 004: Seed — workspace CMP, 5 system boards, 28 items, 2 teams, 3 territories
- 005: Fix constraints DEFERRABLE en board_members
- 006: `superadmin_phones` — auto-promueve a superadmin en primer OTP login
- DB verificada: 0 sids duplicados, boards/items/stages/columns correctos
