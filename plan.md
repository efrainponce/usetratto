# Tratto — plan.md (Fresh Start)

**Fecha:** 2026-04-12
**Objetivo:** Reconstruir Tratto desde cero. Simple, reutilizable, modular. Zero duplicación.
**Enfoque:** Un agente, secuencial, cada fase completa antes de la siguiente.

---

## Filosofía del plan

```
1. Schema primero → después UI
2. Una cosa funcionando → después la siguiente
3. Genérico desde el día 1 → nunca hardcodear
4. Cada fase termina con algo que se puede probar en el browser
5. Commit al final de cada fase, no antes
```

---

## Diagrama de dependencias

```
Fase 0: Supabase schema + seed
   ↓
Fase 1: Auth (login funcional)
   ↓
Fase 2: Layout (sidebar + header + rutas)
   ↓
Fase 3: BoardView (tabla genérica, inline edit, CRUD items)
   ↓
Fase 4: ItemDetailView (detalle + info panel editable)
   ↓
Fase 5: Sub-items (jerárquicos, vistas configurables)
   ↓
Fase 6: Import wizard (Airtable + CSV, genérico)
   ↓
Fase 7: Canales + Activity log
   ↓
Fase 8: Settings + Board Views (tab strip, column visibility por vista)
   ↓
Fase 9: Permisos (RLS real, board_members, column_permissions, view members)
   ↓
Fase 10: Column Settings Editor (nombre, tipo, opciones, fórmulas, relation)
   ↓
Fase 11: Column Upgrades (files, buttons, signature)
   ↓
Fase 12: Variantes L2 + Vistas por board
   ↓
Fase 13: Formula Columns
   ↓
Fase 14: Rollup Columns
   ↓
Fase 15: Column Validations + Stage Gates
   ↓
Fase 16: Herencia de Permisos de Columna (snapshot + sub-items + RelationCell)
   ↓
Fase 16.5: System Columns + Meta-tags + Activity Audit + RelationPicker
   ↓
Fase 16.6: Ref Columns (kind='reflejo', mirror/lookup con nested resolution)
   ↓
Fase 17: Invitations + Email Auth + Session Optimization
   ↓
Fase 17.5: Performance & Code Consolidation (speed + menos código + mismas features)
   ↓
Fase 18: Quote Engine (templates PDF, cotizaciones desde items)
   ↓
Fase 19: Filter / Sort / Group (vistas configurables)
   ↓
Fase 20: Tratto AI Agent + Sidebar Chat (engine compartido — sidebar, WA, móvil)
   ↓
Fase 21: WhatsApp Integration (adapter sobre el mismo engine)
```

---

## Fase 0 — Schema + Seed ✅

**Goal:** Base de datos con `sid` global y 5 boards de sistema preconfigurados.

**Entregado:**
- Secuencia `tratto_sid_seq` + todas las entidades principales con sid único (workspaces, boards, items, sub-items, stages, columnas)
- Migrations 001-004: schema core + triggers (auto-provisioning, activity log, autonumber) + RLS policies + seed data (1 workspace, 5 boards sistema, 10 items ejemplo)
- Funciones: `seed_system_boards()`, `handle_new_auth_user()`, `find_by_sid(bigint)`

_Detalle completo en `plan_20260415.md`._

---

## Fase 1 — Auth ✅

**Goal:** Login con phone OTP, sessions con auto-refresh, protección /app/* y /api/*.

**Entregado:**
- Next.js + Supabase clients (browser, server, service)
- Auth helpers: `requireAuth()`, `requireAdmin()`, `optionalAuth()` (return userId, workspaceId, role, userSid)
- Middleware: JWT refresh + protección de rutas
- OTP login page → redirect a /app

_Detalle completo en `plan_20260415.md`._

---

## Fase 2 — Layout ✅

**Goal:** Sidebar con boards dinámicos, header, navegación principal.

**Entregado:**
- Shell layout con sidebar (logo + workspace name + boards listados dinámicamente)
- System boards (arriba) vs custom boards (abajo) separados visualmente
- Redirect /app → /app/b/[sid_opportunities]
- Settings + Superadmin button + Logout

_Detalle completo en `plan_20260415.md`._

---

## Fase 3 — BoardView (la tabla) ✅

**Goal:** Tabla genérica estilo Airtable + 11 cell types + inline edit + CRUD items.

**Entregado:**
- `GenericDataTable`: TanStack Table v8 + sort, sticky first column, bulk select, inline edit
- Cell system: text, number, date, select, multiselect, people, relation, phone, email, boolean, file (11 tipos)
- BoardView: fetch board/columns/items/values → rows transform → inline edit (PATCH items core, PUT item_values custom)
- API: GET /api/boards/[id], GET /api/boards/[id]/columns, GET/POST/PATCH/DELETE /api/items, PUT /api/items/[id]/values
- `resolveBoardBySid()` helper

_Detalle completo en `plan_20260415.md`._

---

## Fase 4 — ItemDetailView ✅

**Goal:** Página de detalle con editor de campos + tabs (Sub-items, Channels, Activity).

**Entregado:**
- Detalle con header editable (nombre + stage + sid visible)
- Info panel: campos core + custom (mismo cell system que tabla)
- Tabs: Sub-items | Channels | Activity
- Breadcrumb back to board

_Detalle completo en `plan_20260415.md`._

---

## Fase 5 — Sub-items (columnas dinámicas + snapshot) ✅

**Goal:** Sub-items con columnas configurables, source board seleccionable, snapshot engine.

**Entregado:**
- `sub_item_columns`: configurables por board (igual que board_columns) con `source_col_key` para trazabilidad
- `source_item_id`: ref al item original en snapshot
- Snapshot engine: copia valores del source (punto en el tiempo) → editables independientemente
- Formula columns (multiply/add/subtract/percent): computadas frontend, read-only
- SourceColumnMapper: modal para elegir columnas a importar y mapear
- InlineSubItems + SubItemsView: tablas dinámicas con valores editables
- ProductPicker: busca en source board con preview de columnas

_Detalle completo en `plan_20260415.md`._

---

## Fase 6 — Import Wizard ✅

**Goal:** Plugin architecture para importar desde cualquier fuente (Airtable, CSV, extensible a Monday, Notion, etc.).

**Entregado:**
- `ImportSource` interface + registry pattern
- AirtableSource + CsvSource implementados
- ImportWizard genérico: picker → ConnectStep → ColumnMapper → bulk import
- Column creation inline + board refresh post-import
- API: POST /api/import/bulk (genérico)

_Detalle completo en `plan_20260415.md`._

---

## Fase 7 — Canales + Activity Log ✅

**Goal:** Comunicación interna + audit trail automático.

**Entregado:**
- ItemChannels: canales General + Sistema automáticos por item (en pipeline)
- ChannelMessages + mentions + replies
- ActivityFeed: log automático de cambios (items + sub-items)
- Tabs en ItemDetailView integrados

_Detalle completo en `plan_20260415.md`._

---

## Fase 8 — Settings + Board Views ✅

**Goal:** Admin configura todo (boards, stages, columns, members, teams, territories). Usuarios crean vistas por board con column visibility.

**Entregado:**
- Settings layout (sidebar secundario) con Boards, Teams, Territories, Workspace, Superadmin sections
- Board CRUD: stages + columns + members (view/edit + restrict_to_own toggle)
- Teams + Territories CRUD
- Board Views: tab strip, create/rename/delete views, column visibility per view, "Default" siempre existe
- Migration 011: `board_views` + `board_view_columns` (sin miembros — eso es Fase 9)
- API: GET/POST/PATCH/DELETE /api/boards/[id]/views, PUT /api/boards/[id]/views/[viewId]/columns

_Detalle completo en `plan_20260415.md`._

---

## Fase 9 — Permisos granulares ✅

**Goal:** RLS enforcement + board_members + column_permissions + restrict_to_own + board_view_members.

**Entregado:**
- RLS real: 35 API routes migradas a createClient() (JWT + RLS es el único enforcement)
- board_members: user/team con access level (view/edit)
- column_permissions: user/team con access per column
- restrict_to_own: vendedor solo ve sus propios items
- Territory filter: dropdown en toolbar
- board_view_members: quién puede ver qué vista (sin registros = todos los miembros del board)
- Migration 012: `board_view_members` table
- ColumnSettingsPanel: permisos UI con 3-dot hover

_Detalle completo en `plan_20260415.md`._

---

## Fase 10 — Column Settings Editor ✅

**Goal:** Unified editor para nombre, tipo, opciones, fórmulas, relations, permisos — un solo componente reutilizable.

**Entregado:**
- `ColumnSettingsPanel` (drawer): tabs General | Opciones | Fórmula | Relation | Número | Permisos
- Integrado en BoardView column picker (⋯) y Settings → Boards → Columns
- API: PATCH /api/boards/[id]/columns/[colId] extendido para `name`, `kind`, `settings` (jsonb)
- Opciones persistidas en `board_columns.settings.options = [{value, label, color}]`
- Cambiar kind muestra advertencia

_Detalle completo en `plan_20260415.md`._

---

## Fase 11 — Column Upgrades: Files, Buttons, Signature ✅

**Goal:** Tres nuevos column types que desbloquean quotes, gates y aprobaciones.

**Entregado:**
- **file**: Bucket storage + signed URLs + FileCell (chips + download)
- **button**: Inline action buttons (change_stage, create_quote, run_automation) + settings.label/action/confirm
- **signature**: Immutable watermark (doc_id, signed_by, email, signed_at, user_id) + SignatureCell (read-only post-sign)
- API: POST /api/items/[id]/files (upload), ButtonCell actions (change_stage implemented)

_Detalle completo en `plan_20260415.md`._

---

## Fase 12 — Variantes L2 + Vistas por board ✅

**Goal:** Exploit L1 → L2 variantes (Cartesian product). Filter view depth per board. Reuse + refresh snapshots.

**Entregado:**
- L2 rendering: indented hierarchy, expand/collapse L1, drag-reorder
- "Explotar variantes": botón ⊞ → modal choose multiselect columns → creates L2 Cartesian product (skips duplicates)
- formula `sum_children`: sums L2 qty per L1 (read-only, computed frontend)
- `subitem_view` setting: L1_only | L1_L2 | L2_only per board
- NativeRenderer: SubItemsView con drawer lateral (w-72) para editar sub-item fields
- Linked navigation: ↗ en L1 → catálogo source item (resolved batch), ↓ → import source's L2s as children, ⟳ → refresh snapshot (blocked if is_closed)
- `is_closed` rename-safe in select options + Status column auto-seed for opportunities
- Migration 20260414000002-004: boards.settings jsonb, Estado status column, option.is_closed
- SelectCell renders badge when closed, dropdown when editing

_Detalle completo en `plan_20260415.md`._

---

## Fase 13 — Formula Columns ✅

**Goal:** Configurable formulas (arithmetic, IF, concat, date_diff, count_if) on board_columns + sub_item_columns, computed frontend.

**Entregado:**
- `lib/formula-engine.ts`: evaluateCondition() + computeFormula() (5 formula types, puro/testeable)
- kind='formula' on board_columns (was sub-item only)
- ColumnSettingsPanel tab "Fórmula": type selector + column refs + preview
- GenericDataTable + NativeRow: eval formulas on render
- IF fórmula: condition + col_true/col_false (col_key or literal)

_Detalle completo en `plan_20260415.md`._

---

## Fase 14 — Rollup Columns ✅

**Goal:** Aggregate child values up (L2→L1, L1→Item, L1→board column). Key case: sum(L2.qty) visible in L1 + sum(L1.total) in opportunity.

**Entregado:**
- `lib/rollup-engine.ts`: computeRollup() (sum/avg/count/min/max/count_not_empty, children + descendants)
- kind='rollup' on sub_item_columns (L1 aggregates L2) + board_columns (item aggregates L1)
- Battery bar in SubItemsView: visual rollup of status (collapsed L1, segmented bar by color/stage, %)
- ColumnSettingsPanel tab "Rollup": level + source column + function
- Pre-calc in GET /api/items when board has rollup columns
- Reactive recalc: edit L2 → L1 rollup updates immediately (optimistic)
- Row footer: sum/avg/min/max/count per numeric/formula/rollup column, click cycles function
- Migrations 20260414000008-009: sub_item_columns.view_id + column_permissions support both board/sub_item columns

_Detalle completo en `plan_20260415.md`._

---

## Fase 15 — Column Validations + IF Formula + Stage Gates ✅

**Goal:** Native validation per column (condition builder). Stage gates are button columns that evaluate gates before advancing.

**Entregado:**
- Validation per column in `board_columns.settings.validation`: condition (empty/not_empty/>/</=/!=/contains) + message
- IF formula completed: condition + col_true/col_false (col_key or literal number/string)
- Default values: applied on item/sub-item creation
- Stage gates: stored as `board_columns.settings.stage_gates = {[stage_id]: [col_keys]}`
- ButtonCell.runValidations(): evaluates only gate columns, shows blocking messages (red cells + toast)
- ColumnCell visual feedback: red border + ❌ overlay when validation fails
- NativeRow: same red overlay for formula/rollup/validation columns
- ColumnSettingsPanel tabs: General (default_value) | Fórmula (IF) | Validación | Botón (label/action) | Etapa (stage_gates checklist)

_Detalle completo en `plan_20260415.md`._

---

## Fase 16 — Herencia de Permisos de Columna ✅

**Goal:** Column permissions travel with data. If a column is private in the source, Ventas never sees it — not in board, sub-items, or quote snapshots.

**Entregado:**
- `permission_mode` in sub_item_columns: public (all) | inherit (from source's column_permissions) | custom (own permissions)
- Snapshot engine: verifies userCanViewColumn() on source columns before copying; unaccepted columns omitted silently
- `lib/permissions.ts`: userCanViewColumn() (column_id + user + workspace) + resolveInheritedPermissions() (sub_item_col + source board resolution)
- Row-level constraints: userCanAccessItem() (admin bypass + owner + board_members + restrict_to_own) used in GET /api/sub-items + refresh/expand endpoints
- NativeRow: gray cell `bg-gray-50` for columns without user_access, no edit
- ColumnSettingsPanel tab Permisos: radio permission_mode (3 opciones auto-detectadas), permission list hidden in public/inherit modes
- RelationCell preview: TODO comment for future field filtering
- Migration 20260415000010: sub_item_columns.permission_mode DEFAULT 'public'
- Audit: 4 service client leaks in sub-items routes fixed + workspace_id validation added

_Detalle completo en `plan_20260415.md`._

---

## Fase 16.5 — System Columns + Meta-tags + Activity Audit ✅

**Goal:** Consolidar columnas universales (created_by + timestamps), meta-tags semánticos en columnas (owner, primary_stage), defaults en oportunidades (contacto → institución) y auditar que Activity captura eventos de sub-items. Pre-requisito de Fase 17 para que el onboarding invite usuarios a un sistema ya coherente.

**Entregado (sesión 2026-04-15 ~sesión 2):**
- Migration 20260415000011: `items.created_by`, `sub_items.created_by`/`updated_at`, `sub_item_columns.is_system`
- Triggers: `set_created_by` (items+sub_items), `set_updated_at` (sub_items), `log_sub_item_activity` + `log_sub_item_value_activity` → `item_activity`
- `seed_system_boards` rewrite: metatags `role=primary_stage` en stage, `role=owner` en owner; opportunities con contacto/institucion/monto; contacts con institucion; auto-inject 3 system cols por board
- Trigger `inject_system_board_columns` para boards nuevos + backfill existentes
- `lib/boards/helpers.ts` (client-safe): `getPrimaryStageColKey`, `getOwnerColKey` con fallback legacy
- Refactor `BoardView.tsx` + `ItemDetailView.tsx`: ITEMS_FIELD dinámico, augmentSettings recibe stage/owner col_keys
- `ColumnSettingsPanel`: dropdown "Rol del sistema" (General tab, people/select only), isStageCol lee `settings.role`, 409 handling
- PATCH `/api/boards/[id]/columns/[colId]` valida unicidad de role por board (409)
- `DateCell`: modo relativo (`display:'relative'`) — "hace 2h"; read_only cuando `read_only=true`
- `PeopleCell`: read-only cuando `display:'read_only'`
- `ColumnCell` dispatcher: `isSystemReadOnly` bloquea onStartEdit para system cols
- `ActivityFeed`: 3 nuevas acciones `sub_item_created`/`deleted`/`value_changed` + realtime subscription a `item_activity`
- Seeder incluye `auto_fill_targets` en `contacto` (inerte hasta que RelationCell tenga picker)

**Nota final sesión 2:** Todas las 25 tareas completadas + RelationPicker modal (que destrabó 16.5.16/18) + 16.6 Ref Columns (fase adicional).

### 16.5.A — Columnas de sistema universales

3 columnas auto-creadas en cada board nuevo (items + sub_items), `is_system=true`, read-only en UI:
- `created_by` (people) — user que creó el registro
- `created_at` (date) — timestamp creación
- `updated_at` (date) — timestamp última modificación

Para items ya existen `created_at`/`updated_at` físicos — solo falta exponerlos como `board_columns` sistema y agregar `created_by` físico. Para sub_items: verificar y mismo patrón. Triggers DB rellenan automáticamente.

`ColumnSettingsPanel` detecta `is_system` → deshabilita rename / delete / cambio de tipo. Cells muestran valor en formato relativo ("hace 2 horas").

### 16.5.B — Column meta tags (owner + primary_stage)

Agregar `settings.role: 'owner' | 'primary_stage' | null` a `board_columns` (no migration — es jsonb existente).

- **`role='owner'`** — cualquier columna `people` puede marcarse. Sistema usa esa columna como owner del item (reemplaza el hardcoded `owner_id` físico o sincroniza). Máx 1 por board.
- **`role='primary_stage'`** — cualquier columna `select` puede marcarse. Stage gates, `is_closed`, rollup % leen de esta columna en lugar del hardcoded `col_key='stage'`. Máx 1 por board.

Seeder marca "Etapa" y "Owner" con el role automáticamente al crear system boards.

UI: ColumnSettingsPanel tab General → dropdown "Rol del sistema" (None / Owner / Stage primaria).

Beneficio: un board custom puede tener columna "Vendedor" con `role=owner` y funciona idéntico a oportunidades sin hacks.

### 16.5.C — Defaults de oportunidades (Oportunidad → Contacto → Cuenta)

Seeder extendido para system boards:
- `opportunities`:
  - `contacto` relation → `contacts` (required)
  - (cuenta ya NO es columna directa — viene del contacto via chain lookup, ver sesión 5 2026-04-22)
- `contacts`:
  - `cuenta` relation → `accounts` (opcional)
  - `cargo` text (opcional)

**Chain lookup:** la cuenta de una oportunidad/cotización se resuelve al generar/renderizar desde `contacto.cuenta`. No se duplica como relation propia del item. Ver `generate/route.ts` y `context/route.ts` `fetchContactChain()`.

**Required enforcement:** reusa sistema de validación de Fase 15 (`settings.required: true`). Items sin contacto muestran overlay rojo y bloquean stage gates.

### 16.5.D — Activity audit (sub-item events)

User reporta que Activity del item no muestra eventos de sub-items. Requiere audit primero, fix después.

**Audit:**
- Listar triggers actuales en `item_activity` (migrations 002/008)
- Probar en dev: crear/editar/borrar sub-item → ¿aparece fila en `item_activity`?
- Verificar si `ActivityFeed` filtra acciones de sub-items o simplemente no llegan

**Fix esperado:**
- Triggers nuevos en `sub_items` + `sub_item_values` → insertan en `item_activity` con actions `sub_item_created`, `sub_item_updated`, `sub_item_deleted`, `sub_item_value_changed`
- `ActivityFeed` render de cada action con copy legible + link al drawer del sub-item
- Realtime subscription en `item_activity` por `item_id` (si no existe)

### Tareas

#### 16.5.A — System columns
- [x] **16.5.1** Migration agrega `items.created_by` (no existía en 001)
- [x] **16.5.2** Migration agrega `sub_items.created_by` + `updated_at` (faltaban)
- [x] **16.5.3** Seeder auto-inyecta 3 columnas sistema por board + trigger `inject_system_board_columns` para boards nuevos + backfill existentes
- [ ] **16.5.4** DIFERIDO: `sub_item_columns.is_system` schema listo, inyección automática en creación de vistas nativas pendiente
- [x] **16.5.5** Triggers `set_created_by` (items+sub_items) y `set_updated_at` (sub_items; items ya tenía)
- [x] **16.5.6** `ColumnSettingsPanel`: `is_system` ya deshabilita rename/delete/type-change (audit confirmó, no requirió cambio)
- [x] **16.5.7** `DateCell` modo relativo + `PeopleCell` read-only + `ColumnCell` dispatcher bloquea onStartEdit si `display` es `relative`/`read_only`

#### 16.5.B — Meta-tags (owner + primary_stage)
- [x] **16.5.8** `board_columns.settings.role` uso establecido (jsonb existente, sin migration)
- [x] **16.5.9** `ColumnSettingsPanel` tab General: dropdown "Rol del sistema" para people/select non-system + 409 handling
- [x] **16.5.10** PATCH column valida unicidad de `role='owner'` y `role='primary_stage'` por board → 409
- [x] **16.5.11** `lib/boards/helpers.ts` client-safe: `getPrimaryStageColKey`/`getOwnerColKey` con fallback a `col_key='stage'`/`'owner'`
- [x] **16.5.12** `BoardView.tsx` + `ItemDetailView.tsx`: ITEMS_FIELD dinámico, `augmentSettings(col, stageColKey, ownerColKey, ...)`, `ColumnSettingsPanel.isStageCol` lee `settings.role`
- [x] **16.5.13** Seeder marca `role='primary_stage'` en Etapa y `role='owner'` en todos los Owner automáticamente; backfill SQL en migration

#### 16.5.C — Opportunities + relation defaults
- [x] **16.5.14** Seeder opportunities: `contacto` (relation→contacts, required), `institucion` (relation→accounts, required), `monto`
- [x] **16.5.15** Seeder contacts: `institucion` (relation→accounts) opcional
- [x] **16.5.16** RelationPicker modal implementado; `handleCellChange` en BoardView detecta `auto_fill_targets` en cols relation y al picker: fetch source item (/api/items?format=col_keys), propaga valores a targets vacíos del item actual vía PUT + optimistic update
- [x] **16.5.17** Seeder incluye `auto_fill_targets` en `contacto` — ahora activo gracias a 16.5.16
- [x] **16.5.18** `settings.required` ahora enforza: `ButtonCell.runValidations` flag required-empty + `ColumnCell.isInvalid` rojo overlay + tooltip "Campo requerido" — bloquea stage gates junto con el sistema de Fase 15

#### 16.5.D — Activity audit + fix
- [x] **16.5.19** Audit: solo `trg_item_activity` en tabla `items` (20260412000002:269). ZERO triggers en sub_items/sub_item_values
- [x] **16.5.20** Confirmado por audit: sub-item events nunca llegaban a `item_activity`
- [x] **16.5.21** Reporte: (a) item triggers ok, (b) sub_items sin triggers, (c) ActivityFeed solo renderiza 5 actions items, (d) sin realtime, (e) ruta `/api/items/[id]/activity` retorna todo sin filtro
- [x] **16.5.22** Migration con `log_sub_item_activity()` + `log_sub_item_value_activity()` SECURITY DEFINER: `sub_item_created`/`sub_item_deleted`/`sub_item_value_changed` incluye old_value/new_value/metadata
- [x] **16.5.23** `ActivityFeed` describe las 3 nuevas acciones con metadata.sub_item_name/depth
- [x] **16.5.24** `ActivityFeed` realtime subscription a `item_activity` filtrado por `item_id` (fallback "Alguien" si falta join de actor)
- [ ] **16.5.25** DIFERIDO: verificación manual en dev (requiere `supabase db push` + test end-to-end)

### Verificación

- [ ] Crear board nuevo → aparecen 3 columnas sistema (created_by/created_at/updated_at) automáticamente
- [ ] ColumnSettingsPanel sobre columna sistema → campos rename/delete/tipo deshabilitados
- [ ] Marcar columna "Vendedor" con `role='owner'` en un board custom → filtros `restrict_to_own` leen de ahí
- [ ] Crear oportunidad nueva sin contacto → stage gate bloquea avance
- [ ] Seleccionar contacto con institución asignada → campo institución de la oportunidad se auto-rellena
- [ ] Agregar sub-item → Activity feed del item muestra el evento al instante

### Dudas resueltas (sesión 2)

1. `items.created_by` físico: NO existía → migration 20260415000011 lo agrega
2. Cascade auto-fill: config seed-level sí, runtime cell-level DEFERIDO (RelationCell display-only)
3. `role='primary_stage'` backward-compat: fallback soft (`getPrimaryStageColKey` cae a `col_key='stage'` si no hay tag) — zero riesgo boards legacy

---

## Fase 16.6 — Ref Columns (Mirror / Lookup) ✅

**Goal:** Columna que *muestra* un campo de un item relacionado de otro board. `kind='reflejo'` es tipo real en DB + frontend. Visual: chip `rounded-md bg-gray-50` con prefix ↪ ámbar; header del col también muestra ↪.

**Caso de uso**: en el board `opportunities` tener una columna `telefono_contacto` que es `ref` → va al contacto relacionado (columna `contacto`) y lee/escribe su columna `phone`. Editarla desde oportunidades actualiza el contact real.

### Data model (sin migration — solo settings)

```json
// board_columns.settings para una ref col en opportunities
{
  "ref_source_col_key": "contacto",     // col_key de columna relation EN ESTE board
  "ref_field_col_key":  "phone",         // col_key del campo en el board destino a reflejar
  "ref_field_kind":     "phone"          // kind cacheado para dispatching (optional)
}
```

La columna sigue teniendo su propio `kind` (igual al del campo destino). Detección: `isRefCol(col) = !!col.settings?.ref_source_col_key && !!col.settings?.ref_field_col_key`.

### Flujo de render

1. BoardView detecta ref cols
2. Para cada ref col, resuelve: `relationCol` (por col_key en rawCols), `target_board_id` (de relationCol.settings), `ref_field_col_key`
3. Colecta `source_item_ids` únicos de los valores de la relation col en rawItems
4. Batch fetch: `GET /api/items?boardId=<target>&ids=<a,b,c>` (endpoint extendido)
5. Construye `refMap: Record<source_item_id, Record<col_key, value>>` mapeando item_values a col_keys del target board
6. `toRow()` populates ref col cells desde refMap[relationVal]?.[ref_field_col_key]

### Flujo de edición

- `handleCellChange(col, value)` detecta ref col
- Deriva `sourceItemId` del valor actual de la relation col en la row
- Deriva `targetColId` del refMap secondary index (col_key → column_id del target board)
- `PUT /api/items/[sourceItemId]/values` con `{ [targetColId]: value }`
- Actualiza `refMap` optimistamente

### Visual

- **Cell**: chip `rounded-md border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[12px]` con prefix `↪` ámbar cuando isRef (prefix vive en RelationCell chip)
- **Column header**: icon `↪` al lado del label, tooltip al hover: "Reflejo de *Contacto* → *institucion*"
- Ref cells son **read-only** en UI: se editan desde el board fuente, no desde el ref col

### ColumnSettingsPanel tab "Reflejo"

- Visible cuando el kind del col NO es `formula/rollup/button/signature/file/autonumber`
- Dropdown 1: "Columna de relación" → lista los cols de este board con `kind='relation'`
- Dropdown 2: "Campo a reflejar" → al elegir relation, fetch `/api/boards/[target_board_id]/columns` y lista los cols compatibles del target
- Guardar: persiste `ref_source_col_key` + `ref_field_col_key` + `ref_field_kind` en settings
- Limpiar: botón "No reflejar" (borra los 3 settings)

### Tareas

- [x] **16.6.1** `lib/boards/helpers.ts`: `isRefCol(col)` helper exportado
- [x] **16.6.2** `GET /api/items`: soportar `?ids=a,b,c` + `?format=col_keys` → devuelve `col_values: {col_key: value}` mapeado server-side (service client para board_columns lookup)
- [x] **16.6.3** `BoardView.tsx`: refColsMeta memo + useEffect batch-fetch (agrupado por target board) + refMap + refTargetCols + refNestedBoardId; toRow rama ref resuelve + nested resolution via relationLabelMap[nestedBoardId]
- [x] **16.6.4** `BoardView.tsx`: `handleCellChange` intercepta ref cols → PUT al source item leyendo item_id de rawItems (defensive, hoy ref cells son read-only)
- [x] **16.6.5** Chip styling para relation/ref cells (amber wrapper removido) + prefix ↪ ámbar en chip cuando isRef
- [x] **16.6.6** `GenericDataTable.tsx`: renderiza icon `↪` + tooltip en header de ref cols
- [x] **16.6.7** `ColumnSettingsPanel.tsx`: tab "Reflejo" con 2 dropdowns + botón "No reflejar"; handleSaveRef persiste kind='reflejo' + original_kind en settings
- [ ] **16.6.8** DIFERIDO: seed opcional `telefono_contacto` demo — no necesario, config vía UI

**Extra (no planeadas, agregadas durante sesión 4):**
- Migration 14 agrega `'reflejo'` al `board_columns_kind_check` constraint
- `CellKind` union extendido con `'reflejo'`; `ColumnCell` case `'reflejo'` dispatcha por `ref_field_kind` con cell read-only
- Nested relation resolution (ref col mirroring otro kind='relation' field resuelve via relationLabelMap del nested target)
- RelationCell detecta isRef → canPick=false → no picker, muestra `—` cuando empty
- Fallback UUID → null en toRow (zero leak visual durante load async)
- Fix RLS silente en `/api/items?format=col_keys` y `/api/boards/[id]/columns/[colId]/permissions` (ambos a service client)

### Verificación

- [x] Ref col en opportunities → chip gris con ↪ prefix + icono ↪ en header
- [x] Valor resuelve vía nested relationLabelMap (institucion → Juan → accounts → SEDENA)
- [x] Ref cells read-only en UI (no clickable)
- [x] Refrescar → valor persiste, leído del source
- [x] Si source_item no existe → cell muestra `—` (sin UUID leak)

### Deferidos (fuera de MVP 16.6)

- Sub-items support (solo board items por ahora)
- Realtime sync (cambios en source no reflejan hasta refresh)
- Multi-relation (si relation tiene array, solo usa el primer valor)
- Permisos visuales (si user no puede editar source, ref cell debería ser read-only con tint diferente — depende de permisos de Fase 9 aplicados al target board)

---

## Fase 17 — Invitations + Email Auth + Session Optimization

**Goal:** Onboarding sin costo vía invitación por email, login por email como método primario, sesiones largas con trusted devices, y multi-identity (varios emails apuntando a un user). Meta: reducir costo OTP SMS de ~$1.50/mes a <$0.20/mes para CMP.

### Modelo de datos

```sql
-- Invitaciones pendientes
invitations (
  id, sid,
  workspace_id, email,
  role,                     -- 'admin' | 'member' | 'viewer'
  token,                    -- random 32 chars, URL-safe
  expires_at,               -- created_at + 7 days
  accepted_at,              -- null si pendiente
  created_by,               -- user_id del admin que invita
  created_at
)

-- Multi-email: aliases del mismo user
user_emails (
  id,
  user_id,                  -- FK users
  email,                    -- UNIQUE global (un email → 1 user)
  is_primary,               -- true para el email canónico de Supabase Auth
  verified_at,              -- null hasta que haga OTP
  created_at
)

-- Trusted devices (para bypass OTP)
user_trusted_devices (
  id,
  user_id,
  device_id,                -- UUID generado cliente, persiste en localStorage
  device_label,             -- "Chrome en Mac · 192.x.x.x · 2026-04-15"
  last_seen_at,
  expires_at,               -- +365 days default, extendible
  created_at
)
```

### Estrategia de auth

**Métodos disponibles (en este orden de preferencia):**
1. **Email OTP** (default, gratis) — Supabase `signInWithOtp({ email })` con magic link o 6-digit code
2. **Phone SMS OTP** (opt-in) — para vendedores en campo sin laptop
3. **Trusted device** (bypass) — si el device_id está registrado y no expirado, salta OTP completo

**Session config (Supabase dashboard):**
- JWT access token: 1h (default)
- JWT refresh token: **90 días** (vs 30 default) — configurable en Supabase Auth settings
- Auto-refresh: cliente renueva JWT silenciosamente mientras el refresh token sea válido
- Rate limit OTP: 3 requests/hora por email/phone

**Flujo de login optimizado:**
```
1. User abre /login
2. Si localStorage tiene device_id Y user_email → POST /api/auth/trusted-check
   → Si device está en user_trusted_devices AND !expired → emite JWT sin OTP
   → Else → sigue al paso 3
3. Paso "elegir método": Email (default) / Phone
4. Envía OTP via Supabase signInWithOtp
5. User ingresa código
6. verifyOtp → JWT
7. Checkbox "Recordar este dispositivo" → POST /api/auth/trust-device
```

### Tareas

#### 17.A — Invitations
- [x] **17.1** Migration: `invitations` table + índices + RLS
- [x] **17.2** `POST /api/invitations` (admin only) — crea row + genera link vía `generateLink` + envía email vía Resend API directo (bypass Supabase rate limit)
- [x] **17.3** `GET /api/invitations?workspace_id=X` — lista pendientes + enviadas
- [x] **17.4** `DELETE /api/invitations/[id]` — revocar invitación
- [x] **17.5** Page `/invite/[token]` — landing pública: valida token/expiry, muestra workspace+rol, client component maneja PKCE+implicit auth flows
- [x] **17.6** `POST /api/invitations/accept` — marca accepted_at + upsert workspace_id+role en users table + valida email match
- [x] **17.7** Settings → Members → botón "Invitar por email" — modal con email+role, tabla pendientes con "Copiar link"/"Revocar"
- [x] **17.8** Email template (Resend) con branding minimalista — HTML inline en POST route

#### 17.B — Email auth (Supabase native)
- [x] **17.9** Login page: toggle "Email / Teléfono" — email usa `signInWithOtp({ email })`
- [x] **17.10** Trigger `handle_new_auth_user` hardened: SET search_path=public, EXCEPTION block, soporta email signups (migration 16)
- [ ] **17.11** DIFERIDO: Lookup email aliases — requiere `user_emails` table (17.C)

#### 17.C — Multi-identity — DIFERIDO (CMP tiene 21 users, 1 email cada uno)
- [ ] **17.12** Migration: `user_emails` table + UNIQUE(email) global + RLS
- [ ] **17.13** Seed: copiar `users.email` actuales a `user_emails` con `is_primary=true, verified_at=now()`
- [ ] **17.14** Settings → Profile → tab "Correos": lista + agregar nuevo email (envía verificación) + marcar primario + eliminar
- [ ] **17.15** `POST /api/user-emails` — agrega email pendiente, dispara OTP de verificación
- [ ] **17.16** `POST /api/user-emails/[id]/verify` — marca verified_at, permite login desde este alias

#### 17.D — Session + trusted device — DIFERIDO (optimización UX, no crítico)
- [ ] **17.17** Supabase dashboard config: refresh token 90 días (documentar en plan, no código)
- [ ] **17.18** Migration: `user_trusted_devices` table + RLS
- [ ] **17.19** Cliente: generar device_id (UUID) en primer login, guardar en localStorage
- [ ] **17.20** `POST /api/auth/trust-device` — registra device_id + user agent + IP + label legible
- [ ] **17.21** `POST /api/auth/trusted-check` — si (device_id, user_email) matchea → emite JWT directo sin OTP
- [ ] **17.22** Login UI: checkbox "Recordar este dispositivo por 1 año"
- [ ] **17.23** Settings → Profile → tab "Dispositivos": lista trusted devices con last_seen + botón revocar
- [ ] **17.24** Middleware: auto-extend trusted device (sliding window) cada vez que se usa

#### 17.E — Cost monitoring — DIFERIDO (admin nicety, no bloquea nada)
- [ ] **17.25** Tabla `auth_events (user_id, method, cost_estimate, created_at)` — log de cada OTP enviado
- [ ] **17.26** Settings → Workspace → "Uso de auth" — total OTP este mes + estimado mensual

### Verificación
- [x] Admin invita 3 users por email → reciben email con link → aceptan → aparecen en Members
- [ ] DIFERIDO: User con 2 emails registrados → login con cualquiera de los dos → mismo account
- [ ] DIFERIDO: User marca "Recordar device" → cierra sesión → reabre → entra directo sin OTP
- [ ] DIFERIDO: User revoca trusted device desde Settings → next login pide OTP
- [ ] DIFERIDO: Métrica: contar OTP enviados antes vs después → reducción ≥70%

---

## Fase 17.5 — Performance & Code Consolidation ✅ CLOSED (2026-04-20)

**Goal:** App más rápida, menos código, mismas features. Zero regresiones. Mantenibilidad, velocidad, inteligencia y minimalismo.

**Contexto del audit (23,058 LOC, 131 archivos, 56 API routes):**
- 4 megafiles >1,000 LOC (SubItemsView 1,942 · ColumnSettingsPanel 1,910 · BoardView 1,208 · settings/boards/[boardId] 1,052)
- `@tanstack/react-virtual` instalado pero **NO USADO** — tabla renderiza TODOS los rows en DOM
- 7 indexes de DB faltantes en FKs frecuentes (board_columns, board_stages, users, teams, territories, sub_item_columns, column_permissions)
- Zero lazy loading — modales pesados (~2,900 LOC) importados eagerly en BoardView
- N+1 waterfall en refColsMeta — fetches secuenciales por board en vez de paralelos
- ~3,000 funciones inline recreadas por render en GenericDataTable (1 por celda visible)
- Boilerplate duplicado: board verification (~20 routes), position increment (~10 routes), fetch+loading pattern (~7 components)
- Auth profile resolution duplicada en 2 archivos (~30 LOC × 2)

### Sprint 1 — Speed (máximo impacto, mínimo riesgo)

#### 17.5.1 — DB indexes en FKs frecuentes
- [x] **17.5.1** Migration nueva: 7 `CREATE INDEX` en `board_columns(board_id)`, `board_stages(board_id)`, `users(workspace_id)`, `teams(workspace_id)`, `territories(workspace_id)`, `sub_item_columns(board_id)`, `column_permissions(column_id)`

#### 17.5.2 — Virtual scrolling en GenericDataTable
- [x] **17.5.2** Activar `useVirtualizer` de `@tanstack/react-virtual` (ya instalado) en `GenericDataTable.tsx` — solo renderizar filas visibles en viewport (~25-30 rows). Mantener API de props existente intacta (columns[], rows[], onCellChange). De ~3,000 nodos DOM a ~400.

#### 17.5.3 — Lazy load modales pesados
- [x] **17.5.3** En `BoardView.tsx`: reemplazar imports directos de `SubItemViewWizard`, `SourceColumnMapper`, `ImportWizard`, `ColumnSettingsPanel` por `next/dynamic` con `ssr: false`. Se cargan solo cuando su flag `show*` es true. ~40% menos JS parseado en carga inicial del board.

#### 17.5.4 — Parallel ref column fetches
- [x] **17.5.4** En `BoardView.tsx` useEffect de refColsMeta (~línea 461): reemplazar loop secuencial por `Promise.all` — fetch items Y columns de todos los target boards en paralelo. Con 3 boards referenciados, latencia /3.

### Sprint 2 — Re-renders (segundo mayor impacto)

#### 17.5.5 — useCallback estable en celdas de tabla
- [x] **17.5.5a** `GenericDataTable.tsx` (~línea 220): extraer handlers de celda (`onStartEdit`, `onCommit`, `onCancel`, `onNavigate`) a `useCallback` parametrizados por rowId/colId en vez de inline arrows por celda. Elimina ~3,000 funciones recreadas por render.
- [x] **17.5.5b** `BoardView.tsx` (~línea 1005): `renderRowExpansion` y callbacks `onCountChange`, `onDeleteView`, `onConfigureColumns` a `useCallback`. `handleCellChange` NO debe depender de `rows` — usar `useRef` para `rawItems`.

#### 17.5.6 — Singleton Supabase client en effects
- [x] **17.5.6** `BoardView.tsx`: extraer `createClient()` a `useMemo(() => createClient(), [])` al top del componente. Reusar en ambos useEffects de realtime (items + schema). Elimina instancias duplicadas.

### Sprint 3 — Code reduction (~720 LOC eliminados)

#### 17.5.7 — Custom hooks compartidos
- [x] **17.5.7a** Crear `hooks/useAsyncData.ts`: `useAsyncData<T>(url, deps)` → `{ data, loading, error, reload }`. Reemplazar patrón fetch+useState+useEffect en 7+ componentes.
- [x] **17.5.7b** Crear `hooks/useDisclosure.ts`: `useDisclosure(initial?)` → `{ isOpen, open, close, toggle }`. Reemplazar 15+ pares `[show*, setShow*]` across codebase.
- [x] **17.5.7c** Crear `hooks/useClickOutside.ts`: `useClickOutside(ref, handler)`. Extraer de BoardView y reusar en popups.

#### 17.5.8 — API route helpers compartidos
- [x] **17.5.8** Crear `lib/api-helpers.ts` con:
  - `verifyBoardAccess(supabase, boardId, workspaceId)` → board | NextResponse 404 (usado en ~20 routes)
  - `getNextPosition(supabase, table, filterCol, filterVal)` → number (usado en ~10 routes)
  - `jsonError(message, status)` → NextResponse (usado en ~40 routes)
  - `jsonOk(data?, status?)` → NextResponse
  Refactorizar las rutas existentes para usar estos helpers. ~300 LOC eliminados.

#### 17.5.9 — Consolidar permission routes
- [x] **17.5.9** Extraer `lib/column-permissions-handler.ts` con lógica compartida de GET/POST/DELETE permissions para `column_id` y `sub_item_column_id`. Los 4 archivos de routes (392 LOC total) llaman al handler con su FK respectivo. Target: ~200 LOC eliminados.

#### 17.5.10 — Deduplicar auth profile resolution
- [x] **17.5.10** Crear `lib/auth/resolve-profile.ts` con función `resolveUserProfile(userId, phone?)` compartida. Refactorizar `lib/auth/api.ts` y `lib/auth/index.ts` para usarla. Incluye phone normalization (withPlus/withoutPlus). ~30 LOC eliminados.

#### 17.5.11 — Remove type duplication
- [x] **17.5.11** Borrar definición duplicada de `SubItemColumn` en `SourceColumnMapper.tsx`. Importar de `@/lib/boards`.

### Verificación

- [x] `npm run build` pasa sin errores (73+ rutas verde)
- [x] Board con 200+ items: scroll fluido (virtual scrolling activo, <30 rows en DOM)
- [x] Abrir board con ref columns: fetches paralelos vía `Promise.all`
- [x] Abrir ColumnSettingsPanel: chunk se carga on-demand (next/dynamic)
- [x] Crear/editar/borrar items: sin regresiones (build verde, código estable desde 6c59785)
- [x] Permisos: column_permissions siguen funcionando (lib/column-permissions-handler.ts)
- [ ] Lighthouse Performance score mejora vs baseline (medir antes y después) — PENDIENTE (no crítico)

### Decisiones de diseño

1. **No splitear megafiles ahora** — SubItemsView/ColumnSettingsPanel/BoardView son grandes pero funcionales. El speed fix real es virtual scrolling + lazy load, no reorganizar archivos. Si después de Sprint 1+2 sigue lento, evaluar split como Sprint 4.
2. **No agregar global state** — prop drilling funciona. El fix es memoización (useCallback/useMemo), no indirection (context/zustand).
3. **No consolidar API routes en una ruta genérica** — 56 archivos separados es zero overhead en runtime. La claridad por archivo supera el ahorro de LOC.
4. **No squash migrations** — es cleanup de DX, no optimización. Hacerlo después si el equipo crece.

---

## Fase 18 — Document Templates + Opinionated Graph ✅ CLOSED (2026-04-21)

**Goal:** Sistema de plantillas de documentos (más fácil que Eledo) + system board `cotizaciones` (quotes) como pipeline + **knowledge graph conectado por defecto** entre system boards. Tratto NO es Monday: viene opinionado out-of-the-box — oportunidades ya traen sub-items de catálogo + cotizaciones, contactos muestran sus oportunidades/cotizaciones, etc. Killer feature del template: `repeat` block con imagen por sub-item (producto con foto + desc + precio). Firma estampa PDF y dispara re-render.

### Stack
- **PDF:** `@react-pdf/renderer` (pure JS, sin chromium, `runtime='nodejs'`)
- **Editor:** custom block list + `@dnd-kit/sortable` — cada block es un form, slash-menu `/` solo en text/heading blocks
- **Storage:** Supabase storage buckets `documents` + `signatures` (auto-created on first use, public)
- **Firma externa:** diferida (backlog — solo users registrados en v1)
- **Re-generar:** crea item nuevo en board `documents` (v2 = distinto, no reemplaza)

### Modelo de datos
```sql
document_templates (id, sid, workspace_id, name, target_board_id, body_json,
                    style_json, signature_config, pre_conditions, folio_format,
                    status, created_by, created_at, updated_at)
document_audit_events (id, document_item_id, workspace_id, event_type,
                       actor_id, metadata, created_at)
documents system board (auto-seeded):
  columns: name, template_id, source_item_id, pdf_url, folio, status,
           signatures, generated_by, + 3 system cols
```

### Block types v1 (11)
`heading` · `text` · `field` · `image` · `columns` · `spacer` · `divider` · `repeat` · `subitems_table` · `total` · `signature`

`{{col_key}}` placeholders resueltos por `lib/document-blocks/resolver.ts`. Formatters: `date` · `datetime` · `money` · `number` · `percent` · `relative` · `upper` · `lower`. Scope switching dentro de `repeat`: `{{col_key}}` apunta al item iterado, `{{parent.col_key}}` escapa al root.

### Tareas
- [x] **18.1** Migration `20260420000001_document_templates.sql`: `document_templates` + `document_audit_events` + extensión `seed_system_boards` con board `documents`
- [x] **18.2** `lib/document-blocks/types.ts` — 11 block types + `RenderContext` + `DocumentMeta` (173 LOC)
- [x] **18.2** `lib/document-blocks/resolver.ts` — `formatValue`, `resolveField`, `resolveTemplate`, `withRepeatScope` (196 LOC)
- [x] **18.3** `lib/document-blocks/pdf-renderer.tsx` — `DocumentPdf` component, blocks → `@react-pdf/renderer` primitives (442 LOC)
- [x] **18.4** `lib/document-blocks/html-preview.tsx` — `DocumentHtmlPreview` para preview live en editor (438 LOC)
- [x] **18.5** Template editor page `/app/w/[workspaceSid]/settings/boards/[boardId]/templates/[tplId]` — layout 3-panel (palette | canvas | preview) con auto-save debounced
- [x] **18.5** `sample-context.ts` — `buildSampleContext()` genera RenderContext con datos dummy para preview
- [x] **18.6** `components/templates/BlockCanvas.tsx` — dnd-kit sortable con expand/collapse inline de editores
- [x] **18.6** `components/templates/BlockPalette.tsx` — sidebar con 11 botones + defaults
- [x] **18.7** `components/templates/blocks/*.tsx` — 11 editores (uno por block type) con forms inline
- [x] **18.8** `components/templates/SlashMenu.tsx` + hook `useSlashMenu` — popover de fields en text/heading blocks
- [x] **18.9** `lib/document-blocks/validator.ts` — `validatePreConditions()` con scope root/sub_items_all/sub_items_any + `extractUsedColKeys()`
- [x] **18.10** `POST /api/documents/generate` — valida → render PDF server-side → upload storage → crea item en `documents` board + audit event
- [x] **18.10** `GET /api/documents?source_item_id=X` — lista docs generados desde un item
- [x] **18.10** `/api/document-templates` CRUD (GET/POST) + `/api/document-templates/[id]` (GET/PATCH/DELETE) — solo workspace admin o board admin del target puede escribir
- [x] **18.11** `ButtonCell` action `'generate_document'`: POST generate + open PDF in new tab + dispatch `document-generated` event; pre-condition errors mostrados inline
- [x] **18.11** `ColumnSettings.action` union extendido con `'generate_document'`
- [x] **18.12** `POST /api/documents/[id]/sign` — decode base64 → upload signature image → re-render PDF con firma stampada → update item pdf_url + signatures; status → 'signed' si todas las required ya firmadas
- [x] **18.12** `components/templates/SignatureDrawModal.tsx` — canvas HTML5 para dibujar firma (mouse + touch), POST sign
- [x] **18.13** `DocumentsTab` en `ItemDetailView` — tab "Documentos" lista docs del item con folio + status + "Ver PDF" / "Firmar" / "Eliminar" buttons; listens `document-generated`/`document-signed` events

### Fase 18.5 — Opinionated Knowledge Graph (2026-04-21)
- [x] **18.5.1** Migration `20260421000001_quotes_opinionated_graph.sql`: wipe CMP + rewrite `seed_system_boards` + re-seed
- [x] **18.5.2** System board rename: `documents` → `quotes`, slug `cotizaciones`, name `Cotizaciones`, type `pipeline` con stages (Borrador/Enviada/Pendiente firma/Firmada/Anulada)
- [x] **18.5.3** Quotes columns redesign: `name` + `stage` (primary_stage) + `oportunidad` (rel→opps) + `contacto` (rel→contacts) + `institucion` (rel→accounts) + `monto` + `pdf_url` + `folio` + `signatures` + `template_id` + `generated_by`. Dropped `source_item_id` + `status` (reemplazados por relations + stages)
- [x] **18.5.4** Default sub_item_views auto-seeded per board:
  - Oportunidades: Catálogo (native con source=catalog) + Cotizaciones (board_items via oportunidad rel)
  - Contactos: Oportunidades + Cotizaciones (board_items via contacto rel en ambos)
  - Instituciones: Contactos + Oportunidades + Cotizaciones (board_items via institucion rel)  *(later: 2026-04-22 sesión 5 → display "Cuentas", solo view Contactos; cotizaciones/opps ya no linkean cuenta directa)*
  - Catálogo: Variantes (native L2)
  - Cotizaciones: terminal (sin sub-views)
- [x] **18.5.5** Rename `accounts` → "Instituciones" (display name; `system_key='accounts'` inmutable); slug='instituciones'  *(later renombrado a "Cuentas", slug='cuentas' en sesión 5 2026-04-22)*
- [x] **18.5.6** Catálogo columns por defecto: `name` + `descripcion` + `foto` (file) + `unit_price` (currency) + `owner`
- [x] **18.5.7** Default template "Cotización estándar" auto-seeded via `document_templates` (heading + field contacto/institucion + repeat sub_items con columns image+heading+text+field unit_price + total monto + 2 signatures cliente/vendedor)
- [x] **18.5.8** Button column "Generar cotización" auto-seeded en Oportunidades (kind='button', action='generate_document', template_id apunta al default template, confirm=true)

### Fase 18.6 — System boards no-borrables (2026-04-21)
- [x] **18.6.1** API `DELETE /api/boards/[id]` → 403 si `system_key IS NOT NULL` ("No se puede eliminar un board de sistema")
- [x] **18.6.2** UI settings → Boards lista: botón eliminar condicionado a `!board.system_key && isAdmin`

### Fase 18.7 — Code updates para quotes rename
- [x] **18.7.1** 3 rutas API (`/api/documents/generate`, `/api/documents/[id]/sign`, `/api/documents`): query `system_key='documents'` → `'quotes'`
- [x] **18.7.2** `/api/documents/generate` extendido: populate relations `oportunidad` (source opp UUID), `contacto` + `institucion` (copiados del source opp via item_values lookup), `monto` (number del source opp)
- [x] **18.7.3** Generate route: dropped `source_item_id` + `status` inserts (reemplazados por relations + stage_id)
- [x] **18.7.4** Sign route: dropped status column update logic

### Folio format
`folio_format` en template (ej `'COT-{YYYY}-{N}'`): `{YYYY}` → año actual, `{N}` → counter 0-padded 4 dígitos basado en count de docs previos con mismo `template_id`. `null` = sin folio.

### Verificación
- [x] Migration aplicada en remote, board `documents` existe en CMP workspace
- [x] `npx tsc --noEmit` pasa sin errores
- [x] `npm run build` genera 80+ rutas, incluye `/api/documents/generate`, `/api/documents/[id]/sign`, `/api/documents`, `/api/document-templates`, `/api/document-templates/[id]`, `/settings/boards/[boardId]/templates/[tplId]`
- [ ] Crear template con `repeat sub_items` + image col → PDF muestra 1 bloque por producto con foto real (verificación manual pendiente)
- [ ] Columns dentro de repeat → layout foto-izq texto-der en PDF (pendiente manual)
- [ ] Slash-menu en text block inserta chip `{{descripcion}}` (pendiente manual)
- [ ] Preview live refleja cambios al reordenar blocks (pendiente manual)
- [ ] 2x "Generar" → 2 items distintos en board `documents` (pendiente manual)
- [ ] Firmar → PDF re-renderizado con signature image embebida + audit event (pendiente manual)
- [ ] Pre-condition `total > 0` falla → muestra error inline, no genera (pendiente manual)

### Diferido (18.B backlog)
- Firma externa via magic link a email no-user
- Versiones explícitas (link v1↔v2↔v3 en UI)
- Multi-party signing flow con notificaciones automáticas
- Template style panel completo (font picker, color scheme)
- Preview "con item real" (dropdown de items del target_board)

---

## Fase 19 — Filter / Sort / Group (vistas configurables) ✅ CLOSED (2026-04-22)

**Goal:** Cada vista de un board guarda su propia configuración de filtros, ordenamiento y agrupación. Cliente renderiza en vivo, persistencia en `board_views.config` jsonb. Tipo Monday.

### Arquitectura de datos

```typescript
// board_views.config extends with:
type ViewConfig = {
  filters?: ViewFilter[]       // AND entre filtros
  sort?:    ViewSort[]         // ordenamiento multi-columna (prioridad por posición)
  group_by?: string            // col_key por el cual agrupar (null = sin agrupación)
}

type ViewFilter = {
  col_key:  string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains'
          | 'gt' | 'lt' | 'gte' | 'lte' | 'between'
          | 'is_empty' | 'is_not_empty' | 'in' | 'not_in'
  value:    string | number | string[] | [string|number, string|number] | null
}

type ViewSort = { col_key: string; dir: 'asc' | 'desc' }
```

### Client-side engine

`lib/view-engine.ts` — funciones puras:
- `applyFilters(rows, filters, columns)` — retorna subset filtrado
- `applySort(rows, sort)` — retorna rows ordenados (multi-col)
- `groupRows(rows, groupBy, columns)` — retorna `{ groupKey, groupLabel, rows[] }[]` (maneja buckets por tipo de columna: select/stage = value, date = day/week/month, number = ranges opcionales, text = first-char opcional)

Todo vive en cliente. Backend no cambia (por ahora — si el board crece a >5k items, se mueve a query).

### UI — Toolbar de BoardView

3 botones nuevos al lado de "+ Nuevo" en el toolbar:
- **Filtrar** — badge con count si hay filtros activos. Click → popover con filas editables.
- **Ordenar** — badge con count. Click → lista reorderable de sorts.
- **Agrupar** — click → dropdown con columnas groupables (select/stage/people/date).

Los tres persisten en `view.config` vía PATCH `/api/boards/[id]/views/[viewId]`.

### Grouping en la tabla

`GenericDataTable` recibe prop opcional `groups?: { key, label, rows }[]`. Cuando se pasa:
- Renderiza cada grupo como sub-header colapsable con count + footer de agregados del grupo
- Sub-header color/label según tipo de columna (stage usa color de la etapa, select usa option color, etc.)
- Empty group (0 rows) se oculta por default

### Tareas

#### 19.A — Engine client-side
- [x] **19.1** `lib/view-engine.ts` — `applyFilters`, `applySort`, `groupRows` (11 operators, multi-col sort, option-order-aware grouping)
- [x] **19.2** Types en `components/data-table/types.ts`: `ViewFilter`, `ViewSort`, `ViewConfig`, `GroupedRows`, `DateBucket`
- [x] **19.3** `dateBucketKey(iso, 'day'|'week'|'month')` helper exportado para reuse en panels

#### 19.B — Persistencia
- [x] **19.4** Migration `20260422000012_board_views_config.sql` (`config jsonb`) + `PATCH /api/boards/[id]/views/[viewId]` acepta `config`
- [x] **19.5** `BoardView` lee `activeView.config` → `processedRows` (applyFilters → applySort) → `groupedRows` (si `group_by`)

#### 19.C — UI paneles
- [x] **19.6** `FilterPanel.tsx` — operators filtrados por kind, value input dinámico (text/number/date/select/people/boolean/between dual input)
- [x] **19.7** `SortPanel.tsx` — lista con ↑/↓ swap, dir toggle ASC/DESC, prioridad 1./2./3.
- [x] **19.8** `GroupPanel.tsx` — columnas groupables + DateBucket picker (Día/Semana/Mes) inline cuando kind=date
- [x] **19.9** 3 botones toolbar de BoardView (Filtrar/Ordenar/Agrupar) con badges activos + estado brand cuando popover abierto

#### 19.D — Grouping render
- [x] **19.10** `GenericDataTable` acepta `groups?: GroupedRows[]` — headers colapsables con count + color dot (stage/option color)
- [x] **19.11** `groupedStorageKey` → persist colapsos en `localStorage` por vista
- [ ] **19.12** DIFERIDO: agregados footer por grupo (reusa rollup_config) — no crítico para MVP

#### 19.E — UX niceties
- [x] **19.13** Badge numérico junto al label del botón cuando hay filtros/sorts activos (cumple el intento del chip compacto)
- [x] **19.14** Botón "Limpiar" en FilterPanel + SortPanel; GroupPanel incluye "Sin agrupación" como reset
- [ ] **19.15** DIFERIDO: Filter/Sort/Group en sub-items — SubItemsView tiene renderers custom (no GenericDataTable), implica wiring aparte

---

## Fase 20 — Tratto AI Agent + Sidebar Chat

**Goal:** Engine de IA compartido que corre idéntico en sidebar web, WhatsApp, y futura app móvil. El transporte cambia; el agente no.

### Arquitectura: un engine, múltiples transportes

```
┌─────────────┐   ┌──────────────┐   ┌─────────────────┐
│ Sidebar Web │   │  WhatsApp    │   │   App Móvil     │
│ (streaming) │   │  (Twilio)    │   │  (texto plano)  │
└──────┬──────┘   └──────┬───────┘   └────────┬────────┘
       │                 │                    │
       ▼                 ▼                    ▼
┌──────────────────────────────────────────────────────┐
│              POST /api/chat  (transport adapter)      │
│         supabase/functions/twilio-webhook             │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│           lib/tratto-agent/agent.ts                   │
│   Claude API · tool_use · agentic loop               │
│   Input: { userId, workspaceId, message, history }   │
│   Output: { text, toolCalls[] }  (streaming o batch) │
└──────────────────────────┬───────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   lib/tratto-agent/tools/      lib/tratto-agent/context.ts
   (cada tool = 1 archivo)      (system prompt + snapshot)
```

**Principio clave:** `agent.ts` no sabe si está en sidebar o WA. Solo recibe `{ userId, message, history[] }` y devuelve `{ text, toolCalls[] }`. El adapter de cada transporte decide cómo entregar la respuesta.

---

### lib/tratto-agent/ — estructura

```
lib/tratto-agent/
  agent.ts          → loop principal: Claude API → herramientas → respuesta
  types.ts          → AgentInput, AgentOutput, TrattoTool, ToolResult, ChatMessage
  context.ts        → buildSystemPrompt(user, workspace, currentBoard?)
  session.ts        → loadHistory(sessionId) / appendMessage(sessionId, msg)
  tools/
    index.ts        → TRATTO_TOOLS: Tool[] — registro de todas las tools
    search-items.ts
    get-item.ts
    create-item.ts
    update-item.ts
    change-stage.ts
    add-message.ts
    list-boards.ts
    get-board-summary.ts
```

---

### Tools del agente

| Tool | Input | Qué hace |
|------|-------|----------|
| `search_items` | `{ query?, board_key?, stage?, owner_me?, overdue?, limit }` | Busca items; responde con sid, nombre, etapa, owner |
| `get_item` | `{ item_sid }` | Detalle completo: columnas + valores + sub-items count |
| `create_item` | `{ board_key, name, stage_name?, owner_sid?, values? }` | Crea item; retorna sid |
| `update_item` | `{ item_sid, values: Record<col_key, value> }` | Actualiza columnas custom |
| `change_stage` | `{ item_sid, stage_name }` | Mueve etapa; respeta stage gates |
| `add_message` | `{ item_sid, text }` | Postea en canal "General" del item |
| `list_boards` | `{}` | Lista boards del workspace con system_key y tipo |
| `get_board_summary` | `{ board_key, group_by?: 'stage', sum_col?: col_key }` | Conteo por etapa + suma de columna numérica (ej: valor, monto); respeta restrict_to_own automáticamente |

**Reglas de tools:**
- Todas usan `createServiceClient()` pero validan `workspace_id` del usuario — nunca escapan del tenant
- Errores descriptivos en español: el agente los incluye en la respuesta
- `change_stage` evalúa stage gates igual que `ButtonCell` — si hay validaciones bloqueantes, retorna error con lista de columnas fallidas

---

### Schema DB — sesiones de chat

```sql
-- Migration nueva (sin afectar tablas existentes)
chat_sessions (
  id uuid PK DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  transport text NOT NULL,   -- 'sidebar' | 'whatsapp' | 'mobile'
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
)

chat_messages (
  id uuid PK DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,        -- 'user' | 'assistant' | 'tool_result'
  content text NOT NULL,
  tool_calls jsonb,          -- tool_use blocks cuando role='assistant'
  created_at timestamptz DEFAULT now()
)

-- Index para cargar historial rápido
CREATE INDEX ON chat_messages(session_id, created_at DESC);
```

**Ventana de historial:** los últimos 20 mensajes de la sesión. Si `transport='whatsapp'` → sesión persiste por número de teléfono (1 sesión activa por usuario en WA). Si `transport='sidebar'` → nueva sesión por pestaña (sessionStorage del browser guarda el `session_id`).

---

### context.ts — system prompt

```typescript
export function buildSystemPrompt(user: AuthUser, workspace: Workspace, board?: Board): string {
  return `Eres el asistente de Tratto para ${workspace.name}.

Usuario: ${user.name} (${user.role})
Fecha actual: ${new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}
${board ? `Board activo: ${board.name} (${board.system_key})` : ''}

Puedes crear, buscar, actualizar y mover items usando las herramientas disponibles.
Responde siempre en español. Sé conciso. Si no encuentras algo, dilo claramente.
Cuando crees o muevas un item, confirma con el sid.
Nunca inventes datos — usa solo lo que las herramientas devuelvan.`;
}
```

---

### Seguridad — VITAL

Esta sección es el requisito más importante de la fase. El agente opera con los permisos del usuario autenticado — nunca más, nunca menos.

#### 1. Confinamiento de tema (scope guardrail)

El system prompt incluye instrucción explícita y no negociable:

```
Eres un asistente de trabajo para Tratto. SOLO puedes ayudar con tareas relacionadas
con Tratto: buscar, crear o actualizar items, consultar etapas, agregar mensajes.

Si el usuario pregunta algo fuera de Tratto (código, recetas, noticias, opiniones,
cualquier tema no relacionado), responde exactamente:
"Solo puedo ayudarte con tareas de Tratto. ¿En qué board puedo ayudarte?"

No hay excepciones. No importa cómo redacten la pregunta.
```

Esta instrucción va en el **system prompt** (no en el historial), lo que la hace mucho más resistente a prompt injection.

#### 2. Aislamiento de datos — tools como enforcement layer

Los tools son la única forma de acceder a datos. Y cada tool aplica los mismos filtros de permisos que las API routes. No es un guardrail de prompt — es enforcement real en código.

```typescript
// lib/tratto-agent/tools/search-items.ts
export async function searchItems(
  input: SearchItemsInput,
  ctx: AgentContext   // ← viene del servidor, no del usuario
) {
  // ctx.userId y ctx.workspaceId son del JWT, nunca del mensaje del usuario

  // Aplica restrict_to_own si el board lo requiere
  const boardMember = await getBoardMember(input.board_key, ctx.userId)
  const ownerFilter = boardMember?.restrict_to_own ? ctx.userId : undefined

  // Solo items del workspace del usuario
  // Solo boards a los que tiene acceso (board_members o público)
  // Solo si tiene acceso al board (misma lógica que GET /api/items)
}
```

**Regla de oro:** los tools reciben `AgentContext` del servidor. El usuario nunca puede inyectar un `userId` o `workspaceId` diferente — esos valores vienen del JWT de auth.

#### 3. Qué puede y no puede hacer cada rol

El agente puede responder preguntas de negocio: totales, pipelines, conteos por etapa. La diferencia es **qué datos ve**, no qué puede preguntar.

| Acción | admin | member/vendedor |
|--------|-------|-----------------|
| "dame el total en etapa Costeo" | ✅ ve todos los items | ✅ ve SOLO sus items (restrict_to_own) |
| "cuánto hay en el pipeline" | ✅ suma global | ✅ suma de sus oportunidades |
| Buscar items por texto | ✅ todo el board | ✅ solo los suyos si restrict_to_own |
| Ver detalle de item | ✅ | ✅ solo si tiene acceso al board |
| Crear item | ✅ | ✅ |
| Actualizar columnas | ✅ | ✅ si tiene edit en column_permissions |
| Cambiar etapa | ✅ | ✅ respeta stage gates |
| Agregar mensaje a canal | ✅ | ✅ |

**El filtrado es transparente:** un vendedor que pregunta "cuánto hay en el pipeline" recibe el total de SU pipeline, sin saber que hay más. No se le dice "no puedes ver el total global" — simplemente el tool aplica `owner_id = ctx.userId` si `restrict_to_own=true`. El dato es correcto para él.

**Admin puede preguntar el panorama completo:**
```
Admin: "dame el total de oportunidades en etapa Costeo"
→ tool get_board_summary({ board_key: 'opportunities', group_by: 'stage' })
→ { 'Costeo': { count: 12, total_value: 840000 } }
→ "Hay 12 oportunidades en Costeo por un total de $840,000"

Vendedor (restrict_to_own): misma pregunta
→ mismo tool, pero owner_id = userId del vendedor
→ { 'Costeo': { count: 3, total_value: 210000 } }
→ "Tienes 3 oportunidades en Costeo por $210,000"
```

Los tools no explican el motivo del filtro al usuario — simplemente aplican los permisos en silencio.

#### 4. Validación de inputs con Zod

Todos los tool inputs se validan con Zod antes de ejecutarse:

```typescript
const SearchItemsSchema = z.object({
  query: z.string().max(200).optional(),
  board_key: z.string().max(50).optional(),
  stage: z.string().max(100).optional(),
  owner_me: z.boolean().optional(),
  overdue: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).default(10),
})
```

Si Claude genera un tool input que no pasa Zod → el tool retorna error de validación → Claude lo incluye en su respuesta sin ejecutar nada.

#### 5. Límites de input

```typescript
// Antes de llamar runAgent():
if (message.length > 500) {
  return { error: 'Mensaje muy largo. Máximo 500 caracteres.' }
}
// Previene context stuffing y prompt injection extenso
```

#### 6. Audit trail completo

Cada tool call queda en `chat_messages.tool_calls` (jsonb):

```json
{
  "tool": "create_item",
  "input": { "board_key": "opportunities", "name": "Empresa XYZ" },
  "output": { "sid": 10000290 },
  "executed_at": "2026-04-14T10:23:00Z"
}
```

Admins pueden ver qué hizo el agente en nombre de cada usuario en Settings → Workspace → tab "Asistente IA".

---

### API route — POST /api/chat (sidebar, streaming)

```typescript
// app/api/chat/route.ts
// Input:  { message: string, sessionId?: string, boardSid?: string }
// Output: SSE stream — eventos: { type: 'text' | 'tool_call' | 'done', payload }

// Flujo:
// 1. requireAuthApi() → user + workspaceId
// 2. loadOrCreateSession(userId, workspaceId, 'sidebar', sessionId)
// 3. appendMessage(sessionId, { role: 'user', content: message })
// 4. runAgent({ userId, workspaceId, message, history, boardSid }) → stream
// 5. Por cada chunk del stream → envía SSE event al cliente
// 6. Al finalizar → appendMessage(sessionId, { role: 'assistant', content, toolCalls })

// Streaming via ReadableStream + TransformStream
// El cliente recibe eventos SSE: text delta, tool_call indicators, done
```

---

### Sidebar UI

```
Header de Tratto:
  [logo] [boards...] [···]  [💬 Asistente]  ← botón toggle

Panel (drawer derecho, 400px, z-50, blur backdrop):
  ┌─────────────────────────────────────┐
  │ Asistente Tratto        [×]         │
  ├─────────────────────────────────────┤
  │                                     │
  │  [burbujas de conversación]         │
  │                                     │
  │  🔧 Buscando items...  ← tool indicator
  │                                     │
  ├─────────────────────────────────────┤
  │ [textarea      ] [↑ Enviar]         │
  └─────────────────────────────────────┘

Comportamiento:
  - Enter envía, Shift+Enter = newline
  - Tool calls muestran spinner + nombre del tool ("Creando item...")
  - Respuestas streameadas carácter a carácter
  - Board actual inyectado automáticamente en contexto
  - Scroll to bottom automático en mensajes nuevos
  - Historial persiste en la sesión (sessionStorage para session_id)
```

---

### Tareas

#### 20.A — Engine core
- [ ] **20.1** Migration: `chat_sessions` + `chat_messages` + índice
- [ ] **20.2** `lib/tratto-agent/types.ts`: `AgentInput`, `AgentOutput`, `ChatMessage`, `TrattoTool`, `ToolResult`, tipos para cada tool input/output
- [ ] **20.3** `lib/tratto-agent/context.ts`: `buildSystemPrompt(user, workspace, board?)` — inyecta fecha MX, usuario, board activo
- [ ] **20.4** `lib/tratto-agent/session.ts`: `loadOrCreateSession()`, `loadHistory(sessionId, limit=20)`, `appendMessage()` — usa serviceClient
- [ ] **20.5** `lib/tratto-agent/tools/search-items.ts`: tool `search_items` — query full-text + filtros (board_key, stage, owner_me, overdue); retorna array con sid, name, stage, owner, deadline
- [ ] **20.6** `lib/tratto-agent/tools/get-item.ts`: tool `get_item` — fetch item por sid + valores de columnas + count sub-items
- [ ] **20.7** `lib/tratto-agent/tools/create-item.ts`: tool `create_item` — `POST /api/items` internamente; resuelve board_key→board_id, stage_name→stage_id
- [ ] **20.8** `lib/tratto-agent/tools/update-item.ts`: tool `update_item` — `PUT /api/items/[id]/values`; acepta `Record<col_key, value>`
- [ ] **20.9** `lib/tratto-agent/tools/change-stage.ts`: tool `change_stage` — evalúa stage gates antes de ejecutar; retorna error descriptivo si bloquea
- [ ] **20.10** `lib/tratto-agent/tools/add-message.ts`: tool `add_message` — postea en canal General del item
- [ ] **20.11** `lib/tratto-agent/tools/list-boards.ts` + `get-board-summary.ts`: tools de consulta de boards
- [ ] **20.12** `lib/tratto-agent/tools/index.ts`: `TRATTO_TOOLS` — array con `name`, `description`, `input_schema` para cada tool (formato Anthropic tool_use)
- [ ] **20.13** `lib/tratto-agent/agent.ts`: loop principal — `runAgent(input: AgentInput)` → llama Claude API con `tool_use`, ejecuta tools en loop hasta `stop_reason='end_turn'`, retorna `AgentOutput`; soporta modo streaming y batch

#### 20.B — Transport sidebar (web)
- [ ] **20.14** `app/api/chat/route.ts`: endpoint POST, SSE streaming — `requireAuthApi()`, carga sesión, llama `runAgent()` en modo stream, envía eventos `{ type: 'text_delta' | 'tool_start' | 'tool_end' | 'done' }`
- [ ] **20.15** `components/ChatPanel.tsx`: drawer derecho 400px, toggle desde header, burbujas user/assistant, streaming render, indicadores de tool calls, scroll automático
- [ ] **20.16** `hooks/useChat.ts`: maneja SSE stream, estado de mensajes, `sessionId` en sessionStorage, función `sendMessage(text)`
- [ ] **20.17** Integrar `<ChatPanel>` en layout principal — botón en header, contexto del board activo pasado como prop

#### 20.C — Verificación
- [ ] "busca oportunidades de Juan que estén en propuesta" → lista correcta
- [ ] "crea un contacto llamado María García, teléfono 5512345678" → item creado, responde con sid
- [ ] "mueve la oportunidad 10000150 a Ganado" → respeta stage gates; si falla, explica qué columnas bloquean
- [ ] Tool indicators visibles durante ejecución ("Buscando items en Oportunidades...")
- [ ] Historial persiste al navegar entre boards (sessionStorage)
- [ ] Mismo `runAgent()` funciona en modo batch (sin stream) para WhatsApp adapter

---


## Fase 21 — WhatsApp Integration

**Goal:** WhatsApp como transporte adicional del mismo engine de Fase 20. Zero código de IA nuevo — solo adapter Twilio → `runAgent()`.

### Arquitectura

```
Twilio WA → Edge Function twilio-webhook
              ↓
           Identifica usuario por phone
           Carga/crea chat_session (transport='whatsapp')
           Llama runAgent() en modo BATCH (sin stream)
              ↓
           Respuesta texto → sendWhatsApp(phone, text)
```

### Flujos principales

```
1. Vendedor crea item desde WA:
   "agregar oportunidad: Empresa XYZ, $50k, etapa propuesta"
   → runAgent() → tool create_item → "Listo. Oportunidad creada: sid 10000290"

2. Vendedor consulta desde WA:
   "qué tengo pendiente hoy"
   → runAgent() → tool search_items(owner_me, overdue) → lista formateada

3. Respuesta a mención:
   Canal: "@Juan revisa el contrato"
   → Juan recibe WA → responde desde WA → tool add_message → mensaje en canal

4. Digest diario (8:30 AM MX):
   Items vencidos + menciones pendientes (query directa, sin agente)
```

### Tareas
- [ ] **21.1** Edge Function `twilio-webhook`:
  - Recibe mensaje WA entrante (Twilio signature verify)
  - Lookup usuario por `phone` en `users` (E.164)
  - Llama `runAgent({ userId, workspaceId, message, transport: 'whatsapp' })` en modo batch
  - Formatea respuesta para WA (sin markdown, máx 1600 chars)
  - `sendWhatsApp(phone, text)` vía `whatsapp-outbound`
- [ ] **21.2** Edge Function `mentions-trigger`:
  - Cron cada 2 min
  - Busca `mentions WHERE notified=false`
  - Envía WA con preview del mensaje + link al canal
  - Marca `notified=true`
- [ ] **21.3** Edge Function `daily-digest`:
  - Cron 8:30 AM America/Mexico_City
  - Query directa (sin agente): items overdue + items due today + menciones sin responder por usuario
  - Mensaje WA formateado
- [ ] **21.4** Edge Function `whatsapp-outbound`:
  - Sender genérico: `sendWhatsApp(phone, message)` via Twilio REST API
- [ ] **21.5** UI: Settings → Workspace → tab "WhatsApp"
  - Conectar número Twilio (webhook URL + auth token)
  - Test de envío manual
  - Log de `chat_messages` donde `session.transport='whatsapp'`

---

## Ideas incorporadas (vs versión anterior)

| # | Cambio | Impacto |
|---|--------|---------|
| 1 | `sid` en TODA entidad | `find_by_sid()` universal, WhatsApp bot busca cualquier cosa |
| 2 | `board_members` (user OR team) | Reemplaza `board_teams`, más flexible (personas individuales) |
| 3 | `column_permissions` | Visibilidad/edición por columna, estilo Monday |
| 4 | Board types simplificados | `pipeline` / `table` en vez de `crm` / `work` / `object` |
| 5 | No tablas contacts/accounts/vendors | Todo es un item, zero CRUD duplicado |
| 6 | Columna `relation` | Reemplaza FK físicos, configurable desde UI |
| 7 | `col_key` estable | Código referencia columnas sin hardcodear UUIDs |
| 8 | 1 agente secuencial | Sin GitButler, sin parallelismo, sin conflictos |

---

## Estimación

| Fase | Complejidad | Nota |
|------|------------|------|
| 0 | Media | 4 SQL files, fundamento de todo |
| 1 | Baja | Auth standard con Supabase |
| 2 | Baja | Layout + sidebar + API boards |
| 3 | **Alta** | LA fase crítica. Si la tabla está bien, todo es incremental |
| 4 | Media | Reutiliza cells de Fase 3 |
| 5 | **Alta** | Sub-items dinámicos + snapshot + fórmulas + source config |
| 6 | Media | Import ya probado, reutilizar diseño |
| 7 | Media | Channels + activity triggers |
| 8 | Media | Settings CRUD |
| 9 | Baja | SQL policies + frontend filtering |
| 10 | Alta | WhatsApp + PDF |

---

## Checklist pre-cada-fase

1. ✅ Fase anterior completa y probada
2. ✅ `npm run build` pasa sin errores
3. ✅ Commit limpio en main
4. ✅ Leer la fase completa antes de escribir código
5. ✅ Identificar si necesita migration nueva

---

## LATER — Ideas diferidas (no necesarias por ahora)

### Cross-board Automations

**Goal:** Trigger → Acción. Reemplazar los scenarios de Make que conectan boards.

#### Schema

```sql
automations (
  id uuid PK,
  workspace_id uuid,
  board_id uuid,          -- board donde vive la automation
  name text,
  is_active boolean DEFAULT true,
  trigger_type text,      -- ver tipos abajo
  trigger_config jsonb,   -- parámetros del trigger
  actions jsonb[],        -- array de acciones a ejecutar en orden
  created_at timestamptz
)
```

#### Triggers

| type | config | Descripción |
|---|---|---|
| `stage_changed` | `{ to_stage_id, from_stage_id? }` | Item cambia a/desde etapa |
| `item_created` | `{}` | Nuevo item en el board |
| `column_changed` | `{ column_id, to_value? }` | Columna cambia (opcionalmente a valor específico) |
| `button_clicked` | `{ button_column_id }` | Click en ButtonCell (Fase 11) |

#### Acciones

| type | params | Descripción |
|---|---|---|
| `change_stage` | `{ stage_id }` | Cambiar etapa del item |
| `set_column_value` | `{ column_id, value }` | Fijar valor de columna |
| `assign_owner` | `{ user_id \| 'trigger_user' }` | Asignar dueño |
| `notify_user` | `{ user_field \| user_id, message_template }` | Mensaje en canal Sistema |
| `create_quote` | `{ template_id }` | Genera cotización PDF |
| `cross_board_copy` | `{ target_board_id, field_mapping, copy_subitems, expand_variants }` | Crea item en otro board |
| `call_webhook` | `{ url, method, headers, body_template }` | HTTP request externo |

#### cross_board_copy — el caso Oportunidad → Proyecto

```typescript
{
  type: 'cross_board_copy',
  params: {
    target_board_id: 'proyectos_board_id',
    field_mapping: [
      { from_column: 'nombre', to_column: 'nombre' },
      { from_column: 'contacto', to_column: 'cliente' },
    ],
    copy_subitems: true,     // copiar L1 sub-items
    expand_variants: true,   // explotar L2 desde multiselect tallas
    link_column: 'oportunidad_relation_col'  // columna relation en Proyectos que apunta al item original
  }
}
```

#### Motor de automations

```typescript
// lib/automation-engine.ts
export async function runAutomations(event: AutomationEvent, supabase: SupabaseClient)

// AutomationEvent:
{ type: 'stage_changed' | 'item_created' | ..., item_id, board_id, workspace_id, payload }
```

Llamado desde API routes después de cada mutación relevante. No DB triggers — lógica en TypeScript, más fácil de debuggear.

**Anti-loop:** `automation_runs` table guarda `(automation_id, item_id, triggered_at)` — si la misma automation corrió para el mismo item en los últimos 5s, skip.

#### UI — Lista de recetas por board

Settings → Boards → tab "Automations":

```
┌──────────────────────────────────────────────────────┐
│  Cuando [etapa cambia a Ganado]                      │
│  Hacer  [crear item en Proyectos] + [generar PDF]    │
│                                          ✏️  🗑️      │
├──────────────────────────────────────────────────────┤
│  + Nueva automation                                  │
└──────────────────────────────────────────────────────┘
```

No canvas. Lista simple. Cada fila = 1 trigger + N acciones.

#### Tareas
- [ ] **A.1** Migration: `automations` + `automation_runs`
- [ ] **A.2** `lib/automation-engine.ts` — evaluador de triggers + ejecutor de acciones
- [ ] **A.3** Integrar `runAutomations()` en `PATCH /api/items/[id]` + `POST /api/items`
- [ ] **A.4** Implementar acción `cross_board_copy` (con copy_subitems + expand_variants)
- [ ] **A.5** UI: Settings → Boards → tab "Automations" (lista de recetas + editor)
- [ ] **A.6** ButtonCell con `action: 'run_automation'` (completar Fase 11.2)
## Fase 22 — Bidirectional Graph Editing

**Goal:** Cualquier relation col = edit bidireccional. Desde Oportunidad, click en el contacto → drawer lateral muestra TODAS las cols del contacto editables inline. Cambios escriben al source + revalidan optimísticamente en todas las vistas afectadas. Extiende ref cols / mirror (Fase 16.6) a UX de primera clase, no sólo lookup.

### Motivación
Knowledge graph real: los system boards están conectados por defecto (Fase 18.5). Pero si estás en una Oportunidad y necesitas corregir la institución del contacto, hoy tienes que navegar al board Contactos → buscar el contacto → editar → volver. Debería ser: click en el chip del contacto → drawer → edita → sigues donde estabas.

### Diseño
- `RelationCell` hover → chip visible. Click en chip (no double-click) → abre drawer lateral derecho.
- Drawer component nuevo `RelatedItemDrawer.tsx`:
  - Header: nombre del item relacionado + board origen (chip)
  - Body: todas las cols del target board (respetando column_permissions) renderizadas como info panel, cada una editable inline (reusa `ColumnCell`)
  - Link "Abrir en [board]" → navega al item completo
- Edits hacen PUT al item target via `/api/items/[id]/values` normal; optimistic update local
- Si el item está abierto en otra tab/view, realtime lo sincroniza (ya existe subscription en BoardView)
- `Esc` cierra, click fuera cierra

### Tareas
- [ ] **22.1** `components/RelatedItemDrawer.tsx` — drawer lateral fixed right, `w-[480px]`, animación slide-in
- [ ] **22.2** Fetch lazy al abrir: `GET /api/items/[id]` + `GET /api/boards/[id]/columns` del target board
- [ ] **22.3** Render info panel con `ColumnCell` por cada col; edits via `handleCellChange` que hace PUT al target
- [ ] **22.4** `RelationCell` click handler: en lugar de abrir RelationPicker (cambiar cuál item), abrir RelatedItemDrawer si hay value. Picker se abre con icono dedicado `⚙` o via double-click.
- [ ] **22.5** Igual tratamiento en `SubItemsView` type=`board_items` — click en row del sub-item abre drawer
- [ ] **22.6** ESC + click outside cierran; botón X en header
- [ ] **22.7** Breadcrumb/back si usuario navega nested (contacto → cuenta → contactos de esa cuenta)

### Verificación
- [ ] Desde Oportunidad, click en chip de contacto → drawer muestra campos (phone, email, cuenta, cargo, owner, etc) editables
- [ ] Editar `email` del contacto desde drawer → al cerrar, al reabrir contacto en board Contactos muestra el nuevo email
- [ ] Column permissions respetadas: si user sólo puede ver phone (no email), drawer sólo muestra phone editable
- [ ] ESC cierra drawer sin perder cambios pendientes (optimistic ya pushed)
- [ ] No bloquea navegación: drawer es overlay sobre la vista activa

---

## Fase 23 — ItemDetailView UX Redesign (Attio-style)

**Goal:** Detail view menos flat, más rico. Referencia: Attio/Affinity — breadcrumb + header con acción primaria + chips de relaciones + activity feed con rich cards por tipo + right sidebar con accordion de secciones de info. Aplicable a TODOS los boards (genérico, no solo oportunidades).

**Idea capturada del screenshot Attio (company detail):** breadcrumb `Companies > Cosme ⭐`, header grande con logo + botones "Compose email" + acciones, tag row con relations principales (owner + parent), tab strip con counts (Activity·Emails·Calls·Team·Associated deals·Notes·Tasks·Files), activity feed agrupado por fecha (2025 > This week > March) con cards ricas (meeting con recording player embebido, note con preview, email con subject), right panel accordion: Record Details (description truncada + categorías como pills) + Enriched Firmographics (foundation date, employee range, ARR) + Location + Social Media Links.

### Scope

**Header (universal):**
- [ ] **23.1** Breadcrumb: `{Board name} > {Item name}`
- [ ] **23.2** Icono del board + nombre item grande editable inline
- [ ] **23.3** Star favorito (nueva tabla `item_favorites` o col en `users`)
- [ ] **23.4** Action buttons: primary action configurable por board (ej: "Generar cotización" en opps, "Compose email" en contactos si hay email col); secundarios: `...` menu con archivar/duplicar/eliminar
- [ ] **23.5** Tag row: chips de relaciones principales (owner + relations principales auto-detectadas por settings.primary_relations)

**Tabs row con counts:**
- [ ] **23.6** Auto-tabs por board config: Activity · Sub-items (por view) · Channels · Files · Notes · Tasks. Counts en badges.
- [ ] **23.7** Tabs dinámicos según capacidades: si board tiene sub_item_views → tab por cada view; si board tiene document templates → tab Documents; si tiene canales → Channels

**Activity feed rich:**
- [ ] **23.8** Grouping por fecha (Today / This week / This month / YYYY)
- [ ] **23.9** Rich cards por `action`: meeting → card con título+fecha+duración+player; email → subject+preview+sender; note → título+snippet con markdown; attribute_change → diff visual; sub_item_*→ inline card con info del sub-item
- [ ] **23.10** Lazy load más antiguos (infinite scroll o "Load more")
- [ ] **23.11** Avatares de actor + timestamp relativo (hace X)

**Right sidebar (accordion):**
- [ ] **23.12** Secciones configurables por board en `boards.settings.detail_sections` (jsonb). Cada sección = { title, col_keys[] } o preset ("record_details", "enrichment", "location", "social")
- [ ] **23.13** Accordion colapsable con estado persistido en localStorage
- [ ] **23.14** "Show all values" para secciones largas (truncar a 5 cols visibles)
- [ ] **23.15** Inline edit en cada field (reusa ColumnCell) — mismo patrón que row

**Presets por board de sistema:**
- [ ] **23.16** Contactos: Record Details (phone/email/owner/cargo/cuenta) + Social (linkedin/twitter col opcionales) + Activity
- [ ] **23.17** Oportunidades: Record Details (stage/monto/owner/deadline) + Related (contacto + cuenta vía chain como chips) + Products (sub-item view Catálogo embed) + Quotes (sub-item view Cotizaciones embed) + Activity
- [ ] **23.18** Cuentas: Record Details + Enrichment (industry/size/founded cols, opcional) + People (sub-item view Contactos) + Activity
- [ ] **23.19** Cotizaciones: Record Details (folio/monto/stage/signatures status) + Line items (sub-items native) + PDF preview embed + Audit log

### Verificación
- [ ] Click item en cualquier board → detail view con header + tabs + sidebar (no flat row)
- [ ] Activity feed agrupa por fecha sin loading jank
- [ ] Accordion states persisten entre sesiones
- [ ] Misma estructura en todos los boards (config via detail_sections)
- [ ] Responsive: mobile colapsa sidebar a drawer

### Referencias
- Attio (company/contact detail) — activity feed + right sidebar accordion
- Affinity — breadcrumb + chip row
- Notion — inline editable fields

---

