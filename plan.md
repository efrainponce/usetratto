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
Fase 17: Quote Engine (templates PDF, cotizaciones desde items)
   ↓
Fase 18: Tratto AI Agent + Sidebar Chat (engine compartido — sidebar, WA, móvil)
   ↓
Fase 19: WhatsApp Integration (adapter sobre el mismo engine)
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
- [x] **8.8** Sub-item views: múltiples configuraciones de source por board
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
- [x] **9.7** Sub-item views: múltiples source configs por board — implementado en sesión 19
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
- [x] **11.1** Bucket Storage + API upload + FileCell
- [x] **11.2** ButtonCell + acciones `change_stage` y `create_quote` (sin automation engine)
- [x] **11.3** SignatureCell + lógica de inmutabilidad

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
- [x] **12.1** UI de L2 en `SubItemsView` (NativeRenderer): indentación, expand/collapse L1, L2 como filas hijas anidadas
- [x] **12.2** Botón "Explotar variantes" (⊞) en L1 → modal para elegir dimensiones multiselect → crea L2s
- [x] **12.3** Formula `sum_children` en sub_item_columns — computable en frontend: `children.reduce(sum, col_key)`
- [x] **12.4** Setting `subitem_view` por board → `L1_only` oculta L2, `L1_L2` normal, `L2_only` auto-expande y oculta L1 rows
- [x] **12.5** API `POST /api/sub-items/[id]/expand` → recibe `column_ids[]`, calcula cartesiano, crea L2s, skips duplicados por nombre
- [x] **12.6** API `POST /api/sub-items/[id]/import-children` → copia sub-items del source item como L2 hijos del L1 (desde catálogo)
- [x] **12.7** API `POST /api/sub-items/[id]/refresh` → re-copia `item_values` del source item vía `source_col_key` mapping; bloqueado si sub-item tiene estado `is_closed`
- [x] **12.8** Navegación desde sub-item → source item: ↗ en L1 rows resuelve `source_item_sid` + `source_board_sid` (batch en API) y renderiza `<a href>` al catálogo; fallback a drawer si no tiene source
- [x] **12.9** `SubItemDetailDrawer`: drawer fijo lateral (w-72) con todos los campos editables del sub-item; select cols con badge pill; fórmulas read-only
- [x] **12.10** `SelectCell` en NativeRenderer: badge de color cuando closed (vista), `<select>` dropdown cuando editing
- [x] **12.11** Migration `boards.settings jsonb` — `ALTER TABLE boards ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'`
- [x] **12.12** Migration `Estado` sub-item column — para boards con `system_key='opportunities'`: inserta columna select (Pendiente/En producción/Entregado/Terminado con colores), escribe `status_sub_col_key: 'estado'` en boards.settings
- [x] **12.13** `is_closed: boolean` en select options — rename-safe terminal state, consistente con `board_stages.is_closed`; migration reemplaza `closed_sub_values[]` en boards.settings; ColumnSettingsPanel toggle con lock icon por opción
- [x] **12.14** `boards.settings` threaded desde `b/[boardSid]/page.tsx` → BoardView → SubItemsView (y por ItemDetailView → ItemDetailView → SubItemsView)
- [x] **12.15** `resolveBoardBySid` actualizado para incluir `settings` en el SELECT

### Decisiones clave (sesión 20)

- **Snapshot vs live:** Sub-items propios son snapshot (copiados del catálogo, editables independientemente). El botón ⟳ re-sincroniza valores desde la fuente en cualquier momento, excepto si el sub-item tiene estado con `is_closed=true`.
- **L2 desde catálogo:** El botón ↓ en L1 importa los sub-items del producto origen como L2 hijos — permite ver tallas/variantes del catálogo sin explotar cartesiano manualmente.
- **is_closed rename-safe:** `closed_sub_values: string[]` en boards.settings era frágil (rompía al renombrar opciones). Reemplazado por `option.is_closed: boolean` dentro del objeto de opción — idéntico a `board_stages.is_closed`.
- **status_sub_col_key en boards.settings:** Designa cuál columna de sub-item es el "estado" — usado por el endpoint `/refresh` para verificar si está bloqueado.

### Verificación
- [x] L1 con multiselect tallas S/M/L/XL → explotar → genera 4 L2
- [x] sum(L2.qty) se computa en L1 al cargar (formula sum_children)
- [x] subitem_view=L1_only → solo L1 visible; L1_L2 → ambos; L2_only → solo L2 expandidos
- [x] ↗ en L1 con source → navega a /app/b/[boardSid]/[itemSid] del catálogo
- [x] ↓ en L1 → importa sub-items del producto como L2
- [x] ⟳ en L1 → re-copia valores del source; bloqueado si is_closed=true
- [x] Estado column en opportunities boards con opciones coloreadas
- [x] ColumnSettingsPanel → lock icon por opción toggle is_closed

### Archivos (sesión 20)
```
supabase/migrations/20260414000002_boards_settings.sql     (nuevo)
supabase/migrations/20260414000003_sub_item_estado.sql     (nuevo)
supabase/migrations/20260414000004_option_is_closed.sql    (nuevo)
web/app/api/sub-items/[id]/expand/route.ts                 (nuevo)
web/app/api/sub-items/[id]/import-children/route.ts        (nuevo)
web/app/api/sub-items/[id]/refresh/route.ts                (nuevo)
web/app/api/sub-item-views/[viewId]/data/route.ts          (source_item_sid + source_board_sid batch-resolved)
web/components/SubItemsView.tsx                            (NativeRenderer: drawer, import-children, refresh, nav links, select badge, sum_children)
web/components/ColumnSettingsPanel.tsx                     (is_closed toggle per option)
web/lib/boards/index.ts                                    (settings en resolveBoardBySid SELECT)
web/app/app/b/[boardSid]/page.tsx                          (boardSettings + subitemView derivados)
web/app/app/b/[boardSid]/BoardView.tsx                     (boardSettings + subitemView props)
web/app/app/b/[boardSid]/[itemSid]/page.tsx                (boardSettings + subitemView derivados)
web/app/app/b/[boardSid]/[itemSid]/ItemDetailView.tsx      (boardSettings + subitemView props)
```

---

## Fase 13 — Formula Columns

**Goal:** Fórmulas configurables en `board_columns` y `sub_item_columns` — operaciones entre columnas del mismo nivel, computadas en frontend, sin almacenamiento en DB.

### Alcance

Las fórmulas actuales en `sub_item_columns` solo soportan `multiply/add/subtract/percent` con dos columnas numéricas hardcodeadas. Esta fase las generaliza y las extiende a `board_columns`.

### Tipos de fórmula

```typescript
// settings.formula_config en board_columns / sub_item_columns con kind='formula'
type FormulaConfig =
  | { type: 'arithmetic'; op: 'add' | 'subtract' | 'multiply' | 'divide' | 'percent'; col_a: string; col_b: string }
  | { type: 'if';         condition: FormulaCondition; col_true: string | number; col_false: string | number }
  | { type: 'concat';     cols: string[]; separator: string }
  | { type: 'date_diff';  col_a: string; col_b: string; unit: 'days' | 'hours' }
  | { type: 'count_if';   col: string; operator: '>' | '<' | '=' | '!='; value: unknown }

type FormulaCondition = { col: string; operator: '>' | '<' | '=' | '!=' | 'empty' | 'not_empty'; value?: unknown }
```

### Motor de cómputo

```typescript
// lib/formula-engine.ts
export function computeFormula(config: FormulaConfig, row: Record<string, unknown>): unknown
// Recibe settings.formula_config + row de valores planos (col_key → value).
// Retorna el valor computado (number | string | null).
// Puro — sin side effects, sin fetch, testeable con jest.
```

Llamado desde:
- `NativeRow` (sub-items L1/L2) en SubItemsView
- `ColumnCell` kind='formula' en GenericDataTable (items del board principal)

### UI en ColumnSettingsPanel

Tab "Fórmula" (visible solo si kind='formula'):
```
┌─────────────────────────────────────────────────┐
│  Tipo de fórmula:  [Aritmética ▾]               │
│                                                 │
│  Columna A:  [Cantidad     ▾]                   │
│  Operación:  [×  Multiplicar ▾]                 │
│  Columna B:  [Precio unitario ▾]                │
│                                                 │
│  Vista previa:  240 × 150 = 36,000              │
└─────────────────────────────────────────────────┘
```

### Tareas
- [x] **13.1** `lib/formula-engine.ts` — motor puro con todos los tipos
- [x] **13.2** Extender `kind='formula'` en `board_columns` (actualmente solo en sub_item_columns) — migration si necesario, ColumnCell dispatcher
- [x] **13.3** ColumnSettingsPanel: tab "Fórmula" con selector de tipo + columnas de referencia
- [x] **13.4** GenericDataTable: evaluar fórmulas en columnas de board_columns kind='formula'

### Verificación
- [x] `Precio unitario` × `Cantidad` → columna Total computable en sub-items
- [x] Misma fórmula funciona en columnas del board principal (items)
- [ ] `date_diff(deadline, hoy)` → "días restantes" en columna de oportunidades
- [x] Cambiar una columna fuente → fórmula re-evalúa sin refresh

---

## Fase 14 — Rollup Columns

**Goal:** Agregar valores de niveles inferiores hacia arriba: L2 → L1, L1 → Item, Item → columna del board. El caso clave de CMP: `sum(L2.cantidad)` visible en L1, y `sum(L1.total)` visible en la oportunidad.

### Concepto

Una columna `kind='rollup'` no almacena datos propios — agrega valores de sus descendientes. Read-only. Computada en frontend al cargar, recalculada si cambia un hijo.

```typescript
// settings.rollup_config en board_columns / sub_item_columns con kind='rollup'
type RollupConfig = {
  source_level: 'children' | 'descendants'  // L2 directos o todos los niveles
  source_col_key: string                     // col_key de la columna a agregar
  aggregate: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_not_empty'
}
```

### Niveles de rollup

| Columna rollup en | Agrega desde | Caso de uso |
|---|---|---|
| `sub_item_columns` (L1) | L2 hijos directos | `sum(L2.cantidad)` en cada L1 |
| `board_columns` | L1 sub-items del item | `sum(L1.total)` en la oportunidad |

### Motor de cómputo

```typescript
// lib/rollup-engine.ts
export function computeRollup(config: RollupConfig, row: SubItemData | ItemData): unknown
// row debe incluir children (pre-cargados) para source_level='children'
// Retorna number | string | null
```

El motor es llamado:
- En `NativeRow` para columnas rollup en sub_item_columns
- En `ColumnCell` kind='rollup' en GenericDataTable, con `row._subItemsRollup` precalculado

### Pre-cálculo en endpoint

Para columnas rollup en `board_columns`, el endpoint `GET /api/sub-item-views/[viewId]/data` ya devuelve la estructura `children`. El endpoint de items (`GET /api/items?boardId=`) necesita incluir sub-item aggregates cuando el board tenga columnas rollup:

```typescript
// Solo cuando board tiene columnas kind='rollup' en board_columns
// Añade a cada item: _rollup: { [col_key]: number | null }
```

### UI en ColumnSettingsPanel

Tab "Rollup" (visible solo si kind='rollup'):
```
┌─────────────────────────────────────────────────┐
│  Agregar desde:    [Sub-items L1 ▾]             │
│  Columna fuente:   [Total        ▾]             │
│  Función:          [Σ Suma       ▾]             │
│                                                 │
│  Resultado:  suma de "Total" de todos los       │
│              sub-items L1 de este item          │
└─────────────────────────────────────────────────┘
```

### Tareas
- [x] **14.0** Battery bar en `SubItemsView` — rollup visual de status: L2→L1 collapsed, barra segmentada por color/stage, `done/total · X% completado`. kind='rollup' implícito sobre columna status.
- [x] **14.1** `lib/rollup-engine.ts` — motor puro con todos los aggregates (sum/avg/count/min/max/count_not_empty, children + descendants)
- [x] **14.2** Soporte kind='rollup' en `sub_item_columns` — evaluar en NativeRow al renderizar L1; rollups computados ANTES que fórmulas para que puedan usarse como operandos
- [x] **14.3** Soporte kind='rollup' en `board_columns` — pre-calcular aggregates en `GET /api/items` + `RollupCell` (teal) en GenericDataTable
- [x] **14.4** ColumnSettingsPanel: tab "Rollup" con selector de nivel + columna fuente + función; fetch `/api/boards/[id]/sub-item-columns`
- [x] **14.5** Recalculo reactivo: editar un L2 → L1 rollup actualiza inmediatamente (optimistic patch en árbol de estado); fila de totales en pie de tabla con sum/avg/min/max/count por columna numérica, fórmula y rollup — click cicla función

### Verificación
- [ ] `sum(L2.cantidad)` visible en cada L1 de sub-items
- [ ] `sum(L1.total_formula)` visible como columna en la tabla de Oportunidades
- [ ] Editar cantidad en L2 → total en L1 cambia inmediatamente (sin refresh)
- [ ] `count_not_empty(L1.firma)` → "Firmas completadas: 3/5" en el item

### Bugs y mejoras completadas en esta fase
- [x] **14.B1** Fix hydration mismatch en `GenericDataTable` — `columnSizing` inicializa como `{}`, lee localStorage solo en `useEffect`
- [x] **14.B2** Aislamiento de vistas de sub-items — migration `view_id uuid FK sub_item_views` en `sub_items`; `POST /api/sub-items` guarda `view_id`; `nativeHandler` filtra por `view_id` con fallback legacy (`view_id IS NULL`)
- [x] **14.B3** Botón eliminar vista de sub-items — `×` en tab strip de `SubItemsView` (solo si `views.length > 1` y `onDeleteView` provisto); endpoint `DELETE /api/boards/[id]/sub-item-views/[viewId]` usa `sub_item_views.workspace_id` directo (evita RLS en boards)
- [x] **14.B4** Gate admin para operaciones destructivas — eliminar vistas de board, eliminar boards, eliminar vistas de sub-items: solo `admin | superadmin`; prop `userRole` en `BoardView` desde `page.tsx`
- [x] **14.B5** Gestión de roles en `Settings → Miembros` — endpoint `PATCH /api/workspace-users/[userId]` (admin-only; no permite asignar `superadmin`); bootstrap: miembro puede auto-promoverse a admin si no existe ningún admin en el workspace; migration eleva primer miembro sin admin a `admin`
- [x] **14.B6** Fix tipos de columna en `AddColumnInline` — 13 tipos completos (text, number, select, date, relation, formula, rollup, file, user, url, phone, boolean, email); `stopPropagation` en wrapper y select para evitar que el dropdown se cierre solo
- [x] **14.B7** SourceColumnMapper: columnas no se creaban — duplicación silenciosa por unique constraint `(board_id, col_key)` cuando `source_col_key` ya existía; ahora re-usa la columna existente y la retorna en `savedColumns` para sincronizar estado BoardView
- [x] **14.B8** Fix RLS en `GET /api/sub-item-views/[viewId]/data` — `nativeHandler` usaba `createClient()` (JWT de usuario, sujeto a RLS); la política de `sub_item_columns_select` hace un subquery a través de `boards` que falla silenciosamente retornando 0 columnas; cambiado a `createServiceClient()` después de validar workspace_id manualmente (auth ya validado por `requireAuthApi()`)
- [x] **14.B9** Columnas de sub-items con scope por vista — `sub_item_columns` compartía columnas entre todas las vistas nativas del board; migration `20260414000008` agrega `view_id uuid FK sub_item_views`; `nativeHandler` filtra por `view_id`; `POST sub-item-columns` acepta `view_id`; `AddColumnInline` y `SourceColumnMapper` pasan `view_id`; `onConfigureColumns` en `SubItemsView` recibe el `viewId` de la vista activa

### Fase 14.C — Column permissions parity (sub-item columns = 1st class citizens)

**Goal:** Permisos por columna funcionan igual para `board_columns` y `sub_item_columns`. `ColumnSettingsPanel` es 100% genérico — sin tabs ocultos ni lógica de endpoint hardcodeada.

**Decisión:** No fusionar `board_columns` + `sub_item_columns` (tienen semánticas distintas: is_system, source_col_key, view_id). Solo extender `column_permissions` para soportar ambas.

#### Tareas
- [x] **14.C1** Migration `20260414000009`: `column_permissions.column_id` nullable + `sub_item_column_id uuid FK sub_item_columns` + constraint `exactly_one` + RLS actualizado
- [x] **14.C2** API routes `GET/POST /api/sub-item-columns/[colId]/permissions/route.ts` + `DELETE /api/sub-item-columns/[colId]/permissions/[permId]/route.ts` — idénticas a board columns permissions pero con `sub_item_column_id`
- [x] **14.C3** `ColumnSettingsPanel`: reemplazar `!patchEndpoint → muestra Permisos` por prop `permissionsEndpoint?: string`; usar en todas las URLs del tab Permisos; pasar desde SubItemsView headers, SubItemDetailDrawer, y ItemDetailView

### Nota RLS — patrón confirmado
En rutas API que ya validaron autorización con `requireAuthApi()` + check de `workspace_id`, usar siempre `createServiceClient()` para las queries de datos, NO `createClient()`. El RLS de tablas con políticas que hacen subqueries a través de `boards` (ej. `sub_item_columns`, `sub_item_values`) puede retornar 0 filas silenciosamente con JWT de usuario incluso cuando el usuario es el dueño correcto del workspace.

---

## Fase 15 — Column Validations + IF Formula + Stage Gates

**Goal:** Validaciones nativas por columna. Las condiciones viven en la columna, no en la etapa. El stage gate es un botón (`kind='button'`) que evalúa todas las columnas con validación antes de avanzar.

### Diseño

**Decisión arquitectónica (sesión 27):** Las condiciones no viven en `board_stages.entry_conditions` sino en `board_columns.settings.validation`. Ventaja: la columna sabe si está "ok", visible inmediatamente en la tabla. Para sub-item aggregates se usan rollup columns como intermediarias — la condición solo referencia col_keys del mismo nivel (incluyendo rollups).

#### Validación por columna

```typescript
// board_columns.settings.validation  (jsonb — sin migration)
{
  condition: {
    col: string            // cualquier col_key del mismo nivel, incluyendo rollups
    operator: 'empty' | 'not_empty' | '>' | '<' | '=' | '!=' | 'contains' | 'not_contains'
    value?: unknown        // literal; para 'contains' sobre multiselect = string a buscar
  },
  message: string          // "Cantidad debe ser mayor a 0"
}
```

**Ejemplo cross-level (via rollup):**
- Rollup column `total_l1_qty = sum(L1.cantidad)` ya existe en el board
- Validation en esa columna: `{ col: 'total_l1_qty', operator: '>', value: 0 }`

#### IF fórmula (completa)

```typescript
// formula_config en board_columns / sub_item_columns con kind='formula'
{ type: 'if'; condition: FormulaCondition; col_true: string | number; col_false: string | number }
// col_true / col_false = col_key ó literal (number o string prefijado "literal:")
```

#### Default value

```typescript
// board_columns.settings.default_value  (jsonb — sin migration)
// Tipo ajustado al kind de la columna; se aplica al crear item/sub-item nuevo
```

#### Button column como stage gate

```typescript
// board_columns.settings  (kind='button')
{
  action: 'change_stage',
  target_stage_id: 'uuid'    // estático por ahora
  label?: string             // texto del botón, default = nombre de la columna
}
```

**Flujo al click:**
1. Recolecta todas las columnas del board con `settings.validation`
2. Evalúa `evaluateCondition(condition, row)` para cada una
3. Si alguna falla → cells rojos + toast con mensajes, sin cambio de etapa
4. Si todas ok → `PATCH /api/items/[id] { stage_id }`

### Tareas
- [x] **15.1** `formula-engine.ts`: agregar `contains`/`not_contains` a `evaluateCondition`; exportar función; tipar `FormulaCondition` con nuevo operador
- [x] **15.2** `ColumnSettingsPanel` tab **Fórmula** completo: UI para `type: 'if'` (condition builder + true/false; columna o literal); `handleSaveFormula` guarda IF config
- [x] **15.3** `ColumnSettingsPanel` tab **Validación** (nuevo, todos los kinds): condition builder reutilizando mismos inputs; campo mensaje; `handleSaveValidation` hace PATCH en `settings.validation`
- [x] **15.4** `ColumnSettingsPanel` tab **General**: campo "Valor por defecto" según kind (text input / number / date / select dropdown / checkbox / user picker); `POST /api/items` aplica default_value al crear
- [x] **15.5** `ColumnCell`: si `column.settings.validation` existe, evalúa contra row → borde rojo + ❌ en esquina cuando falla; fallback a col_key propio cuando `condition.col` vacío; NativeRow sub-items también muestra overlay rojo
- [x] **15.6** `ButtonCell` (`action: 'change_stage'`): antes de ejecutar, evalúa validaciones de todas las columnas del board → lista de mensajes bloqueantes inline; botón rojo cuando hay fallas
- [x] **15.7** `GenericDataTable` propaga `allColumns` + `row` a cada `ColumnCell`; `ColumnSettings` tipado con `validation`, `default_value`, `target_stage_id`, `rollup_config`

### Bugs corregidos (sesión 27)
- [x] `conditionMatches`: null/undefined ya no pasa `>` / `<` — `String(null)>"0"` era `true` lexicográfico
- [x] NativeRow en SubItemsView: `formulaCols` y `rollupCols` muestran overlay rojo ❌ igual que `displayCols`
- [x] `AddColumnButton` popover se abre a la izquierda cuando está al borde derecho de la ventana
- [x] `AddColumnButton` panel no se cierra al interactuar con el selector — reemplazado `<select>` nativo por lista de botones (portal)
- [x] `AddColumnInline` en sub-items: mismo fix selector + `z-20` en wrapper para no conflictar con resize handles

### Fase 15.B — Stage Gates rediseño (sesión 27)
- [x] **15.B.1** `ColumnSettingsPanel` columna Botón: tab General completo con label, acción (radio), stage destino, confirmación — todo en un `handleSaveButtonConfig`
- [x] **15.B.2** Gates movidos de columna Botón a columna **Etapa**: `settings.stage_gates = { [stage_id]: [col_keys] }` — un solo lugar de config
- [x] **15.B.3** Tab Validación columna Etapa: todas las etapas expandidas, cada una con checklist de columnas con validación configurada
- [x] **15.B.4** Tab Validación columna Botón: mensaje redirect a columna Etapa (sin builder propio)
- [x] **15.B.5** `ButtonCell.runValidations()`: lee `stage_gates[target_stage_id]` de la stage column en `allColumns`; evalúa solo esas columnas
- [x] **15.B.6** `ColumnSettings` tipado con `stage_gates`; `allColumns` en BoardView y SubItemsView pasa `settings`
- [x] **15.B.7** `isStageCol` matchea `col_key === 'stage'`; stages se cargan para botón y stage col
- [x] **15.B.8** `GET /api/boards/[id]/stages`: usa `createServiceClient()` para evitar bloqueo silencioso por RLS

### Verificación
- [ ] Columna "Cantidad" con validation `> 0` → cell roja mientras el valor es 0 o vacío
- [ ] Rollup `total_l1_qty` con validation `> 0` → cell roja si no hay sub-items con cantidad
- [ ] IF formula `IF(precio > 1000, "Premium", "Estándar")` → muestra texto correcto según valor
- [ ] IF con `contains` en multiselect → `IF(colores contains "rojo", 1, 0)` funciona
- [ ] Columna Etapa → Validación → tilda condiciones por stage → guarda `stage_gates`
- [ ] Botón con `target_stage_id` → bloquea si gates del stage destino no se cumplen; avanza si ok
- [ ] Default value en columna select → nuevo item ya trae la opción preseleccionada

### Fixes pendientes (antes de Fase 16)
- [ ] **fix-sv-1** Permitir eliminar TODAS las vistas de sub-items, incluyendo la vista "Sub-items" default (actualmente deshabilitado en `SubItemsView`). Si se elimina la última vista → estado vacío con botón "Agregar vista". Sin protección obligatoria sobre la primera vista.

---

## Fase 16 — Herencia de Permisos de Columna

**Goal:** Los permisos de columna viajan con los datos. Si una columna es privada para Compras en el catálogo, Ventas no la ve nunca — ni en el board, ni en sub-items, ni en un snapshot de cotización. Pre-requisito obligatorio antes de Fase 17 (Quotes).

### El problema sin esta fase

```
Board "Catálogo"
  └── col 'costo_interno' → column_permission: solo equipo Compras (edit/view)
                            Ventas no tiene acceso

Sin herencia de permisos:
  Vendedor genera cotización → snapshot copia sub-items al board 'quotes'
  → sub-item tiene campo 'costo_interno' con el valor copiado
  → Ventas abre el quote item → ve 'costo_interno' ← BRECHA
```

### Solución: enforcement en tres capas

#### Capa 1 — Snapshot engine respeta permisos de la fuente

Al copiar sub-items (snapshot), el engine verifica si el usuario que genera tiene VIEW access a cada columna de origen. Si no tiene acceso → el valor NO se copia, el campo queda vacío en el destino.

```typescript
// lib/snapshot-engine.ts — lógica extendida
for (const col of sourceColumns) {
  const canView = await userCanViewColumn(col.id, ctx.userId, ctx.workspaceId)
  if (!canView) continue   // omite silenciosamente — sin error, sin valor
  values[col.col_key] = sourceItem.values[col.col_key]
}
```

#### Capa 2 — `permission_mode` en sub_item_columns

```sql
-- sin migration nueva: agrega campo a sub_item_columns
sub_item_columns.permission_mode text DEFAULT 'public'
  -- 'public'  : visible para todos los miembros del board (comportamiento actual)
  -- 'inherit' : hereda los column_permissions de la columna fuente (source_col_key)
  -- 'custom'  : usa column_permissions propios en la tabla column_permissions
```

Cuando `permission_mode = 'inherit'` y `source_col_key` está configurado:
- El sistema busca los `column_permissions` de la columna fuente en el board de origen
- Aplica exactamente los mismos grupos/usuarios al renderizar la columna destino
- Si el usuario no tiene VIEW en la fuente → celda vacía y no editable en destino

#### Capa 3 — RelationCell no muestra columnas prohibidas

Al mostrar datos de un board relacionado en una RelationCell (preview del item relacionado), el renderer consulta `column_permissions` del board destino para el usuario actual y oculta las columnas sin acceso. El valor del campo `value_text` (item_id) sigue guardándose — solo cambia lo que se muestra.

### UI en ColumnSettingsPanel (sub_item_columns)

Tab "Permisos" cuando `source_col_key` está configurado:
```
Modo de permisos:
  ○ Público (todos los miembros del board)
  ● Heredar del origen  ← si se elige: muestra "heredando de [col_name] en [board_name]"
  ○ Personalizado (configurar manualmente)
```

### Capa 4 — Row-level constraints (restrict_to_own completo)

`restrict_to_own` ya existe en `board_members` (Fase 9) y se aplica en `GET /api/items`. Esta fase audita y extiende el enforcement a todos los puntos donde un vendedor podría ver items que no son suyos.

**Puntos de enforcement que faltan:**

| Punto | Riesgo sin enforcement | Fix |
|-------|----------------------|-----|
| `GET /api/sub-items?itemId=X` | Vendedor A puede pedir sub-items de un item de Vendedor B si sabe el `item_id` | Verificar que el item padre es accesible antes de devolver sub-items |
| Snapshot engine | Al generar quote, si `source_item_id` apunta a item de otro usuario | Validar acceso al item fuente antes de copiar |
| `RelationCell` picker | El picker de items relacionados muestra todos los items del board, no solo los del vendedor | Picker respeta `restrict_to_own` al listar opciones |
| `GET /api/items` con `boardId` directo | Si alguien llama la API con un `boardId` sabiendo IDs | Ya cubierto en Fase 9, pero auditar service client leaks |
| `GET /api/boards/[id]/sub-item-views/[viewId]/data` | Data endpoint del NativeRenderer podría no aplicar `restrict_to_own` en el join con items | Verificar filtro en el data endpoint |

```typescript
// lib/permissions.ts — función nueva
export async function userCanAccessItem(itemId: string, userId: string, workspaceId: string): Promise<boolean> {
  // 1. Item existe y pertenece al workspace
  // 2. Usuario tiene acceso al board (board_members o público)
  // 3. Si restrict_to_own=true en board_members → item.owner_id === userId
}
```

Esta función se llama en: `GET /api/sub-items`, snapshot engine, `POST /api/sub-items/[id]/refresh`, `POST /api/sub-items/[id]/expand`.

### Tareas

#### 16.A — Column permissions
- [ ] **16.1** Migration: agregar `permission_mode text DEFAULT 'public'` a `sub_item_columns`
- [ ] **16.2** `lib/permissions.ts`: `userCanViewColumn(columnId, userId, workspaceId)` — consulta `column_permissions`; si no hay registros → true (público); acepta tanto `column_id` como `sub_item_column_id`
- [ ] **16.3** `lib/permissions.ts`: `resolveInheritedPermissions(subItemColId)` — si `permission_mode='inherit'`, resuelve los permisos de la columna fuente y los aplica
- [ ] **16.4** Snapshot engine: antes de copiar cada valor, llama `userCanViewColumn` sobre la columna fuente; si false → omite el valor silenciosamente
- [ ] **16.5** `ColumnCell` + `NativeRow`: antes de renderizar, verifica permisos de la columna; si sin VIEW → celda vacía, no editable, sin tooltip de valor
- [ ] **16.6** `RelationCell` preview: al mostrar campos del item relacionado, filtra columnas que el usuario no puede ver en el board destino
- [ ] **16.7** `ColumnSettingsPanel` tab Permisos en sub_item_columns: radio `permission_mode` (Público / Heredar del origen / Personalizado); si Heredar → muestra de dónde hereda

#### 16.B — Row-level constraints (restrict_to_own audit)
- [ ] **16.8** `lib/permissions.ts`: `userCanAccessItem(itemId, userId, workspaceId)` — valida board membership + restrict_to_own en un solo helper reutilizable
- [ ] **16.9** `GET /api/sub-items`: antes de devolver, verifica `userCanAccessItem` sobre el item padre; 403 si no tiene acceso
- [ ] **16.10** `POST /api/sub-items/[id]/refresh` + `/expand`: verificar acceso al item padre y al source_item_id antes de ejecutar
- [ ] **16.11** `GET /api/boards/[id]/sub-item-views/[viewId]/data` (NativeRenderer data endpoint): aplicar join con items y filtrar por `restrict_to_own` si aplica al board
- [ ] **16.12** `RelationCell` picker: al listar opciones del board relacionado, aplicar `restrict_to_own` del usuario en ese board (vendedor solo puede relacionar items que ve)
- [ ] **16.13** Audit de rutas con `createServiceClient()`: revisar que todas las rutas que usan service client aplican manualmente `workspace_id` + `restrict_to_own` donde corresponde (no delegan seguridad a RLS)

### Verificación
- [ ] `costo_interno` en catálogo (solo Compras) → snapshot → Ventas abre quote → celda vacía y no editable
- [ ] Compras abre mismo quote → ve y edita `costo_interno`
- [ ] `permission_mode='inherit'` → cambiar permisos en fuente → refleja en todos los boards que heredan
- [ ] RelationCell en oportunidades → Ventas no ve `costo_interno` en preview de producto
- [ ] Vendedor A no puede obtener sub-items de item de Vendedor B aunque conozca el `item_id`
- [ ] RelationCell picker solo muestra items a los que el usuario tiene acceso (respeta `restrict_to_own`)

---

## Fase 17 — Quote Engine

**Goal:** Generación de cotizaciones PDF desde items del pipeline. Los datos viven en el item (oportunidad) + sus sub-items (productos). El board `quotes` es tracking e historial, no fuente de datos.

### Arquitectura

```
Generación (N veces por oportunidad — v1, v2... v8):
  Oportunidad (item)
    └── Sub-items en vista "Catálogo" — costeados y validados por compras
    └── Botón "Generar cotización" (ButtonCell, action: 'generate_quote')
          ↓
       validatePreConditions()   ← bloquea si faltan datos
          ↓
       SNAPSHOT: copia sub-items de la vista fuente (sub_item_view_id)
       al nuevo quote item — mismo engine que Fase 5 (source_item_id)
          ↓
       Item creado en board 'quotes'
            - Relation → esta oportunidad
            - Relation → contacto
            - Sub-items propios = snapshot de los sub-items copiados
              (editables independientemente: markup, descuentos, ajustes)
            - Columna firma (signature, vacía)
            - Stage: Borrador
            - version = count previos + 1
          ↓
       Edge Function generate-quote
       lee sub-items DEL QUOTE ITEM (no de la oportunidad)
          ↓
       PDF sin firma → Supabase Storage → columna file del quote item

Firma electrónica (después de generar):
  Quote item (en board 'quotes')
    └── Columna 'firma' (kind='signature')
    └── settings.on_sign: { regenerate_pdf: true, change_stage_to: 'Aceptada' }
          ↓
       Cliente/vendedor hace click en "Firmar"
          ↓
       OTP captura firma → guarda en columna signature
          ↓
       Trigger automático: regenera PDF con firma embebida (watermark)
          ↓
       Columna 'pdf' del quote item actualizada con nuevo PDF firmado
          ↓
       Stage avanza automáticamente a 'Aceptada'

Tracking (board 'quotes', system_key='quotes'):
  stages:  Borrador → Enviada → Aceptada → Rechazada → Facturada
  columns: oportunidad (relation), contacto (relation), monto (number),
           pdf (file), firma (signature), fecha (date),
           generado_por (people), version (number)
  sub-items: snapshot de las líneas copiadas — precios BLOQUEADOS para vendedor
             columns:
               producto    (relation→catalog) — view only para todos
               qty         (number)           — vendedor puede editar
               precio_unit (number)           — solo equipo Compras puede editar
               descuento   (number)           — solo admin/Compras
               subtotal    (formula: qty * precio_unit * (1 - descuento/100)) — read-only

  column_permissions en sub_item_columns del board 'quotes' (seed default):
    precio_unit → equipo 'compras': edit | vendedor: view
    descuento   → equipo 'compras': edit | vendedor: view
    producto    → todos: view (inmutable post-snapshot)
    qty         → todos: edit
```

**Flujo correcto de precios:**
- Compras valida y captura `precio_unit` en la vista fuente (catálogo/cotización de la oportunidad)
- El vendedor genera el quote → snapshot copia sub-items con precios congelados
- El vendedor solo puede cambiar `qty` (cantidades) — no precios ni descuentos
- Si el cliente pide descuento → el vendedor lo solicita a compras/admin
- Compras edita `precio_unit` o `descuento` en el quote item → vendedor regenera el PDF (nueva versión)
- v1 a v8: cada versión refleja negociaciones reales (precio inicial, precio con descuento, etc.)
- El PDF siempre se genera desde los sub-items del QUOTE con los permisos ya aplicados

**No hay tabla `quotes` separada** — reemplazada por el board de sistema `quotes`. Cada PDF generado = un item en ese board. Las relaciones a contactos, cuentas y productos son columnas `relation` estándar.

```sql
-- Solo queda una tabla nueva:
quote_templates (id, workspace_id, board_id, name,
                 sub_item_view_id uuid REFERENCES sub_item_views(id),
                                        -- ← CUÁL vista usamos como fuente de líneas
                 header_fields jsonb,   -- col_keys del item → encabezado PDF
                 line_columns jsonb,    -- col_keys de ESA vista → filas PDF
                 footer_fields jsonb,   -- col_keys del item → pie (totales, impuestos)
                 show_prices boolean DEFAULT true,
                 pre_conditions jsonb DEFAULT '[]',
                 created_at timestamptz)
```

- **`sub_item_view_id`**: FK a `sub_item_views` de la oportunidad — la vista FUENTE cuyos sub-items se copian (snapshot) al nuevo quote item. Obligatorio. Ej: vista "Catálogo" (costeada por compras). No es la vista del quote — es de dónde se copia.
- `line_columns`: col_keys de los sub-items del QUOTE (destino del snapshot) que aparecen como columnas en el PDF. El board `quotes` tiene sus propias sub_item_columns estándar (producto, qty, precio_unit, descuento, subtotal).
- `header_fields`: col_keys del item que van en encabezado (cliente, fecha, folio)
- `footer_fields`: col_keys del item para pie (rollups de totales, impuestos, descuento global)
- **`signature_col_key`**: col_key de la columna `kind='signature'` en el board `quotes`. Si está configurado, el PDF generado inicialmente va sin firma; cuando esa columna se firma → PDF se regenera con la firma embebida.
- PDF generado con `@react-pdf/renderer` en Edge Function, guardado en Supabase Storage

**Configuración de firma en `board_columns.settings` (columna `kind='signature'` en board quotes):**
```typescript
{
  on_sign: {
    regenerate_pdf: true,           // regenera el PDF del quote con la firma embebida
    pdf_col_key: 'pdf',             // col_key de la columna file donde actualizar el PDF
    change_stage_to: 'stage_uuid'   // avanza etapa automáticamente al firmar (ej: Aceptada)
  }
}
```

**En la UI del template editor:** el selector de `line_columns` solo muestra columnas de la vista elegida en `sub_item_view_id`. Si cambia la vista → se limpia `line_columns` para forzar reconfiguración.

**Vista "Cotización" es una `sub_item_view` normal** — no hay tipo especial. El `quote_template.sub_item_view_id` simplemente apunta a ella. El vendedor edita los sub-items en esa vista igual que en cualquier otra. Si al configurar el primer template el board aún no tiene vistas de sub-items, la UI ofrece crear una vista "Cotización" con columnas default (producto relation, qty number, precio_unit number, descuento number, subtotal formula); si ya tiene vistas, solo elige cuál usar.
- Si item tiene columna `kind='signature'` firmada → watermark en footer del PDF

### Pre-condiciones para generar cotización (validaciones cruzadas)

Antes de permitir generar el PDF, el template puede requerir que ciertas columnas estén en estado específico. Estas condiciones van en `quote_templates.pre_conditions` (jsonb array):

```typescript
// quote_templates.pre_conditions
[
  // Condición sobre columna del item
  { level: 'item', col_key: 'estado_aprobacion', operator: '=', value: 'Aprobado',
    message: 'La oportunidad debe estar aprobada antes de cotizar' },

  // Condición sobre columna de status del sub-item (requiere que TODOS o AL MENOS UNO cumplan)
  { level: 'subitem', col_key: 'status', operator: '!=', value: 'Sin precio',
    match: 'all',   // 'all' | 'any'
    message: 'Todos los productos deben tener precio asignado' },

  // Condición sobre columna de sub-item (ej: rollup suma > 0)
  { level: 'item', col_key: 'total_cotizacion', operator: '>', value: 0,
    message: 'La cotización no puede ser de $0' },
]
```

**Flujo al clickear "Generar cotización":**
1. Evalúa cada `pre_condition` contra el item + sus sub-items actuales
2. Si alguna falla → lista de mensajes bloqueantes, sin generar PDF (igual que stage gates)
3. Si todas pasan → genera PDF

**Columnas disponibles para condiciones:**
- Cualquier `col_key` del item (incluyendo fórmulas y rollups)
- Cualquier `col_key` de sub_item_columns del board (para condiciones a nivel sub-item)
- El operador `level: 'subitem'` con `match: 'all'` exige que todos los sub-items cumplan; `match: 'any'` basta con uno

### Campos adicionales del board `quotes` y del PDF

```
board 'quotes' — columnas extra:
  folio        (autonumber) ← COT-2024-001, requerido B2G
  vigencia     (date)       ← fecha de expiración de la cotización
  iva_pct      (number)     ← % IVA, default 16; configurable por workspace/template
  moneda       (select)     ← MXN por defecto; USD si aplica
  notas        (text)       ← condiciones generales, tiempo de entrega, etc.

PDF — secciones:
  Header:  logo del workspace + datos fiscales + folio + fecha + vigencia
  Datos:   cliente, institución, vendedor, referencia (oportunidad)
  Tabla:   líneas (producto, qty, precio_unit, descuento%, subtotal)
  Footer:  subtotal sin IVA | IVA (16%) | TOTAL | vigencia | notas
           [firma digital si existe]
```

**Folio:** columna `autonumber` en el board `quotes` — usa el engine de autonumber que ya existe. Formato configurable en `workspaces.settings.quote_folio_prefix` (ej: `"COT-{YYYY}-{N}"` → `COT-2024-001`).

### Tareas
- [ ] **17.1** Migration: `quote_templates`; agregar `system_key='quotes'` a `seed_system_boards` con:
  - stages: Borrador/Enviada/Aceptada/Rechazada/Facturada
  - board_columns: oportunidad(relation), contacto(relation), monto(number), pdf(file), firma(signature), folio(autonumber), vigencia(date), iva_pct(number, default 16), moneda(select: MXN/USD), notas(text), generado_por(people), version(number)
  - sub_item_columns: producto(relation→catalog), qty(number), precio_unit(number), descuento(number), subtotal(formula)
  - column_permissions seed: precio_unit/descuento → solo equipo `compras` edita; qty → todos editan; producto → view only
- [ ] **17.2** `workspaces.settings.quote_folio_prefix` — campo en Settings → Workspace para configurar el formato del folio (ej: `COT-{YYYY}-{N}`)
- [ ] **17.3** Settings → Boards → tab "Cotizaciones": CRUD de templates
  - **Paso 1 — Vista fuente**: dropdown de `sub_item_views` del board (vista de donde se copian los sub-items); cambiar vista limpia `line_columns`
  - **Paso 2 — Columnas PDF**: header_fields (col_keys del item), line_columns (col_keys de la vista fuente), footer_fields (col_keys del item: subtotales, IVA, total)
  - **Paso 3 — Condiciones**: pre_conditions con level picker, col_key, operator, value, match, mensaje
  - Preview con datos ficticios + logo del workspace
- [ ] **17.4** `lib/quote-validator.ts`: `validatePreConditions(template, item, subItems)` → `{ ok, errors[] }`; reutiliza `evaluateCondition` de formula-engine
- [ ] **17.5** Edge Function `generate-quote`:
  - Input: `{ item_id, template_id, user_id, signature_data_url? }`
  - Fetch item + sub-items de la vista fuente (`sub_item_view_id`) + valores + logo del workspace
  - Snapshot: copia sub-items al nuevo quote item (respeta Fase 16 column permissions)
  - Calcula `subtotal`, `iva`, `total` en servidor antes de pasar al PDF
  - Render PDF con `@react-pdf/renderer` incluyendo logo, folio, vigencia, IVA, firma si viene
  - Upload → Supabase Storage → URL
  - Crea item en board `quotes`: folio auto, relations, version++, pdf en columna file
  - Retorna `{ pdf_url, quote_item_sid, folio }`
- [ ] **17.6** `ButtonCell` `action: 'generate_quote'`: corre `validatePreConditions`; si falla → errores inline; si ok → llama `POST /api/generate-quote`
- [ ] **17.7** `POST /api/generate-quote`: `requireAuthApi()` → `validatePreConditions` → Edge Function → retorna `{ pdf_url, folio, quote_item_sid }`
- [ ] **17.8** `SignatureCell` `settings.on_sign`: al firmar, llama `POST /api/generate-quote/[quoteItemId]/sign` → regenera PDF con firma embebida → actualiza columna `pdf` del quote → avanza stage si `change_stage_to` configurado
- [ ] **17.9** Tab "Cotizaciones" en ItemDetailView:
  - Lista: folio, fecha, vigencia, versión, stage badge, ✍️ si firmada, monto total
  - Botón "Nueva cotización" (genera nueva versión sin pisar las anteriores)
  - Click en quote → preview PDF en modal + descarga + link compartible
  - Botón "Firmar" si `signature_col_key` configurado y aún no firmada
  - Indicador visual si la vigencia ya expiró (fecha pasada → badge rojo "Expirada")

### Verificación
- [ ] Cotización bloqueada si sub-item tiene `status = 'Sin precio'` y `match: 'all'`
- [ ] Cotización bloqueada si `total_cotizacion = 0` (rollup)
- [ ] PDF generado desde oportunidad con sub-items (L1+L2) → filas desglosadas por talla
- [ ] Al generar → item aparece automáticamente en board `quotes` con relation a la oportunidad y al contacto
- [ ] Versiones: generar 3 veces desde la misma oportunidad → v1, v2, v3 independientes en el historial
- [ ] Firmar quote → PDF se regenera con firma embebida; stage avanza a Aceptada automáticamente
- [ ] PDF sin firma ≠ PDF con firma — el link del PDF en el quote item apunta siempre a la versión más reciente
- [ ] Stage del quote actualizable manualmente desde el board `quotes` (Borrador → Enviada → etc.)

---

## Fase 18 — Tratto AI Agent + Sidebar Chat

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

#### 17.A — Engine core
- [ ] **17.1** Migration: `chat_sessions` + `chat_messages` + índice
- [ ] **17.2** `lib/tratto-agent/types.ts`: `AgentInput`, `AgentOutput`, `ChatMessage`, `TrattoTool`, `ToolResult`, tipos para cada tool input/output
- [ ] **17.3** `lib/tratto-agent/context.ts`: `buildSystemPrompt(user, workspace, board?)` — inyecta fecha MX, usuario, board activo
- [ ] **17.4** `lib/tratto-agent/session.ts`: `loadOrCreateSession()`, `loadHistory(sessionId, limit=20)`, `appendMessage()` — usa serviceClient
- [ ] **17.5** `lib/tratto-agent/tools/search-items.ts`: tool `search_items` — query full-text + filtros (board_key, stage, owner_me, overdue); retorna array con sid, name, stage, owner, deadline
- [ ] **17.6** `lib/tratto-agent/tools/get-item.ts`: tool `get_item` — fetch item por sid + valores de columnas + count sub-items
- [ ] **17.7** `lib/tratto-agent/tools/create-item.ts`: tool `create_item` — `POST /api/items` internamente; resuelve board_key→board_id, stage_name→stage_id
- [ ] **17.8** `lib/tratto-agent/tools/update-item.ts`: tool `update_item` — `PUT /api/items/[id]/values`; acepta `Record<col_key, value>`
- [ ] **17.9** `lib/tratto-agent/tools/change-stage.ts`: tool `change_stage` — evalúa stage gates antes de ejecutar; retorna error descriptivo si bloquea
- [ ] **17.10** `lib/tratto-agent/tools/add-message.ts`: tool `add_message` — postea en canal General del item
- [ ] **17.11** `lib/tratto-agent/tools/list-boards.ts` + `get-board-summary.ts`: tools de consulta de boards
- [ ] **17.12** `lib/tratto-agent/tools/index.ts`: `TRATTO_TOOLS` — array con `name`, `description`, `input_schema` para cada tool (formato Anthropic tool_use)
- [ ] **17.13** `lib/tratto-agent/agent.ts`: loop principal — `runAgent(input: AgentInput)` → llama Claude API con `tool_use`, ejecuta tools en loop hasta `stop_reason='end_turn'`, retorna `AgentOutput`; soporta modo streaming y batch

#### 17.B — Transport sidebar (web)
- [ ] **17.14** `app/api/chat/route.ts`: endpoint POST, SSE streaming — `requireAuthApi()`, carga sesión, llama `runAgent()` en modo stream, envía eventos `{ type: 'text_delta' | 'tool_start' | 'tool_end' | 'done' }`
- [ ] **17.15** `components/ChatPanel.tsx`: drawer derecho 400px, toggle desde header, burbujas user/assistant, streaming render, indicadores de tool calls, scroll automático
- [ ] **17.16** `hooks/useChat.ts`: maneja SSE stream, estado de mensajes, `sessionId` en sessionStorage, función `sendMessage(text)`
- [ ] **17.17** Integrar `<ChatPanel>` en layout principal — botón en header, contexto del board activo pasado como prop

#### 17.C — Verificación
- [ ] "busca oportunidades de Juan que estén en propuesta" → lista correcta
- [ ] "crea un contacto llamado María García, teléfono 5512345678" → item creado, responde con sid
- [ ] "mueve la oportunidad 10000150 a Ganado" → respeta stage gates; si falla, explica qué columnas bloquean
- [ ] Tool indicators visibles durante ejecución ("Buscando items en Oportunidades...")
- [ ] Historial persiste al navegar entre boards (sessionStorage)
- [ ] Mismo `runAgent()` funciona en modo batch (sin stream) para WhatsApp adapter

---

## Fase 19 — WhatsApp Integration

**Goal:** WhatsApp como transporte adicional del mismo engine de Fase 17. Zero código de IA nuevo — solo adapter Twilio → `runAgent()`.

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
- [ ] **18.1** Edge Function `twilio-webhook`:
  - Recibe mensaje WA entrante (Twilio signature verify)
  - Lookup usuario por `phone` en `users` (E.164)
  - Llama `runAgent({ userId, workspaceId, message, transport: 'whatsapp' })` en modo batch
  - Formatea respuesta para WA (sin markdown, máx 1600 chars)
  - `sendWhatsApp(phone, text)` vía `whatsapp-outbound`
- [ ] **18.2** Edge Function `mentions-trigger`:
  - Cron cada 2 min
  - Busca `mentions WHERE notified=false`
  - Envía WA con preview del mensaje + link al canal
  - Marca `notified=true`
- [ ] **18.3** Edge Function `daily-digest`:
  - Cron 8:30 AM America/Mexico_City
  - Query directa (sin agente): items overdue + items due today + menciones sin responder por usuario
  - Mensaje WA formateado
- [ ] **18.4** Edge Function `whatsapp-outbound`:
  - Sender genérico: `sendWhatsApp(phone, message)` via Twilio REST API
- [ ] **18.5** UI: Settings → Workspace → tab "WhatsApp"
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
