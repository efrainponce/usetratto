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
Fase 13: Stage Gates + Approval (gatekeepers nativos, reemplaza Make)
   ↓
Fase 14: Cross-board Automations (trigger → acción, reemplaza Make)
   ↓
Fase 15: Quote Engine (templates PDF, cotizaciones desde items)
   ↓
Fase 16: WhatsApp Integration (Claude AI + Twilio + Edge Functions)
```

---

## Fase 0 — Schema + Seed

**Goal:** Base de datos limpia, probada, con data de ejemplo. `sid` en TODA entidad.

### Tareas

- [ ] **0.1** Crear proyecto Supabase nuevo (o reset completo)
- [ ] **0.2** Migration 001: Core tables
  ```sql
  -- Secuencia global compartida:
  CREATE SEQUENCE tratto_sid_seq START 10000000;
  
  -- TODA tabla con sid usa: DEFAULT nextval('tratto_sid_seq')
  -- Entidades con sid: workspaces, users, teams, territories,
  --   boards, board_stages, board_columns, items, sub_items

  workspaces (id uuid PK, sid bigint UNIQUE DEFAULT nextval, name, created_at)
  users (id uuid PK, sid bigint UNIQUE, name, phone UNIQUE, email, role, workspace_id FK, created_at)
  teams (id, sid, workspace_id, name, created_at)
  user_teams (user_id, team_id) -- PK compuesto
  territories (id, sid, workspace_id, name, parent_id SELF-REF NULL, created_at)
  user_territories (user_id, territory_id) -- PK compuesto

  boards (id, sid, slug UNIQUE per workspace, workspace_id, name, type, description, system_key, sub_items_source_board_id NULL, created_at)
  board_stages (id, sid, board_id, name, color, position, is_closed, created_at)
  board_columns (id, sid, board_id, col_key, name, kind, position, is_system, is_hidden, required, settings jsonb, created_at)

  board_members (id, board_id, user_id NULL, team_id NULL, access, created_at)
    -- CHECK: exactly one of user_id/team_id is NOT NULL
    -- access: 'view' | 'edit'
    -- UNIQUE(board_id, user_id) WHERE user_id IS NOT NULL
    -- UNIQUE(board_id, team_id) WHERE team_id IS NOT NULL

  column_permissions (id, column_id, user_id NULL, team_id NULL, access, created_at)
    -- Same XOR pattern as board_members

  items (id, sid, workspace_id, board_id, stage_id NULL, name, owner_id, territory_id NULL, deadline NULL, position, created_at, updated_at)
  item_values (id, item_id, column_id, value_text, value_number, value_date, value_json, created_at)
    -- UNIQUE(item_id, column_id)

  sub_items (id, sid, workspace_id, item_id, parent_id NULL, depth smallint DEFAULT 0, name, source_item_id NULL, position, created_at)
    -- qty/unit_price/notes eliminados — son sub_item_columns ahora
    -- source_item_id = ref al item del board-source usado en el snapshot (solo trazabilidad)

  sub_item_columns (id, board_id, col_key, name, kind, position, is_hidden, required, settings jsonb, source_col_key TEXT NULL)
    -- UNIQUE(board_id, col_key)
    -- source_col_key = qué col_key del source board se copia en snapshot; NULL = columna manual
    -- kind incluye 'formula' además de los tipos normales

  sub_item_values (id, sub_item_id, column_id, value_text, value_number, value_date, value_json)
    -- UNIQUE(sub_item_id, column_id)
    -- columnas kind='formula' NO se almacenan aquí; se computan en frontend

  item_channels (id, workspace_id, item_id, name, type, team_id NULL, position, created_at)
  channel_messages (id, workspace_id, channel_id, user_id NULL, body, type, metadata jsonb, whatsapp_sid NULL, created_at)
  channel_members (channel_id, user_id, added_by NULL, created_at) -- PK compuesto
  mentions (id, workspace_id, message_id, mentioned_user_id, notified boolean, replied boolean, reply_message_id NULL, created_at)

  item_activity (id, workspace_id, item_id, sub_item_id NULL, actor_id NULL, action, old_value, new_value, metadata jsonb, created_at)

  quote_templates (id, workspace_id, board_id, name, stage_id NULL, template_html, header_fields jsonb, line_columns jsonb, footer_fields jsonb, show_prices boolean, created_at)
  quotes (id, workspace_id, item_id, template_id, generated_by, pdf_url, status, created_at)
  ```

- [ ] **0.3** Migration 002: Functions + Triggers
  ```sql
  seed_system_boards(workspace_id)   → crea 5 boards de sistema + columnas de sistema
  handle_new_auth_user()             → trigger en auth.users, auto-provisioning
  trg_default_channels               → auto-crea General + Sistema al insertar item en board pipeline
  trg_item_activity                  → log automático de cambios en items y sub_items
  trg_seed_columns                   → genera columnas de sistema al crear board
  auto_fill_autonumber()             → trigger para columnas tipo autonumber
  find_by_sid(bigint)                → busca cualquier entidad por sid
  ```

- [ ] **0.4** Migration 003: RLS policies
  ```sql
  -- workspace_isolation en TODAS las tablas
  -- items: admin OR owner OR board_member (user directo o via team) OR territory
  -- boards: workspace_isolation + board_members check
  -- sub_items: hereda permisos del item padre
  ```

- [ ] **0.5** Seed data
  ```sql
  -- 1 workspace "CMP" (con sid)
  -- 1 user admin (con sid, phone de test +521234567890)
  -- 5 system boards con sus columnas de sistema (cada uno con sid)
  -- Board "opportunities": 5 stages (Nueva, Cotización, Costeo, Presentada, Cerrada)
  -- 10 items de ejemplo en opportunities
  -- Board "contacts": 5 contactos ejemplo (como items, no tabla separada)
  -- Board "accounts": 3 cuentas ejemplo
  -- Board "catalog": 10 productos ejemplo
  -- 1 team "Ventas" + 1 team "Compras" (con sid)
  -- 3 territories: Norte, Centro, Sur (con sid)
  -- board_members: team "Ventas" → board "opportunities" con 'edit'
  ```

### Verificación
- [ ] `supabase db reset` sin errores
- [ ] Queries: `SELECT sid, name FROM boards` retorna 5 boards con sids únicos
- [ ] `SELECT * FROM find_by_sid(10000100)` retorna el item correcto
- [ ] Todos los sids son únicos globalmente: `SELECT sid, COUNT(*) FROM (SELECT sid FROM boards UNION ALL SELECT sid FROM items UNION ALL SELECT sid FROM users ...) GROUP BY sid HAVING COUNT(*) > 1` → 0 filas
- [ ] RLS: usuario solo ve datos de su workspace

### Archivos
```
supabase/migrations/
  001_core_schema.sql
  002_functions_triggers.sql
  003_rls_policies.sql
  004_seed_data.sql
```

---

## Fase 1 — Auth

**Goal:** Login funcional con phone OTP. Redirect a /app si autenticado.

### Tareas

- [ ] **1.1** Next.js project setup: `npx create-next-app@latest web --typescript --tailwind --app`
- [ ] **1.2** Deps: `@supabase/supabase-js`, `@supabase/ssr`
- [ ] **1.3** Supabase clients:
  ```
  lib/supabase/client.ts    → createClient() para browser/server
  lib/supabase/server.ts    → createClient() para server components
  lib/supabase/service.ts   → createServiceClient() para API routes
  ```
- [ ] **1.4** Auth helpers:
  ```
  lib/auth/index.ts         → requireAuth(), requireAdmin(), optionalAuth()
  lib/auth/api.ts           → requireAuthApi(), requireAdminApi()
                               Retorna: { userId, workspaceId, role, userSid }
  ```
- [ ] **1.5** Middleware: refresh JWT, protect /app/* y /api/* (excepto /api/auth)
- [ ] **1.6** Login page: phone input → OTP → redirect a /app
- [ ] **1.7** Logout: `POST /api/auth/logout`
- [ ] **1.8** Test OTP en Supabase Dashboard: `+521234567890` → `123456`

### Verificación
- [ ] Login con número de test → redirect a /app
- [ ] /app sin sesión → redirect a /login
- [ ] API sin sesión → 401

### Archivos
```
web/middleware.ts
web/lib/supabase/{client,server,service}.ts
web/lib/auth/{index,api}.ts
web/app/login/page.tsx
web/app/api/auth/logout/route.ts
```

---

## Fase 2 — Layout

**Goal:** Shell de la app: sidebar con boards dinámicos, header, navegación.

### Tareas

- [x] **2.1** Layout: `app/app/layout.tsx`
- [x] **2.2** Sidebar:
  - Logo "T" + nombre workspace
  - Boards del workspace (fetch desde API), cada uno navega a `/app/b/[board.sid]`
  - System boards arriba, custom abajo (separador visual)
  - Settings icon, Superadmin button (condicional), Logout
- [ ] **2.3** Header: pageName dinámico + breadcrumb
- [x] **2.4** API: `GET /api/boards` → boards del workspace con sid y slug
- [x] **2.5** Redirect: `/app` → `/app/b/{sid_de_opportunities}` (dinámico por system_key)
- [x] **2.6** Placeholder en `/app/b/[boardSid]/page.tsx`

### Verificación
- [ ] Login → sidebar con 5 boards de sistema (mostrando nombre, no sid)
- [ ] Click en board → navega a `/app/b/[board.sid]` (ej: `/app/b/10000020`)
- [ ] Cada board muestra su sid en algún lugar sutil (tooltip o badge)

### Archivos
```
web/app/app/layout.tsx
web/app/app/page.tsx
web/app/app/b/[boardSid]/page.tsx
web/app/api/boards/route.ts
web/components/layout/{sidebar,header}.tsx
```

---

## Fase 3 — BoardView (la tabla)

**Goal:** Tabla genérica estilo Airtable que funciona para CUALQUIER board.

### Tareas

- [x] **3.1** `GenericDataTable.tsx`:
  - Recibe: `columns: ColumnDef[]`, `rows: Row[]`, `onCellChange(rowId, colKey, value)`
  - Sort by column, sticky first column, row click, inline edit, bulk select
  - Empty state, loading state
  - **Pura presentación — no sabe de boards/items/API**

- [x] **3.2** Cell system:
  ```
  cells/types.ts             → ColumnDef, CellProps, CellValue
  cells/ColumnCell.tsx        → switch(kind) dispatcher
  cells/TextCell.tsx
  cells/NumberCell.tsx
  cells/DateCell.tsx
  cells/SelectCell.tsx        → opciones desde column.settings.options o board_stages
  cells/MultiSelectCell.tsx
  cells/PeopleCell.tsx        → dropdown de workspace users
  cells/BooleanCell.tsx
  cells/RelationCell.tsx      → picker de items de otro board (target_board_id en settings)
  cells/PhoneCell.tsx
  cells/EmailCell.tsx
  ```

- [x] **3.3** `BoardView.tsx`:
  - Fetch: board + columns + items + item_values
  - Transforma → rows para GenericDataTable
  - onCellChange → PATCH items (core) o PUT item_values (custom)
  - Toolbar: "+ Nuevo", búsqueda, count
  - Row click → `/app/b/[board.sid]/[item.sid]`

- [x] **3.4** Server page: resuelve board por SID + workspace

- [x] **3.5** API:
  ```
  GET  /api/boards/[id]             → board + stages
  GET  /api/boards/[id]/columns     → columnas (con sid)
  GET  /api/items?boardId=          → items con values
  POST /api/items                   → crear (retorna sid)
  PATCH /api/items/[id]             → campos core
  DELETE /api/items/[id]
  DELETE /api/items/bulk
  GET  /api/items/[id]/values
  PUT  /api/items/[id]/values       → upsert
  GET  /api/workspace-users         → usuarios (con sid)
  ```

- [x] **3.6** `lib/boards/index.ts`: `resolveBoardBySid()`, `getFirstBoard()`, `getBoardItems()`

### Decisiones clave

- Columnas de sistema (`is_system=true`) se renderizan con el mismo ColumnCell que custom. La diferencia es que `onCellChange` para system columns hace PATCH a `items.*`, para custom hace PUT a `item_values`.
- Stages se muestran en SelectCell con badge de color, opciones de `board_stages`.
- Owner se muestra en PeopleCell con avatar + nombre.
- RelationCell muestra el nombre del item target, con picker que busca items del `target_board_id`.
- La tabla muestra `sid` como primera columna (readonly, tipo autonumber visual).

### Verificación
- [ ] `/app/b/[sid_opportunities]` → tabla con 10 items, columnas de sistema visibles
- [ ] `/app/b/[sid_contacts]` → misma tabla, distintas columnas (phone, email, account)
- [ ] Inline edit de stage, owner, deadline funciona
- [ ] Crear item → aparece con sid nuevo
- [ ] Bulk delete funciona
- [ ] Sort por columna funciona
- [ ] La columna sid se muestra en cada fila

### Archivos
```
web/components/data-table/GenericDataTable.tsx
web/components/cells/{types,ColumnCell,TextCell,NumberCell,DateCell,SelectCell,MultiSelectCell,PeopleCell,BooleanCell,RelationCell,PhoneCell,EmailCell}.tsx
web/app/app/b/[boardSid]/{page,BoardView}.tsx
web/app/api/items/{route,[id]/route,[id]/values/route,bulk/route}.ts
web/app/api/boards/[id]/{route,columns/route}.ts
web/app/api/workspace-users/route.ts
web/lib/boards/index.ts
```

---

## Fase 4 — ItemDetailView

**Goal:** Página de detalle universal con panel de info editable + tabs.

### Tareas

- [x] **4.1** Server page: resuelve item por sid, board por sid (no slug)
- [x] **4.2** `ItemDetailView.tsx`:
  - Header: nombre editable + stage badge + sid visible
  - Info panel: campos core + custom editables (mismo cell system)
  - Tabs: Sub-items (placeholder) | Canales (placeholder) | Actividad (placeholder)
  - ~~Prev/Next navigation~~ — eliminado por decisión de diseño; breadcrumb al board
- [x] **4.3** API: `GET /api/items/[id]` ya existía; datos pre-fetcheados en server page

### Verificación
- [x] Click en row → `/app/b/10000020/10000107` → detalle con sid en header
- [x] Editar fields → guarda
- [x] Breadcrumb → volver al board
- ~~Prev/Next~~ — eliminado

### Archivos
```
web/app/app/b/[boardSid]/[itemSid]/{page,ItemDetailView}.tsx
```

---

## Fase 5 — Sub-items (columnas dinámicas + snapshot)

**Goal:** Sub-items con columnas configurables por board, source board seleccionable, snapshot al importar. Máxima flexibilidad: ninguna columna hardcodeada excepto `name`.

### Arquitectura

```
boards.sub_items_source_board_id  →  qué board se usa como fuente
sub_item_columns (por board)      →  columnas configurables (igual que board_columns)
sub_item_values                   →  valores celda por celda (igual que item_values)
sub_items.source_item_id          →  ref al item original del snapshot (solo trazabilidad)
```

**Columnas `kind='formula'`** — se computan en frontend, no se almacenan en DB:
```json
{ "formula": "multiply", "col_a": "qty", "col_b": "unit_price" }
```
Tipos soportados: `multiply`, `add`, `subtract`, `percent`.

**L1/L2:** `parent_id` y `depth` ya están en el schema. UI de variantes (sidebar)
se deja para Fase 8 — hoy sub-items son planos visualmente.

**Snapshot al importar:**
- Copia valores del source item → sub_item_values (punto en el tiempo)
- Valores editables post-snapshot de forma independiente
- Nueva columna en sub_item_columns → empieza vacía en sub-items existentes (no backfill automático)
- Futuro: botón "Refresh desde fuente" por sub-item (rellena solo celdas vacías)

### Tareas

- [x] **5.0** Migration: ajustar schema
  ```sql
  -- sub_items: quitar qty, unit_price, notes, catalog_item_id; agregar source_item_id
  -- CREATE TABLE sub_item_columns (id, board_id, col_key, name, kind, position,
  --   is_hidden, required, settings jsonb, source_col_key text, UNIQUE(board_id, col_key))
  -- sub_item_values ya existe en schema 001 — verificar
  -- boards: agregar sub_items_source_board_id uuid NULL REFERENCES boards(id)
  ```

- [x] **5.1** Source selector en BoardView toolbar (junto a "+ Nuevo")
  - Dropdown: elige qué board es el source (boards del workspace)
  - Al elegir source: modal `SourceColumnMapper` para seleccionar columnas a mapear
    - Columnas del source board en lista izquierda
    - Usuario elige cuáles importar + les da nombre + tipo en sub_item_columns
    - Puede agregar columnas manuales sin source (ej. "Notas internas")
  - API: `PATCH /api/boards/[id]` guarda `sub_items_source_board_id`
  - API: `POST /api/boards/[id]/sub-item-columns/sync` crea/actualiza sub_item_columns

- [x] **5.2** API sub-item-columns
  ```
  GET    /api/boards/[id]/sub-item-columns   → columnas configuradas para sub-items
  POST   /api/boards/[id]/sub-item-columns   → crear columna
  PATCH  /api/sub-item-columns/[colId]       → rename, reorder, hide
  DELETE /api/sub-item-columns/[colId]       → eliminar (con confirm si tiene datos)
  ```

- [x] **5.3** API sub-items (refactor del CRUD existente)
  ```
  GET    /api/sub-items?itemId=              → sub-items + sub_item_values + columnas del board
  POST   /api/sub-items                      → crear + snapshot (si source_item_id dado)
  PATCH  /api/sub-items/[id]                 → actualizar name u otros campos core
  DELETE /api/sub-items/[id]                 → cascade children
  PUT    /api/sub-items/[id]/values          → upsert sub_item_values (igual que item_values)
  ```

- [x] **5.4** Snapshot engine (en POST /api/sub-items)
  ```ts
  // Cuando viene source_item_id:
  // 1. Leer item_values del source item
  // 2. Por cada sub_item_column con source_col_key: copiar valor → sub_item_values
  // 3. name = source item name (siempre)
  ```

- [x] **5.5** `InlineSubItems` rediseñado
  - Usa `sub_item_columns` del board para renderizar tabla dinámica (mini GenericDataTable)
  - Barra superior: label del source + botón "+ Agregar"
  - Agregar → si hay source board: `ProductPicker` (busca en source)
               si no hay source: input de texto manual
  - Formula cols: renderizadas como celdas read-only con valor computado
  - Chevron en BoardView row → expande InlineSubItems (ya implementado)

- [x] **5.6** `ProductPicker` rediseñado
  - Busca items en `sub_items_source_board_id`
  - Muestra columnas configuradas en source_col_key
  - Al seleccionar → POST /api/sub-items con source_item_id → snapshot automático

- [x] **5.7** `SubItemsView` en ItemDetailView (tab "Sub-items")
  - Misma lógica que InlineSubItems pero vista completa (más espacio)
  - Columnas configurables visibles, fórmulas computadas

### Decisiones clave

- Sin columnas hardcodeadas: `qty`, `unit_price`, `notes` son columnas default que el usuario puede renombrar/eliminar
- Fórmulas se computan en frontend: no valor en DB, no complejidad de eval
- L1/L2 en schema, UI plana por ahora — sidebar de variantes en Fase 8
- Nueva columna en sub_item_columns → vacía en sub-items existentes (no backfill)
- Un solo source board por board (múltiples sources en backlog)

### Verificación
- [ ] Configurar source "Productos" → modal mapea columnas → sub_item_columns creadas
- [ ] Agregar sub-item desde catálogo → snapshot copia valores → sid asignado
- [ ] Editar valor post-snapshot → no afecta al producto original
- [ ] Columna formula (qty × precio) → muestra total calculado → no editable
- [ ] Agregar/eliminar columnas de sub-items → tabla se actualiza
- [ ] Badge de count en BoardView row → se actualiza al agregar/eliminar

### Archivos
```
supabase/migrations/20260413000001_sub_items_dynamic.sql
web/components/InlineSubItems.tsx              (refactor)
web/components/SubItemsView.tsx                (refactor)
web/components/ProductPicker.tsx               (refactor)
web/components/SourceColumnMapper.tsx          (nuevo — modal config)
web/app/app/b/[boardSid]/BoardView.tsx         (source selector en toolbar)
web/app/api/sub-items/{route,[id]/route,[id]/values/route}.ts
web/app/api/boards/[id]/sub-item-columns/route.ts
web/app/api/sub-item-columns/[colId]/route.ts
```

---

## Fase 6 — Import Wizard

**Goal:** Importar data a cualquier board desde cualquier fuente. Arquitectura de plugins — agregar fuente nueva = 1 archivo.

### Arquitectura (implementada)
```
components/import/
  ImportWizard.tsx          ← orquestador genérico: picker → ConnectStep → ColumnMapper → import
  ColumnMapper.tsx          ← step genérico: mapear campos + crear columnas nuevas inline
  sources/
    types.ts                ← interface ImportSource (ConnectStep, ConnectResult, ImportField)
    index.ts                ← IMPORT_SOURCES registry ← agregar Monday aquí
    AirtableSource.tsx      ← ConnectStep Airtable (PAT + base + table, client-side fetch)
    CsvSource.tsx           ← ConnectStep CSV (parse en cliente)

api/import/bulk/            ← único endpoint genérico; todas las fuentes envían aquí
```

**Para agregar una fuente nueva (Monday, Notion, etc.):**
1. Crear `sources/MondaySource.tsx` con icon + ConnectStep + `ImportSource` export
2. Agregar a `sources/index.ts` → aparece automáticamente en el wizard

### Tareas
- [x] **6.1** Arquitectura de plugins: `ImportSource` interface + registry
- [x] **6.2** `ImportWizard.tsx` genérico + `ColumnMapper.tsx` con "Crear columna nueva"
- [x] **6.3** `AirtableSource.tsx` + `CsvSource.tsx`
- [x] **6.4** API: `POST /api/import/bulk` (genérico) + `POST /api/boards/[id]/columns`
- [x] **6.5** Integrar en BoardView toolbar + `refreshAll` (items + columns post-import)
- [ ] **6.6** Refresh desde fuente (Airtable/similares): botón "Reimportar" que conserva
  el mapping anterior y re-ejecuta `fetchAll()` → útil para sync periódica.
  Requiere persistir `{ source_id, connect_params, field_map }` por board en DB.
  Candidato: nueva tabla `board_import_configs (id, board_id, source_id, params jsonb, field_map jsonb)`

### Verificación
- [ ] Import CSV a catalog → items con sids nuevos, columnas nuevas creadas si aplica
- [ ] Import Airtable → mapeo de columnas → items creados, columnas nuevas visibles
- [ ] Funciona en CUALQUIER board
- [ ] Agregar nueva fuente solo requiere 1 archivo nuevo + 1 línea en index.ts

---

## Fase 7 — Canales + Activity Log

**Goal:** Comunicación interna + audit trail.

### Tareas
- [x] **7.1** `ItemChannels.tsx` + `ActivityFeed.tsx`
- [x] **7.2** API: channels, messages, members, activity
- [x] **7.3** Integrar como tabs en ItemDetailView

---

## Fase 8 — Settings + Board Views

**Goal:** Admin configura boards, stages, columns, members, teams, territories. Usuarios crean vistas por board con columnas configurables.

### Tareas
- [x] **8.1** Settings layout + nav (Cursor-inspired: sidebar secundario + content area)
- [x] **8.2** Boards: CRUD + stages + columns + members tab (view/edit + restrict_to_own)
- [x] **8.3** Teams: CRUD + miembros
- [x] **8.4** Territories: CRUD + jerarquía padre/hijo
- [x] **8.5** Workspace config (nombre + zona de peligro)
- [x] **8.6** Superadmin: workspace switcher
- [x] **8.7** Board Views: tab strip entre header y tabla + column visibility por vista
  - Migration 011: `board_views` + `board_view_columns` (sin `board_view_members` — eso es Fase 9)
  - API: CRUD vistas + toggle visibilidad de columnas por vista
  - UI: tab strip bonito entre board name y tabla, "+" inline para crear vista nueva, rename on double-click
  - "Default" siempre existe, no se puede eliminar
  - Board sin views → todas las columnas visibles (backward compatible)
  - Column picker por vista: eye icon en el header de la tabla → checkbox por columna

### Schema (8.7)

```sql
board_views (
  id uuid PK,
  sid bigint UNIQUE DEFAULT nextval('tratto_sid_seq'),
  board_id uuid FK boards(id) ON DELETE CASCADE,
  workspace_id uuid FK workspaces(id),
  name text NOT NULL,               -- "Default", "Vista Ventas", "Vista Costos"
  is_default boolean DEFAULT false, -- la view que se abre al entrar al board
  position int DEFAULT 0,
  created_by uuid FK users(id) NULL,
  created_at timestamptz DEFAULT now()
)

board_view_columns (
  id uuid PK,
  view_id uuid FK board_views(id) ON DELETE CASCADE,
  column_id uuid FK board_columns(id) ON DELETE CASCADE,
  position int DEFAULT 0,
  is_visible boolean DEFAULT true,
  width int DEFAULT 200,
  UNIQUE(view_id, column_id)
)
-- board_view_members → Fase 9 (permisos por vista)
```

### API routes (8.7)

```
GET    /api/boards/[id]/views                       → list views (con column config)
POST   /api/boards/[id]/views                       → crear vista nueva
PATCH  /api/boards/[id]/views/[viewId]              → rename, reorder, set default
DELETE /api/boards/[id]/views/[viewId]              → eliminar (no la default)
PUT    /api/boards/[id]/views/[viewId]/columns      → bulk update visibility + positions
PATCH  /api/boards/[id]/views/[viewId]/columns/[colId] → toggle is_visible, set width
```

### Reglas clave (8.7)

```
1. Board sin board_views → GET /api/boards/[id]/columns retorna todas las columnas (legacy)
2. Board con views → GET con ?viewId= filtra por board_view_columns.is_visible
3. Vista sin board_view_columns para una columna → columna visible por default
4. Al crear nueva columna con ?viewId= activo:
   → INSERT board_columns (pertenece al board)
   → INSERT board_view_columns is_visible=true para vista activa
   → INSERT board_view_columns is_visible=false para todas las demás vistas
```

### Pendiente para Fase 9
- **8.7-defer** Column permissions UI (settings → board → column → toggle quién ve/edita)
- **8.7-defer** `board_view_members` (quién puede ver esta vista — permisos por vista)
- **8.8** Sub-item views: múltiples configuraciones de source por board
- **8.9** Billing page (mock con créditos AI + storage — integración real en Fase 10)

---

## Fase 9 — Permisos granulares

**Goal:** RLS real con board_members, column_permissions, view-level access.

### Tareas
- [x] **9.0** Seguridad base: 35 API routes migradas de createServiceClient → createClient; RLS ahora es el único enforcement; service client solo en admin/seed y superadmin
- [x] **9.1** RLS refinado: board_members (user o team) con access level (ya estaba implementado en migration 003)
- [x] **9.2** Column visibility: GET /api/boards/[id]/columns filtra columnas según column_permissions del user + devuelve `user_access`
- [x] **9.3** Territory filter: dropdown en BoardView toolbar filtra items por territorio (client-side, lazy load)
- [x] **9.4** Verificado: RLS bloquea board privado; restrict_to_own enforced en GET /api/items
- [x] **9.5** Column permissions UI (settings → board → columnas tab → 3-dot (⋯) hover → panel inline con add/remove permisos por usuario)
- [x] **9.6** `board_view_members` (migration 012): UI en BoardView tab strip → 3-dot (⋯) hover por vista → popup gestión de acceso
  ```sql
  board_view_members (
    id uuid PK,
    view_id uuid FK board_views(id) ON DELETE CASCADE,
    user_id uuid FK users(id) NULL,
    team_id uuid FK teams(id) NULL,
    CHECK: XOR user_id/team_id
  )
  -- Sin registros → visible para todos los miembros del board
  ```
- [ ] **9.7** Sub-item views: múltiples source configs por board — diferido a post-Fase 10
- [x] **9.8** Billing page mock — implementado en Fase 8

---

## Fase 10 — Column Settings Editor (NEXT — VITAL)

**Goal:** Editor completo de configuración de columna accesible desde el panel "Columnas" del BoardView (⋯ por columna) y desde Settings. Mismo componente, mismos datos.

### Contexto
El ⋯ en el panel Columnas del BoardView actualmente abre permisos. Necesita crecer para ser el punto central de configuración de cualquier columna: nombre, tipo, opciones, fórmulas, target board (relation), etc.

### Tareas

- [x] **10.1** `ColumnSettingsPanel` — componente genérico (drawer o modal) que recibe `column` y `boardId`, muestra y guarda toda la configuración:
  ```
  Secciones:
  ├── General: nombre editable, kind (tipo), col_key (readonly)
  ├── Opciones (kind=select|multiselect): lista de opciones con color picker, add/remove/reorder
  ├── Fórmula (kind=formula): selector de operación (multiply/add/subtract/percent) + col_a + col_b
  ├── Relation (kind=relation): target_board_id picker (dropdown de boards del workspace)
  ├── Number (kind=number): formato (currency, percentage, plain), decimales
  └── Permisos: quién puede ver/editar (reusa lógica ya implementada)
  ```

- [x] **10.2** Integrar en panel Columnas del BoardView: el ⋯ abre `ColumnSettingsPanel` en lugar del mini-panel de permisos actual

- [x] **10.3** Integrar en Settings → Boards → Columnas tab: el ⋯ abre el mismo `ColumnSettingsPanel` (reemplaza el panel de permisos actual de settings)

- [x] **10.4** API: `PATCH /api/boards/[id]/columns/[colId]` — extendido para aceptar `name`, `kind`, `settings` (jsonb con opciones/formato/target_board_id)

- [x] **10.5** Para `kind=select|multiselect`: persistir opciones en `board_columns.settings.options = [{ value, label, color }]` — mismo formato que ya usa SelectCell

### Decisiones clave
- `ColumnSettingsPanel` es un componente independiente en `components/ColumnSettingsPanel.tsx`
- Se puede abrir como drawer lateral (slide-in desde la derecha) o modal — decidir en implementación
- Cambiar `kind` de una columna con datos existentes: advertencia al usuario ("los valores existentes pueden quedar incompatibles")
- Reorder de opciones: drag-and-drop simple (o flechas arriba/abajo para evitar dependencia nueva)

---

## Fase 11 — Column Upgrades: Files, Buttons, Signature

**Goal:** Tres nuevos `kind` de columna que desbloquean quotes, gates y aprobaciones.

### 11.1 — kind: 'file'

```typescript
// item_values.value_json:
[{ name: string, url: string, size: number, mime: string, uploaded_at: string }]
```

- Bucket `item-files` en Supabase Storage (RLS por workspace)
- API: `POST /api/items/[id]/files` → genera signed upload URL → cliente sube directo a Storage
- `FileCell`: chips con nombre + icono + botón download; botón "+" para subir
- Múltiples archivos por celda (array en value_json)

### 11.2 — kind: 'button'

```typescript
// board_columns.settings:
{
  label: string,              // texto del botón
  action: 'change_stage'      // acción directa
        | 'create_quote'
        | 'run_automation',   // Fase 14
  // por acción:
  stage_id?: string,          // para change_stage
  template_id?: string,       // para create_quote
  automation_id?: string,     // para run_automation
  confirm?: boolean,          // pedir confirmación antes de ejecutar
  confirm_message?: string,
}
```

- `ButtonCell`: botón inline en la tabla, no editable
- On click → ejecuta acción via API según settings → muestra feedback (spinner → check / error)
- `change_stage` y `create_quote` no requieren Fase 14

### 11.3 — kind: 'signature'

```typescript
// item_values.value_json cuando firmado:
{
  doc_id: string,    // UUID generado al firmar (único, inmutable)
  signed_by: string, // nombre del usuario
  email: string,
  signed_at: string, // ISO timestamp
  user_id: string,   // FK a users.id para auditoría
}
// null cuando no está firmado
```

- `SignatureCell`: sin firma → botón "Firmar" (solo roles permitidos por `settings.allowed_roles`); con firma → watermark estilo DocuSeal
- On click "Firmar" → modal de confirmación → guarda JSON → **read-only para siempre** (RLS + API)
- Admin puede invalidar con log de actividad obligatorio
- `settings.allowed_roles: string[]` — qué roles pueden firmar
- En PDF de quote: si el item tiene columna signature firmada → incluir watermark en footer

### Tareas
- [ ] **11.1** Bucket Storage + API upload + FileCell
- [ ] **11.2** ButtonCell + acciones `change_stage` y `create_quote` (sin automation engine)
- [ ] **11.3** SignatureCell + lógica de inmutabilidad

### Verificación
- [ ] Subir archivo a item → aparece en celda → descargable
- [ ] Botón cambia stage del item al hacer click
- [ ] Firma guarda watermark → no editable después → aparece en PDF

---

## Fase 12 — Variantes L2 + Vistas por board

**Goal:** Explotar un sub-item en variantes por talla/color. Configurar qué niveles se ven por board.

### Contexto

```
Oportunidad (item)
  └── Camisa táctica azul (sub-item L1, depth=0)
        └── S  | qty: 50 (sub-item L2, depth=1)
        └── M  | qty: 80
        └── L  | qty: 40
        └── XL | qty: 30
```

- En board **Oportunidades**: ver solo L1 (total por producto, sin desglose de tallas)
- En board **Proyectos**: ver L1+L2 (desglose completo por talla)

### Schema (ya existe, solo UI faltante)

```sql
sub_items.depth      -- 0 = L1, 1 = L2
sub_items.parent_id  -- L2 apunta a L1
```

### Feature: Auto-expand L1 → L2 (producto cartesiano)

```typescript
// boards.settings (jsonb):
{
  variant_dimensions: ['tallas_col_id', 'colores_col_id'],  // 1..N columnas multiselect
  variant_value_columns: ['qty', 'unit_price']              // columnas en blanco en cada L2
}

// Ejemplos:
// 1 dimensión: tallas=[S,M,L,XL]              → 4 L2s ("S", "M", "L", "XL")
// 2 dimensiones: tallas × colores (4×3)       → 12 L2s ("S / Azul", "M / Negro"...)
// 3 dimensiones: talla × color × tela (4×3×2) → 24 L2s ("S / Azul / Ripstop"...)
```

Botón "Explotar variantes" en L1 → lee valores de todas las `variant_dimensions` del sub-item → calcula producto cartesiano → crea un L2 por cada combinación con `name = "dim1 / dim2 / ..."` y `variant_value_columns` en blanco.

Si ya existen L2s para ese L1 → pregunta si reemplazar o agregar faltantes (no duplicar combinaciones ya existentes).

### Feature: Formula sum L2 en L1

```typescript
// sub_item_columns.settings para kind='formula' en L1:
{
  formula: 'sum_children',   // nuevo tipo: suma una columna de todos los L2 hijos
  child_column: 'qty'
}
```

Computable en frontend: `sum(row.subRows.map(l2 => l2.qty))`. Read-only. Útil para validar sum(tallas) = total pedido.

### Feature: View config por board

```typescript
// boards.settings (jsonb, ya existe):
{
  subitem_view: 'L1_only' | 'L1_L2' | 'L2_only'
}
```

`BoardView` y `ItemDetailView` respetan este setting al renderizar sub-items.

### Tareas
- [ ] **12.1** UI de L2 en `InlineSubItems` + `SubItemsView`: indentación, expand/collapse L1
- [ ] **12.2** Botón "Explotar variantes" en L1 → crea L2 desde multiselect column
- [ ] **12.3** Formula `sum_children` en sub_item_columns
- [ ] **12.4** Setting `subitem_view` por board + respetarlo en BoardView/ItemDetailView
- [ ] **12.5** API `POST /api/sub-items/[id]/expand` → recibe column_id, crea L2s

### Verificación
- [ ] L1 con tallas S/M/L/XL → explotar → genera 4 L2
- [ ] sum(L2.qty) se actualiza en L1 al cambiar cualquier cantidad
- [ ] Oportunidades solo ve L1; Proyectos ve L1+L2

---

## Fase 13 — Stage Gates + Field Locks

**Goal:** Reemplazar Make checks con validaciones nativas. Bloquear campos según estado.

### 13.A — Stage Gates

Antes de que un item avance a una etapa, todas las `entry_conditions` de esa etapa deben cumplirse.

```sql
-- board_stages.entry_conditions jsonb DEFAULT '[]'
-- Cada condition:
{
  "id": "uuid",
  "label": "Debe tener al menos 1 producto con descripción",  -- aparece en mensaje al vendedor
  "type": "column_not_empty"
        | "column_equals"
        | "column_greater_than"
        | "column_contains"
        | "all_subitems_match"    -- todos los L1 tienen [column] = [value]
        | "sum_children_equals"   -- sum(L2.column) = item.column
        | "signature_exists"      -- columna kind='signature' está firmada
        | "file_attached",        -- columna kind='file' tiene al menos 1 archivo
  "column_id": "uuid",
  "value": any,
  "child_column_id": "uuid"       -- para all_subitems_match y sum_children_equals
}
```

**Flujo cuando falla:**

```
PATCH /api/items/[id] { stage_id: 'nuevo' }
  → evalúa entry_conditions del stage destino
  → si alguna falla:
      1. Retorna 422 { blocked: true, failed: [{ label, type }] }
      2. INSERT item_activity { action: 'stage_blocked', metadata: { failed_checks, attempted_stage } }
      3. POST canal "Sistema": "@[owner] No pudiste avanzar a [Etapa]:\n❌ [label1]\n❌ [label2]"
      4. INSERT mentions → trigger WhatsApp al owner (ya existente)
```

**UI en Settings → Boards → click en etapa:**
```
┌─────────────────────────────────────────────────┐
│  Requisitos para entrar a "Costeo"              │
│                                                 │
│  ❯ Institución del contacto  [no está vacío]    │
│  ❯ Descripción               [no está vacío]    │
│  ❯ Cantidad                  [mayor que 0]      │
│  + Agregar requisito                            │
└─────────────────────────────────────────────────┘
```

### 13.B — Field Locks

Cuando una columna alcanza cierto valor → se vuelve read-only para roles no privilegiados.

```typescript
// sub_item_columns.settings (o board_columns.settings):
{
  lock_when: {
    column_id: 'stage_col_id',
    operator: 'equals',
    value: 'listo_stage_id'
  },
  lock_for_roles: ['member', 'viewer']  // admin/costeador sí puede editar
}
```

Enforcement:
- **API**: `PATCH /api/sub-items/[id]/values` verifica lock antes de escribir → 403 si aplica
- **UI**: celda se muestra con fondo gris + cursor not-allowed + tooltip "Este campo está bloqueado"

### Tareas
- [ ] **13.1** `board_stages.entry_conditions` — migration + PATCH en API de stages
- [ ] **13.2** Evaluador de conditions en `lib/stage-gates.ts` (todos los tipos)
- [ ] **13.3** Enforcement en `PATCH /api/items/[id]` al cambiar `stage_id`
- [ ] **13.4** Auto-post canal Sistema + mention al owner cuando falla
- [ ] **13.5** UI condition builder en Settings → Boards → Stages
- [ ] **13.6** `lock_when` en settings de board_columns y sub_item_columns
- [ ] **13.7** Enforcement de lock en API + UI (celda gris)

### Verificación
- [ ] Item sin institución de contacto → no puede avanzar a Costeo → mensaje en canal con checks fallidos
- [ ] Sub-item en stage Listo → vendor intenta editar → bloqueado; costeador sí puede
- [ ] Firma requerida → sin firma → no avanza → con firma → avanza

---

## Fase 14 — Cross-board Automations

**Goal:** Trigger → Acción. Reemplazar los scenarios de Make que conectan boards.

### Schema

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

### Triggers

| type | config | Descripción |
|---|---|---|
| `stage_changed` | `{ to_stage_id, from_stage_id? }` | Item cambia a/desde etapa |
| `item_created` | `{}` | Nuevo item en el board |
| `column_changed` | `{ column_id, to_value? }` | Columna cambia (opcionalmente a valor específico) |
| `button_clicked` | `{ button_column_id }` | Click en ButtonCell (Fase 11) |

### Acciones

| type | params | Descripción |
|---|---|---|
| `change_stage` | `{ stage_id }` | Cambiar etapa del item |
| `set_column_value` | `{ column_id, value }` | Fijar valor de columna |
| `assign_owner` | `{ user_id \| 'trigger_user' }` | Asignar dueño |
| `notify_user` | `{ user_field \| user_id, message_template }` | Mensaje en canal Sistema |
| `create_quote` | `{ template_id }` | Genera cotización PDF |
| `cross_board_copy` | `{ target_board_id, field_mapping, copy_subitems, expand_variants }` | Crea item en otro board |
| `call_webhook` | `{ url, method, headers, body_template }` | HTTP request externo |

### cross_board_copy — el caso Oportunidad → Proyecto

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

### Motor de automations

```typescript
// lib/automation-engine.ts
export async function runAutomations(event: AutomationEvent, supabase: SupabaseClient)

// AutomationEvent:
{ type: 'stage_changed' | 'item_created' | ..., item_id, board_id, workspace_id, payload }
```

Llamado desde API routes después de cada mutación relevante. No DB triggers — lógica en TypeScript, más fácil de debuggear.

**Anti-loop:** `automation_runs` table guarda `(automation_id, item_id, triggered_at)` — si la misma automation corrió para el mismo item en los últimos 5s, skip.

### UI — Lista de recetas por board

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

### Tareas
- [ ] **14.1** Migration: `automations` + `automation_runs`
- [ ] **14.2** `lib/automation-engine.ts` — evaluador de triggers + ejecutor de acciones
- [ ] **14.3** Integrar `runAutomations()` en `PATCH /api/items/[id]` + `POST /api/items`
- [ ] **14.4** Implementar acción `cross_board_copy` (con copy_subitems + expand_variants)
- [ ] **14.5** UI: Settings → Boards → tab "Automations" (lista de recetas + editor)
- [ ] **14.6** ButtonCell con `action: 'run_automation'` (completar Fase 11.2)

### Verificación
- [ ] Oportunidad gana → se crea item en Proyectos con sub-items y tallas auto-expandidas
- [ ] Botón "Aprobar" cambia stage + genera PDF en 1 click
- [ ] Anti-loop: automation no corre dos veces por el mismo evento

---

## Fase 15 — Quote Engine

**Goal:** Generación de cotizaciones PDF desde items del pipeline. Templates configurables por board, líneas = sub-items. Firma digital integrada.

### Arquitectura

```
quote_templates (id, workspace_id, board_id, name, stage_id, template_html,
                 header_fields, line_columns, footer_fields, show_prices, created_at)
quotes          (id, workspace_id, item_id, template_id, generated_by,
                 pdf_url, status, created_at)
```

- `header_fields`: qué columnas del item van en el encabezado (cliente, fecha, folio)
- `line_columns`: qué sub_item_columns van como líneas de la cotización
- `footer_fields`: subtotal, impuestos, total — derivados de fórmulas de sub-items
- `template_html`: HTML Handlebars con vars `{{item.name}}`, `{{lines}}`, etc.
- PDF generado via Edge Function (Puppeteer), guardado en Supabase Storage
- Si item tiene columna `kind='signature'` firmada → watermark en footer del PDF

### Tareas
- [ ] **15.1** Migration: `quote_templates` + `quotes` (verificar si ya existe en schema 001)
- [ ] **15.2** Settings → Boards → tab "Cotizaciones": CRUD de templates
  - Editor: elegir header_fields, line_columns, footer_fields
  - Preview en tiempo real
- [ ] **15.3** Edge Function `generate-quote`:
  - Fetch item + sub-items + values + firma si existe
  - Render HTML con Handlebars
  - PDF con Puppeteer → upload Storage → retorna URL
- [ ] **15.4** API: `POST /api/quotes` → llama Edge Function → guarda en `quotes`
- [ ] **15.5** Tab "Cotización" en ItemDetailView:
  - Lista de cotizaciones previas
  - Botón "Generar cotización" → elige template → genera → muestra PDF
  - Descarga + link compartible

### Verificación
- [ ] Cotización desde oportunidad con L1+L2 → PDF con tallas desglosadas
- [ ] Firma en PDF si item tiene signature column firmada
- [ ] Historial de cotizaciones por item

---

## Fase 16 — WhatsApp Integration

**Goal:** Usuarios en campo operan Tratto desde WhatsApp. Claude AI parsea intención y ejecuta acciones.

### Flujos principales

```
1. Vendedor crea item desde WA:
   "agregar oportunidad: Empresa XYZ, $50k, etapa propuesta"
   → Claude AI → POST /api/items → responde con sid

2. Vendedor consulta desde WA:
   "qué tengo pendiente hoy"
   → Claude AI → GET /api/items?owner=me&deadline=today → lista

3. Respuesta a mención:
   Canal: "@Juan revisa el contrato"
   → Juan recibe WA → responde desde WA → mensaje vuelve al canal

4. Digest diario (8:30 AM MX):
   Items vencidos + menciones pendientes + actividad reciente
```

### Tareas
- [ ] **16.1** Edge Function `twilio-webhook`:
  - Recibe mensaje WA entrante
  - Llama Claude API con contexto del usuario (boards, items recientes)
  - Claude decide acción: create_item | query_items | reply_mention | unknown
  - Ejecuta acción vía API interna
  - Responde al usuario por WA
- [ ] **16.2** Edge Function `mentions-trigger`:
  - Cron cada 2 min
  - Busca `mentions WHERE notified=false`
  - Envía WA con preview del mensaje + link al canal
  - Marca `notified=true`
- [ ] **16.3** Edge Function `daily-digest`:
  - Cron 8:30 AM America/Mexico_City
  - Por usuario activo: items overdue + items due today + menciones sin responder
  - Mensaje WA formateado
- [ ] **16.4** Edge Function `whatsapp-outbound`:
  - Sender genérico: `sendWhatsApp(phone, message)`
- [ ] **16.5** UI: Settings → Workspace → tab "WhatsApp"
  - Conectar número Twilio
  - Test de envío
  - Log de mensajes recientes

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
