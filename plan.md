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
Fase 8: Settings (boards, stages, columns, members, teams, territories)
   ↓
Fase 9: Permisos (RLS real, board_members, column_permissions, territories)
   ↓
Fase 10: WhatsApp + Quote Engine (features avanzadas)
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

**Goal:** Importar data a cualquier board desde Airtable o CSV.

### Tareas
- [ ] **6.1** `ImportWizard.tsx` + `ImportarAirtable.tsx` + `ImportarCSV.tsx`
- [ ] **6.2** API: `POST /api/import/{airtable,csv}`
- [ ] **6.3** Integrar en BoardView toolbar

### Verificación
- [ ] Import CSV a catalog → items con sids nuevos
- [ ] Import Airtable → mapeo de columnas → items creados
- [ ] Funciona en CUALQUIER board

---

## Fase 7 — Canales + Activity Log

**Goal:** Comunicación interna + audit trail.

### Tareas
- [ ] **7.1** `ItemChannels.tsx` + `ActivityFeed.tsx`
- [ ] **7.2** API: channels, messages, members, activity
- [ ] **7.3** Integrar como tabs en ItemDetailView

---

## Fase 8 — Settings

**Goal:** Admin configura boards, stages, columns, members, teams, territories.

### Tareas
- [ ] **8.1** Settings layout + nav
- [ ] **8.2** Boards: CRUD + stages + columns + **members tab** (agregar users o teams con view/edit)
- [ ] **8.3** Teams: `GroupList.tsx` genérico
- [ ] **8.4** Territories: `GroupList.tsx` genérico
- [ ] **8.5** Workspace config
- [ ] **8.6** Superadmin: workspace switcher
- [ ] **8.7** Column permissions UI (en board detail → column settings)

---

## Fase 9 — Permisos granulares

**Goal:** RLS real con board_members y column_permissions.

### Tareas
- [ ] **9.1** RLS refinado: board_members (user o team) con access level
- [ ] **9.2** Column visibility: frontend filtra columnas según column_permissions del user
- [ ] **9.3** Territory filtering en items
- [ ] **9.4** Verificar: member sin acceso al board → NO ve items

---

## Fase 10 — WhatsApp + Quote Engine

**Goal:** Features avanzadas sobre base sólida.

### Tareas
- [ ] **10.1** Edge Functions: twilio_webhook, mentions-trigger, daily-digest
- [ ] **10.2** Quote templates CRUD
- [ ] **10.3** PDF generation
- [ ] **10.4** Tab "Cotización" en ItemDetailView

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
