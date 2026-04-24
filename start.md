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
- **UNA** ruta de lista: `/app/b/[boardSid]` → `BoardView.tsx`
- **UNA** ruta de detalle: `/app/b/[boardSid]/[itemSid]` → `ItemDetailView.tsx`
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

Adicionalmente, `boards` tienen `slug` (text, UNIQUE per workspace) como nombre legible en DB — **no se usa en URLs**. Las URLs siempre usan `sid`.

**En la UI:** siempre mostrar `sid`, nunca uuid. En URLs usar `sid` para boards e items — nunca slug, nunca uuid.

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
boards (id, sid, slug, workspace_id, name, type, description, system_key,
        folio_prefix, folio_counter, folio_pad, created_at)
  -- type: 'pipeline' | 'table'
  --   pipeline = tiene stages (oportunidades, soporte, proyectos)
  --   table    = sin stages, es directorio/catálogo (contactos, productos, vendors)
  -- system_key: NULL para boards custom, string para boards de sistema
  -- slug: identificador legible, UNIQUE per workspace, solo para referencia interna — NO en URLs
  -- folio_*: prefix (ej 'OPP') + counter monotónico + pad (3 → 'OPP-001')

board_stages (id, sid, board_id, name, color, position, is_closed, created_at)

board_columns (id, sid, board_id, col_key, name, kind, position, is_system, is_hidden, required, settings, created_at)
  -- col_key: identificador estable tipo 'stage', 'owner', 'deadline', 'custom_1'
  -- kind: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'people' | 'boolean' |
  --        'url' | 'file' | 'email' | 'phone' | 'autonumber' | 'formula' | 'relation' |
  --        'button' | 'signature' | 'rollup' | 'reflejo' | 'image' | 'conditional_select'
  -- conditional_select: dropdown cuyas options salen de settings.source_col_key leído del item
  --                     origen via sub_items.source_item_id (o relation col); opciones = CSV parseado
  -- is_system: true para columnas core (name, stage, owner, deadline, created_by, created_at, updated_at)
  -- settings: jsonb — opciones select, target_board_id relation, role metatag (owner/primary_stage/end_date),
  --           ref_source_col_key/ref_field_col_key/ref_field_kind (reflejo), auto_fill_targets, validation, etc.

-- ─── BOARD MEMBERS (acceso al board — Monday-style) ───
-- Un board tiene miembros. Un miembro puede ser una persona O un equipo.
-- Nivel de acceso: 'view' (solo lectura) o 'edit' (lectura + escritura).
-- Si un board NO tiene registros en board_members → es público para todo el workspace.
board_members (id, board_id, user_id NULL, team_id NULL, access, restrict_to_own, created_at)
  -- user_id XOR team_id: uno de los dos, nunca ambos, nunca ninguno
  -- access: 'view' | 'edit' | 'admin'
  --   view  = solo lectura
  --   edit  = lectura + editar valores de celda
  --   admin = lo anterior + gestionar schema del board (columnas, stages, permisos, miembros)
  -- restrict_to_own: si true, el miembro solo ve items donde es owner
  -- CHECK: (user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL)

-- ─── COLUMN PERMISSIONS (visibilidad/edición por columna — opcional) ───
-- Cada columna tiene settings.default_access: 'edit' | 'view' | 'restricted' (default 'edit').
--   edit       = todos los miembros del board ven y editan
--   view       = todos ven, solo listados con access='edit' pueden editar
--   restricted = nadie ve salvo listados (columna oculta del resto)
-- column_permissions = overrides explícitos que establecen access efectivo del user ignorando default.
column_permissions (id, column_id NULL, sub_item_column_id NULL, user_id NULL, team_id NULL, access, created_at)
  -- column_id XOR sub_item_column_id (polimórfico)
  -- user_id XOR team_id
  -- access: 'view' | 'edit'
  -- Admin de workspace siempre bypass (ve+edita todo).
  -- Ejemplo: costo_interno en catálogo con default='restricted' + override Compras='edit'

-- ─── ITEMS (registros de cualquier board) ───
items (id, sid, workspace_id, board_id, stage_id, name, owner_id, territory_id, deadline, position,
       folio_number, created_by, created_at, updated_at)
  -- folio_number: secuencial per-board, asignado por trigger assign_item_folio (monotónico, nunca reutiliza)
  -- stage_id: NULL para boards tipo 'table'
  -- territory_id: FK física para RLS por zona
  -- Relaciones a otros boards (contacto, cuenta) → columnas tipo 'relation' en board_columns
  --   valor en item_values.value_text = item_id del item relacionado
  --   NOTA: la cuenta en quotes/opps se resuelve via chain desde contacto, no link directo

item_values (id, item_id, column_id, value_text, value_number, value_date, value_json, created_at)
  -- UNIQUE(item_id, column_id)

-- ─── SUB-ITEMS (tabla separada — jerárquicos, universales) ───
sub_items (id, sid, workspace_id, item_id, parent_id SELF-REF, depth, name, source_item_id NULL, position, created_at)
  -- depth: 0 = L1, 1 = L2/variante — parent_id NULL para depth=0
  -- source_item_id: FK a items del board source usado en snapshot (solo trazabilidad, no sync)
  -- SIN qty/unit_price/notes — todo es sub_item_columns

sub_item_columns (id, board_id, col_key, name, kind, position, is_hidden, required, settings jsonb, source_col_key text)
  -- Por board (igual que board_columns). Totalmente configurables.
  -- source_col_key: qué col_key del source board se copia en snapshot; NULL = columna manual
  -- kind incluye 'formula' → settings: { formula: 'multiply'|'add'|'subtract'|'percent', col_a, col_b? }
  -- Columnas formula NO se almacenan en sub_item_values — se computan en frontend

sub_item_values (id, sub_item_id, column_id, value_text, value_number, value_date, value_json)
  -- UNIQUE(sub_item_id, column_id)

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

-- ─── DOCUMENT TEMPLATES ───
document_templates (id, sid, workspace_id, name, target_board_id, body_json, style_json,
                    signature_config, pre_conditions, folio_format, status, created_by,
                    created_at, updated_at)
  -- body_json: array de blocks (heading/text/field/image/columns/spacer/divider/
  --            repeat/subitems_table/total/quote_totals/signature) — ver lib/document-blocks/types.ts
  -- Templates apuntan a cualquier target_board. Docs generados = items en system board 'quotes'.
  -- style_json.quote_config: { tableColumns, columnWidths, showThumbnail, fontSize, ivaRate,
  --                            header, notesLabel, notes, showClientSignature, showVendorSignature }
  --   source of truth del editor — body_json se regenera desde config via buildQuoteBody().

document_audit_events (id, document_item_id, workspace_id, event_type, actor_id, metadata, created_at)
```

### System boards (auto-creados por workspace)

| system_key     | type     | Propósito |
|----------------|----------|-----------|
| `opportunities`| pipeline | Ventas, pipeline principal — stages Nueva/Cotización/Presentada/Cerrada |
| `contacts`     | table    | Personas (phone + email + cargo + cuenta como cols de sistema) |
| `accounts`     | table    | Organizaciones (display: "Cuentas") |
| `vendors`      | table    | Proveedores |
| `catalog`      | table    | Catálogo de productos (name + sku + descripcion + unidad + foto + unit_price/precio venta + proveedor + costo_unitario + tallas + colores_disponibles) |
| `quotes`       | pipeline | Cotizaciones generadas — stages Borrador/Enviada/Pendiente firma/Firmada/Anulada. Sub-item view `Partidas` recibe snapshots via RPC `materialize_quote_from_opportunity` |
| `documents`    | pipeline | Documentos del combo (factura/oc_cliente/oc_proveedor/recepcion/devolucion) — discriminador `doc_type` + `direction`. Stages gated por `settings.applies_to_doc_types`. Folio `DOC` |

**Opinionated knowledge graph:** cada system board trae `sub_item_views` por defecto (ver Fase 18.5 en plan.md). Ej: Oportunidades → {Catálogo, Cotizaciones, Documentos}. Contactos → {Oportunidades, Cotizaciones, Documentos}. Cuentas → {Contactos, Documentos}. Proveedores → {Documentos}. Catálogo → {Variantes} (con columnas talla/color kind=conditional_select que leen tallas/colores_disponibles del producto). La cuenta de una oportunidad/cotización se resuelve via chain lookup desde el contacto (no link directo). System boards NO se pueden borrar.

Estos boards se crean con `seed_system_boards(workspace_id)` al crear un workspace. Cada uno tiene sus `board_columns` de sistema pre-configuradas.

**Importante:** No hay tablas `contacts`, `accounts`, `vendors` separadas. Son items en sus boards respectivos. Las relaciones entre items (ej: oportunidad → contacto) se hacen con columnas tipo `relation` que guardan el `item_id` del item relacionado en `item_values.value_text`.

### Columnas de sistema por board

```
-- Todos los boards (auto-inyectadas por trigger inject_system_board_columns):
folio (autonumber, is_system, pos -1)  -- Folio monotónico per-board, formato {prefix}-{padded}
name (text, is_system)
owner (people, is_system)
created_by (people, is_system, read_only)
created_at (date, is_system, relative, read_only)
updated_at (date, is_system, relative, read_only)

-- Boards tipo pipeline:
stage (select, is_system)  -- mapeado a board_stages
deadline (date, is_system)

-- Board contacts:
cargo (text, is_system)
phone (phone, is_system)
email (email, is_system)
cuenta (relation → accounts board, is_system)

-- Board accounts (display: "Cuentas"):
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

### Roles (workspace-level — campo `users.role`)
```
superadmin → ve todo, todos los workspaces
admin      → ve todo de su workspace, configura
member     → ve según board_members (puede ser board admin de un board específico)
viewer     → solo lectura
```

Ortogonal a esto, `board_members.access` define el nivel de acceso **por board** (view/edit/admin).

### Board access (board_members)
Un board tiene miembros. Un miembro es una persona (`user_id`) o un equipo (`team_id`). Cada miembro tiene `access: 'view' | 'edit' | 'admin'`:
- `view` = solo lectura
- `edit` = lectura + editar valores de celda
- `admin` = lo anterior + gestionar schema del board (columnas, stages, permisos, miembros)

Board admins ≠ workspace admins: un user puede ser admin de Catálogo sin tocar otros boards. Workspace admin sigue siendo el superconjunto (siempre bypass). Si un board NO tiene registros en board_members → es público para todo el workspace (view).

`restrict_to_own` en board_members: si true, el miembro solo ve items donde `owner_id === userId`. Ideal para vendedores que solo ven sus oportunidades.

### Column access (column_permissions + default_access)
Cada columna declara su `settings.default_access`:
- `edit` (default) — todos los miembros del board ven y editan
- `view` — todos ven, solo overrides con `access='edit'` pueden editar
- `restricted` — nadie ve salvo overrides explícitos (columna se oculta del response)

`column_permissions` = overrides que establecen access efectivo para un user/team, ignorando el default. Admin de workspace siempre bypassa.

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
/app                                → Redirect dinámico: busca board con system_key='opportunities' → /app/b/[sid]
/app/b/[boardSid]                  → BoardView (lista universal)
/app/b/[boardSid]/[itemSid]        → ItemDetailView (detalle universal)
/app/settings                       → Configuración
/app/settings/boards                → CRUD boards + stages + columns + members
/app/settings/teams                 → CRUD equipos + miembros
/app/settings/territories           → CRUD territorios + miembros
/app/settings/workspace             → Nombre workspace, config general
/app/superadmin                     → Multi-workspace switcher (solo superadmin)
```

## Librería clave: TanStack Table v8

`@tanstack/react-table` — MIT, headless, zero markup.

**Resuelve sin código extra:**
- Sorting con estado
- Row selection + shift-click
- Column pinning (sticky first column)
- Row expansion — el `>` de Monday (`getExpandedRowModel`, `subRows` field en data)
- Base para virtual scrolling (TanStack Virtual — activo en `GenericDataTable` desde Fase 17.5)

**Siempre DIY encima:**
- Cell types (TextCell, SelectCell, etc.) — dependen de nuestros column kinds
- Edit mode por celda — nuestra lógica de editTarget
- Keyboard navigation (flechas + Tab) — hooks de TanStack, lógica nuestra

**Patrón de sub-items:** cada `Row` tiene `subRows?: Row[]`. TanStack maneja el modelo de expansión; nosotros solo renderizamos el chevron y el CSS de indentación.

```tsx
// TanStack controla qué rows son visibles (expandidas o no)
{table.getRowModel().rows.map(row => (
  <tr key={row.id}>
    {row.getCanExpand() && (
      <button onClick={row.getToggleExpandedHandler()}>
        {row.getIsExpanded() ? '▼' : '▶'}
      </button>
    )}
    {row.getVisibleCells().map(cell => (
      <td key={cell.id}>
        <ColumnCell column={cell.column.columnDef} value={cell.getValue()} />
      </td>
    ))}
  </tr>
))}
```

**Regla:** `GenericDataTable.tsx` usa TanStack Table internamente. Los consumers (BoardView) no saben ni les importa — siguen pasando `columns[]` + `rows[]` + `onCellChange()`.

---

### Componentes principales

```
components/
  data-table/
    GenericDataTable.tsx         → LA tabla. Usa TanStack Table v8 internamente.
                                   Sort, inline edit, bulk select, row click, sub-item expansion.
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
  components/sub-items/         → Módulos extraídos (sesión 1 2026-04-22):
    types.ts                    → NativeData / BoardItemsData / BoardSubData / SubItemColumn / EditTarget
    LoadingState.tsx            → Spinner compartido
    BoardItemsRenderer.tsx      → Reference mode: items de otro board (read-only)
    BoardSubItemsRenderer.tsx   → Reference mode: sub-items de otros items (read-only)
    SubItemDetailDrawer.tsx     → Drawer lateral con DrawerEditField interno
    RollupUpPopup.tsx           → Popup para configurar rollup → item parent
    AddColumnInline.tsx         → Inline form para agregar sub_item_column
  components/column-settings/   → Módulos extraídos de ColumnSettingsPanel:
    constants.ts                → PRESET_COLORS / KIND_OPTIONS / NUMBER_FORMATS
    PermissionsTab.tsx          → Tab "Permisos" autónomo (state + handlers encapsulados)
  lib/sub-items/tree.ts         → findInTree / patchTree / patchValueInTree (puros, reusados)
  lib/boards/types.ts           → Types client-safe: SubItemValue/SubItemData/ColPermission/SourceItem

  ImportWizard.tsx              → Shell genérico. Sources pluggables.
  components/import/
    ImportWizard.tsx            → Orquestador genérico: source picker → ConnectStep → ColumnMapper → import
    ColumnMapper.tsx            → Step genérico: mapeo + crear columna nueva inline
    sources/types.ts            → interface ImportSource (ConnectStep, ConnectResult, ImportField)
    sources/index.ts            → IMPORT_SOURCES registry ← agregar fuentes aquí
    sources/AirtableSource.tsx  → ConnectStep Airtable (PAT + base + table, client-side fetch)
    sources/CsvSource.tsx       → ConnectStep CSV (parse en cliente, drag & drop)

  ItemChannels.tsx              → Canales tipo Slack dentro del item
  ActivityFeed.tsx              → Feed de actividad (audit trail)
  ProductPicker.tsx             → Modal para agregar items del catálogo como sub-items
  GroupList.tsx                 → Componente genérico para gestión de equipos/territorios

  layout/
    sidebar.tsx                 → Sidebar dinámico. Lee boards del workspace, genera nav.
    header.tsx                  → Header con breadcrumb dinámico.

pages (app router):
  app/b/[boardSid]/
    page.tsx                    → Server: resuelve board por SID, fetch data
    BoardView.tsx               → Client: toolbar + GenericDataTable + import

  app/b/[boardSid]/[itemSid]/
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
  sub-items/[id]/expand         → POST (cartesiano → L2s desde multiselect dims)
  sub-items/[id]/import-children → POST (copia sub-items del source como L2s)
  sub-items/[id]/refresh        → POST (re-copia values del source; 409 si is_closed)

  channels/                     → GET + POST
  channels/[id]/messages        → GET + POST
  channels/[id]/members         → GET + POST + DELETE

  import/bulk                   → POST (genérico — todas las fuentes envían aquí)

  users/me                      → GET
  workspace-users               → GET

  quote-templates/              → GET + POST
  quotes/                       → GET + POST
```

**Regla de API:** Todo endpoint usa `requireAuthApi()`. Endpoints admin usan `requireAdminApi()`. Workspace isolation via profile del usuario autenticado — nunca del request body.

---

## Auth

**Supabase Auth** con 2 métodos: email magic link (default) + phone OTP SMS via Twilio.

```
Email (default):
1. signInWithOtp({ email })  → magic link via email (Resend/Supabase SMTP)
2. Click link → /auth/callback → JWT, cookies automáticas
3. Login page muestra "Revisa tu correo" (NO input OTP)

Phone:
1. signInWithOtp({ phone })     → SMS vía Twilio
2. verifyOtp({ phone, token })  → JWT

Común:
- proxy.ts refresca JWT por request + extiende cookie maxAge a 30d
- Trigger handle_new_auth_user → auto-provisioning en primer login
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

1. **Source board configurable por board** (`sub_items_source_board_id`). Si existe → ProductPicker al agregar. Si no → input manual.
2. **Ninguna columna hardcodeada** — solo `name` es obligatorio para crear. `qty`, `unit_price`, `notes` son columnas default en `sub_item_columns` (configurables/eliminables).
3. **Snapshot al importar** — copia valores del source item punto en el tiempo. Editable post-snapshot de forma independiente. Nueva columna en sub_item_columns → vacía en sub-items existentes (no backfill automático).
4. **Formula columns** (`kind='formula'`) — predefinidas: `multiply`, `add`, `subtract`, `percent`. Computadas en frontend, no almacenadas en DB. Read-only.
5. **L1/L2 implementados** (`parent_id`, `depth`) — variantes via cartesiano (`/expand`), import-children (↓), refresh (⟳ bloqueado si `is_closed`), `subitem_view` L1_only/L1_L2/L2_only por board en `boards.settings`.
6. **SourceSelector** en toolbar de BoardView (junto a "+ Nuevo") — elige source board y configura mapeo de columnas via modal.

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
- **IDs en UI:** siempre mostrar `sid`, nunca uuid. En URLs usar `sid` para boards e items — nunca slug, nunca uuid.
- **Commits:** Conventional Commits en español. `feat:`, `fix:`, `refactor:`
- **Branches:** `main` solamente. Un agente a la vez. Sin GitButler.
- **Workflow:** Un agente Claude → hace su tarea → commit → push. Secuencial.

---

## Errores a NO repetir

1. **❌ Tablas separadas para contacts/accounts/vendors** → Duplicación masiva. Solución: todo es un item en un board.
2. **❌ Rutas hardcodeadas por tipo** → Solución: `/app/b/[boardSid]`.
3. **❌ Componentes específicos por board** → Solución: `BoardView.tsx` universal.
4. **❌ 5 agentes en paralelo con GitButler** → Solución: 1 agente, secuencial, main directo.
5. **❌ Columnas core como FK físicas** (`contact_id`, `account_id`) → Solución: columnas tipo `relation` en EAV.
6. **❌ Código antes de schema** → Solución: schema + seed PRIMERO, luego UI.
7. **❌ Over-engineering temprano** → Solución: tabla funcionando al 100% antes de features avanzadas.

---

## Roadmap (resumen — detalle completo en plan.md)

**Done (Fases 0–18):** Schema+Auth · Layout · BoardView · ItemDetail · Sub-items · Import · Channels+Activity · Settings · Permisos granulares · ColumnSettings · Files/Buttons/Signature · Variantes L2 · Formula · Rollup · Stage gates · Column perm inheritance · System cols + metatags · Ref cols · Invites + Email auth · Perf + consolidation · **Document Templates + Opinionated Knowledge Graph (quotes pipeline + default sub_item_views + default template + button)**

**Backlog:**
- **Fase 19:** Filter / Sort / Group en vistas
- **Fase 20:** Tratto AI Agent + Sidebar Chat
- **Fase 21:** WhatsApp Integration (Edge Functions)
- **Fase 22:** Bidirectional Graph Editing (drawer lateral para editar item relacionado desde relation chip)
- **Fase 23:** ItemDetailView UX Redesign (Attio-style: breadcrumb + tabs + sidebar accordion)
