# log

## 2026-04-13

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
