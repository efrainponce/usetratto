# Tratto — start.md

> **Regla #1:** Todo es un board. Un board es una tabla. Una tabla es igual a otra.
> **Regla #2:** Nunca repitas código. Si algo sirve para un board, sirve para todos.
> **Regla #3:** Simple > Clever. Si no lo entiende un junior en 5 min, es muy complejo.

---

## ¿Qué es Tratto?

Airtable + Monday, simplificado. Boards flexibles con sub-items jerárquicos, permisos granulares, y WhatsApp como interfaz para usuarios en campo.

**Cliente cero:** CMP (uniformes tácticos B2G México, 21 usuarios)
**Dominio:** usetratto.com

---

## Stack

```
Frontend:   Next.js (App Router) + Tailwind CSS
Backend:    Supabase (Postgres + Edge Functions + RLS + Auth)
Auth:       Supabase Phone Auth (OTP SMS vía Twilio)
Messaging:  Twilio WhatsApp Business API
AI:         Anthropic Claude
Deploy:     Vercel + Supabase
```

---

## Principios de arquitectura

### 1. Todo es un board
No hay tablas especiales para contactos, cuentas, vendors, catálogo. **Todo** vive en `boards` → `items` → `item_values`. Un "contacto" es un item en un board con `system_key = 'contacts'`. Un "producto" es un item en el board `catalog`. La única diferencia es la configuración de columnas.

### 2. Una sola UI para todo
- **UNA** ruta de lista: `/app/b/[boardSlug]` → `BoardView.tsx`
- **UNA** ruta de detalle: `/app/b/[boardSlug]/[itemSid]` → `ItemDetailView.tsx`
- **UNA** tabla genérica: `GenericDataTable.tsx`
- **UNA** celda por tipo: `TextCell`, `NumberCell`, `DateCell`, `SelectCell`, etc.
- **UN** import wizard: `ImportWizard.tsx` (sirve para cualquier board)

### 3. Columnas = configuración, no código
Las columnas de un board son filas en `board_columns`. Cambiar columnas NO requiere tocar código. El frontend lee `board_columns` y renderiza dinámicamente con el dispatcher `ColumnCell`.

### 4. Sub-items son universales (tabla separada)
Todo board puede tener sub-items. Un sub-item puede tener sub-sub-items (variantes). La vista de sub-items se configura por board (`sub_item_views`), no por código.

**¿Por qué `sub_items` es tabla separada y no `items` con `parent_id`?**
Porque items y sub-items tienen comportamientos fundamentalmente distintos: un item pertenece a un board y tiene stage; un sub-item pertenece a un item y tiene qty/unit_price. Unificarlos complicaría cada query, cada vista, y cada permiso (RLS de sub-items hereda del item padre). El Quote Engine necesita iterar líneas — con tabla separada es `SELECT * FROM sub_items WHERE item_id = X`, no un self-join con filtros de depth.

### 5. Zero duplication policy
- Si estás copiando un componente para adaptarlo → hazlo genérico con props
- Si estás creando una ruta nueva que se parece a otra → usa la misma ruta con parámetros
- Si estás creando un API endpoint para un tipo de objeto → usa el genérico de items

---

## Schema de base de datos

### Filosofía: híbrido Monday-style
- **Columnas core** (físicas en `items`): `name`, `stage_id`, `owner_id`, `deadline`
- **Columnas custom** (EAV en `item_values`): todo lo demás, definido por `board_columns`
- **Columnas de sistema** expuestas como `board_columns` con `is_system = true` para que el frontend las trate igual

### IDs — MUY IMPORTANTE

**Todo tiene `sid`.** Sin excepción.

- `id` (uuid): PK interna, nunca visible al usuario, nunca en URLs
- `sid` (bigint): ID público estilo Monday, secuencia global `tratto_sid_seq`

La secuencia `tratto_sid_seq` es **compartida** entre TODAS las entidades. Esto garantiza que ningún sid se repita jamás. Cualquier entidad es buscable con `find_by_sid(12345678)`.

| Entidad | Tiene sid | Ejemplo |
|---------|-----------|---------|
| workspaces | ✅ | 10000001 |
| users | ✅ | 10000002 |
| teams | ✅ | 10000010 |
| territories | ✅ | 10000015 |
| boards | ✅ | 10000020 |
| board_stages | ✅ | 10000025 |
| board_columns | ✅ | 10000030 |
| items | ✅ | 10000100 |
| sub_items | ✅ | 10000200 |

Adicionalmente, `boards` tienen `slug` (text, UNIQUE per workspace) para URLs amigables.

**En la UI:** siempre mostrar `sid`, nunca uuid. En URLs de boards usar `slug`.

### Tablas

```sql
-- ─── MULTI-TENANT ───
workspaces (id, sid, name, created_at)

-- ─── USUARIOS ───
users (id, sid, name, phone UNIQUE, email, role, workspace_id, created_at)
  -- role: 'admin' | 'member' | 'viewer' | 'superadmin'

teams (id, sid, workspace_id, name, created_at)
user_teams (user_id, team_id)  -- M2M

territories (id, sid, workspace_id, name, parent_id SELF-REF, created_at)
user_territories (user_id, territory_id)  -- M2M

-- ─── BOARDS ───
boards (id, sid, slug, workspace_id, name, type, description, system_key, created_at)
  -- type: 'pipeline' | 'table'
  --   pipeline = tiene stages (oportunidades, soporte, proyectos)
  --   table    = sin stages, es directorio/catálogo (contactos, productos, vendors)
  -- system_key: NULL para boards custom, string para boards de sistema
  -- slug: URL-friendly, UNIQUE per workspace

board_stages (id, sid, board_id, name, color, position, is_closed, created_at)

board_columns (id, sid, board_id, col_key, name, kind, position, is_system, is_hidden, required, settings, created_at)
  -- col_key: identificador estable tipo 'stage', 'owner', 'deadline', 'custom_1'
  -- kind: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'people' |
  --        'boolean' | 'url' | 'file' | 'email' | 'phone' | 'autonumber' | 'formula' | 'relation'
  -- is_system: true para columnas core (name, stage, owner, deadline)
  -- settings: jsonb — opciones select, formato number, target_board_id para relation, etc.

-- ─── BOARD MEMBERS (acceso al board — Monday-style) ───
-- Un board tiene miembros. Un miembro puede ser una persona O un equipo.
-- Nivel de acceso: 'view' (solo lectura) o 'edit' (lectura + escritura).
-- Si un board NO tiene registros en board_members → es público para todo el workspace.
board_members (id, board_id, user_id NULL, team_id NULL, access, created_at)
  -- user_id XOR team_id: uno de los dos, nunca ambos, nunca ninguno
  -- access: 'view' | 'edit'
  -- CHECK: (user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL)

-- ─── COLUMN PERMISSIONS (visibilidad/edición por columna — opcional) ───
-- Si una columna NO tiene registros aquí → todos los miembros del board la ven y editan.
-- Si tiene registros → solo esos users/teams la ven o editan.
column_permissions (id, column_id, user_id NULL, team_id NULL, access, created_at)
  -- user_id XOR team_id
  -- access: 'view' | 'edit'
  -- Ejemplo: columna "Costo" → equipo "Compras" con 'edit', equipo "Ventas" con 'view'

-- ─── ITEMS (registros de cualquier board) ───
items (id, sid, workspace_id, board_id, stage_id, name, owner_id, territory_id, deadline, position, created_at, updated_at)
  -- stage_id: NULL para boards tipo 'table'
  -- territory_id: FK física para RLS por zona
  -- Relaciones a otros boards (contacto, cuenta) → columnas tipo 'relation' en board_columns
  --   valor en item_values.value_text = item_id del item relacionado

item_values (id, item_id, column_id, value_text, value_number, value_date, value_json, created_at)
  -- UNIQUE(item_id, column_id)

-- ─── SUB-ITEMS (tabla separada — jerárquicos, universales) ───
sub_items (id, sid, workspace_id, item_id, parent_id SELF-REF, depth, name, qty, unit_price, notes, catalog_item_id, position, created_at)
  -- depth: 0 = línea principal, 1 = variante/detalle
  -- catalog_item_id: FK opcional a items del board catalog (trazabilidad)
  -- parent_id: NULL para depth=0, FK a sub_items para depth=1

sub_item_values (id, sub_item_id, column_id, value_text, value_number, value_date, value_json)
  -- UNIQUE(sub_item_id, column_id)

-- ─── SUB-ITEM VIEWS (qué columnas de sub-items se muestran por board/stage) ───
sub_item_views (id, board_id, stage_id, name, column_ids, show_variants, created_at)

-- ─── COMUNICACIÓN ───
item_channels (id, workspace_id, item_id, name, type, team_id, position, created_at)
  -- type: 'internal' | 'system'
  -- Auto-creados por trigger: "General" + "Sistema" al insertar item

channel_messages (id, workspace_id, channel_id, user_id, body, type, metadata, whatsapp_sid, created_at)
channel_members (channel_id, user_id, added_by, created_at)
mentions (id, workspace_id, message_id, mentioned_user_id, notified, replied, reply_message_id, created_at)

-- ─── ACTIVITY LOG ───
item_activity (id, workspace_id, item_id, sub_item_id, actor_id, action, old_value, new_value, metadata, created_at)
  -- Alimentado 100% por triggers de DB

-- ─── QUOTES ───
quote_templates (id, workspace_id, board_id, name, stage_id, template_html, header_fields, line_columns, footer_fields, show_prices, created_at)
quotes (id, workspace_id, item_id, template_id, generated_by, pdf_url, status, created_at)
```

### System boards (auto-creados por workspace)

| system_key     | type     | Propósito |
|----------------|----------|-----------|
| `opportunities`| pipeline | Ventas, pipeline principal |
| `contacts`     | table    | Personas (phone + email como columnas de sistema) |
| `accounts`     | table    | Empresas/organizaciones |
| `vendors`      | table    | Proveedores |
| `catalog`      | table    | Catálogo de productos |

Estos boards se crean con `seed_system_boards(workspace_id)` al crear un workspace. Cada uno tiene sus `board_columns` de sistema pre-configuradas.

**Importante:** No hay tablas `contacts`, `accounts`, `vendors` separadas. Son items en sus boards respectivos. Las relaciones entre items (ej: oportunidad → contacto) se hacen con columnas tipo `relation` que guardan el `item_id` del item relacionado en `item_values.value_text`.

### Columnas de sistema por board

```
-- Todos los boards:
name (text, is_system)
owner (people, is_system)

-- Boards tipo pipeline:
stage (select, is_system)  -- mapeado a board_stages
deadline (date, is_system)

-- Board contacts:
phone (phone, is_system)
email (email, is_system)
account (relation → accounts board, is_system)

-- Board accounts:
type (select, is_system)

-- Board vendors:
legal_name (text, is_system)
tax_id (text, is_system)
phone (phone, is_system)
email (email, is_system)

-- Board catalog:
(solo name + owner, todo lo demás es custom)
```

---

## Permisos (RLS)

### Roles
```
superadmin → ve todo, todos los workspaces
admin      → ve todo de su workspace, configura
member     → ve según board_members y territories
viewer     → solo lectura
```

### Board access (board_members)
Un board tiene miembros. Un miembro es una persona (`user_id`) o un equipo (`team_id`). Cada miembro tiene `access: 'view' | 'edit'`. Si un board NO tiene registros en board_members → es público (todos los del workspace lo ven).

### Column access (column_permissions)
Opcional. Si una columna tiene registros en `column_permissions` → solo esos users/teams la ven o editan. Si no tiene registros → visible y editable para todos los miembros del board.

### RLS simplificado
```sql
-- Un usuario ve un item si:
(role IN ('admin', 'superadmin'))
OR (owner_id = auth.uid())
OR EXISTS (user es miembro directo del board via board_members)
OR EXISTS (user pertenece a team que es miembro del board)
OR EXISTS (user en territorio del item)

-- Un board sin board_members → visible para todos del workspace
```

### Multi-tenancy
Toda tabla tiene `workspace_id`. RLS garantiza aislamiento total. Un workspace = una empresa.

---

## Rutas del frontend

```
/login                              → OTP phone auth
/app                                → Redirect a board "opportunities" (o primer board)
/app/b/[boardSlug]                  → BoardView (lista universal)
/app/b/[boardSlug]/[itemSid]        → ItemDetailView (detalle universal)
/app/settings                       → Configuración
/app/settings/boards                → CRUD boards + stages + columns + members
/app/settings/teams                 → CRUD equipos + miembros
/app/settings/territories           → CRUD territorios + miembros
/app/settings/workspace             → Nombre workspace, config general
/app/superadmin                     → Multi-workspace switcher (solo superadmin)
```

### Componentes principales

```
components/
  data-table/
    GenericDataTable.tsx         → LA tabla. Sort, inline edit, bulk select, row click.
                                   Recibe columns[] + rows[] + onCellChange().
                                   NO sabe de boards ni items — es pura data.

  cells/
    ColumnCell.tsx               → Dispatcher: recibe column.kind → renderiza celda correcta
    TextCell.tsx                 → Texto editable inline
    NumberCell.tsx               → Número con formato
    DateCell.tsx                 → Date picker
    SelectCell.tsx               → Dropdown single
    MultiSelectCell.tsx          → Multi chips
    PeopleCell.tsx               → Referencia a users
    BooleanCell.tsx              → Checkbox
    RelationCell.tsx             → Referencia a item de otro board (picker + display)
    PhoneCell.tsx                → Teléfono E.164
    EmailCell.tsx                → Email con mailto
    types.ts                    → CellProps, CellValue, ColumnDef

  SubItemsView.tsx              → Sub-items para CUALQUIER board.
                                   Depth 0 expandible, depth 1 variantes.
                                   Columnas configuradas por sub_item_views.

  ImportWizard.tsx              → Shell genérico. Sources pluggables.
  ImportarAirtable.tsx          → Source adapter: PAT → base → table → fields
  ImportarCSV.tsx               → Source adapter: file → parse → fields

  ItemChannels.tsx              → Canales tipo Slack dentro del item
  ActivityFeed.tsx              → Feed de actividad (audit trail)
  ProductPicker.tsx             → Modal para agregar items del catálogo como sub-items
  GroupList.tsx                 → Componente genérico para gestión de equipos/territorios

  layout/
    sidebar.tsx                 → Sidebar dinámico. Lee boards del workspace, genera nav.
    header.tsx                  → Header con breadcrumb dinámico.

pages (app router):
  app/b/[boardSlug]/
    page.tsx                    → Server: resuelve board por slug, fetch data
    BoardView.tsx               → Client: toolbar + GenericDataTable + import

  app/b/[boardSlug]/[itemSid]/
    page.tsx                    → Server: resuelve item por sid
    ItemDetailView.tsx          → Client: info panel + tabs (Sub-items | Canales | Actividad)
```

### API routes

```
api/
  auth/logout                   → POST

  boards/                       → GET (list) + POST (create)
  boards/[id]                   → GET + PATCH + DELETE
  boards/[id]/columns           → GET + POST
  boards/[id]/columns/[colId]   → PATCH + DELETE
  boards/[id]/stages            → GET + POST
  boards/[id]/stages/[stageId]  → PATCH + DELETE
  boards/[id]/views             → GET + POST (sub_item_views)
  boards/[id]/views/[viewId]    → PATCH + DELETE
  boards/[id]/members           → GET + POST + DELETE (user_id o team_id + access level)

  items/                        → GET (?boardId=) + POST
  items/[id]                    → GET + PATCH + DELETE
  items/[id]/values             → GET + PUT (bulk upsert)
  items/[id]/activity           → GET
  items/bulk                    → DELETE

  sub-items/                    → GET (?itemId=) + POST
  sub-items/[id]                → PATCH + DELETE
  sub-items/[id]/values         → PUT (upsert)

  channels/                     → GET + POST
  channels/[id]/messages        → GET + POST
  channels/[id]/members         → GET + POST + DELETE

  import/airtable               → POST (connect + import)
  import/csv                    → POST

  users/me                      → GET
  workspace-users               → GET

  quote-templates/              → GET + POST
  quotes/                       → GET + POST
```

**Regla de API:** Todo endpoint usa `requireAuthApi()`. Endpoints admin usan `requireAdminApi()`. Workspace isolation via profile del usuario autenticado — nunca del request body.

---

## Auth

**Supabase Phone Auth** con OTP SMS via Twilio.

```
1. signInWithOtp({ phone })     → SMS vía Twilio
2. verifyOtp({ phone, token })  → JWT, cookies automáticas
3. Middleware refresca JWT       → auth.uid() funciona en RLS
4. Trigger handle_new_auth_user → auto-provisioning en primer login
```

**Dev:** Número `+521234567890` / código `123456` (test OTP en Supabase Dashboard).

**Clientes Supabase:**
```
createClient()        → browser/server, respeta RLS, necesita sesión
createServiceClient() → solo server/API, bypassa RLS, para admin ops
```

**Regla:** Componentes client nunca llaman Supabase directo. Usan API routes.

---

## Sub-items: reglas de UX

1. **Solo desde catálogo** cuando existe board catalog → ProductPicker obligatorio. Si no hay catálogo, crear inline.
2. **Columnas core en sub_items** (no EAV): `qty`, `unit_price`, `notes` — universales para quotes.
3. **2 niveles visuales máximo:**
   - L1 (depth=0): fila principal, expandible con chevron
   - L2 (depth=1): sub-fila indentada (variantes, tallas, etc.)
   - NO hay L3 visual. Si se necesita detalle extra → detail panel inline.
4. **Auto-variantes ⚡**: columna multiselect en L1 → botón genera L2 por cada valor.
5. **sub_item_views** controla qué columnas se muestran según el board/stage. No hardcodear.

---

## WhatsApp

### Quién lo usa
Solo usuarios registrados en `users`. NO hay integración con clientes externos.

### Flujos
1. **Vendedor opera desde WhatsApp:** crear items, consultar, agregar notas, responder menciones
2. **Menciones:** @usuario en canal → WhatsApp notification → reply vuelve al canal

### Edge Functions
```
twilio_webhook      → Recibe mensajes, Claude AI parsea intención
mentions-trigger    → Poll cada 2min, envía WhatsApp para menciones pendientes
daily-digest        → Cron 8:30 AM MX, resumen diario por usuario
whatsapp-outbound   → Sender genérico
```

---

## Convenciones

- **Código:** inglés (variables, funciones, types)
- **UI:** español (labels, mensajes, placeholders)
- **Fechas:** UTC en DB, timezone del workspace en UI
- **Teléfonos:** E.164
- **IDs en UI:** siempre mostrar `sid`, nunca uuid. En URLs de boards usar `slug`.
- **Commits:** Conventional Commits en español. `feat:`, `fix:`, `refactor:`
- **Branches:** `main` solamente. Un agente a la vez. Sin GitButler.
- **Workflow:** Un agente Claude → hace su tarea → commit → push. Secuencial.

---

## Errores a NO repetir

1. **❌ Tablas separadas para contacts/accounts/vendors** → Duplicación masiva. Solución: todo es un item en un board.
2. **❌ Rutas hardcodeadas por tipo** → Solución: `/app/b/[boardSlug]`.
3. **❌ Componentes específicos por board** → Solución: `BoardView.tsx` universal.
4. **❌ 5 agentes en paralelo con GitButler** → Solución: 1 agente, secuencial, main directo.
5. **❌ Columnas core como FK físicas** (`contact_id`, `account_id`) → Solución: columnas tipo `relation` en EAV.
6. **❌ Código antes de schema** → Solución: schema + seed PRIMERO, luego UI.
7. **❌ Over-engineering temprano** → Solución: tabla funcionando al 100% antes de features avanzadas.

---

## Roadmap

**Fase 0 (AHORA):** Schema limpio + Auth + Board/Item CRUD + Tabla funcional
**Fase 1:** Sub-items + Import wizard + Catálogo
**Fase 2:** Canales + Activity log + Mentions
**Fase 3:** WhatsApp integration (Edge Functions)
**Fase 4:** Quote Engine (templates + PDF)
**Fase 5:** Permisos granulares (board_members, column_permissions, territories)
