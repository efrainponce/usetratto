# log

## 2026-04-23

**~sesión 2 — Chat rail persistente + 2 tools schema + UX subheader rediseñado**
- ChatPanel drawer → `ChatRail` persistente derecho (`components/ChatRail.tsx`): in-flow flex (no overlay/backdrop), colapsable con chevron + persistido en localStorage (`chat_collapsed`), resize handle 4px en borde izq con clamp 320–560 (persiste `chat_width`), auto-collapse en primer mount si window<1280, empty state con 3 prompt chips clickeables (oportunidades en costeo / crea contacto / resumen pipeline), composer con textarea auto-grow 1–6 líneas. ChatPanel.tsx borrado, sidebar.tsx limpiado (sin botón Asistente, sin chatOpen state)
- Header alignment fix: 3 paneles ahora con `h-[56px] border-b` alineados al mismo y. Sidebar brand (`pt-0 pb-[14px]` + brand area h-56 con border-b edge-to-edge), Board header (título+subtítulo inline a `text-[15px]` + 5 botones en una sola fila), ChatRail header igual. Logo Tratto centrado en rail colapsado vía `pl-[13px] group-hover:pl-[10px]`
- 2 tools nuevas no-destructivas en agente: `create_column` (13 kinds; rollup/formula/select/relation con validación de col_keys + lista opciones disponibles si error; admin-gated server-side) + `create_stage` (solo pipeline; color auto-asignado paleta rotativa; position con shift correcto). System prompt extendido con reglas de inferencia de kind por intención del usuario ("suma sub-items"→rollup, "A×B"→formula, etc.) + recordatorio de validar col_keys via get_item antes de inferir
- Subheader BoardView reorganizado en 3 secciones jerárquicas (Opción A elegida sobre dropdown/sidebar): **Fila 1** vistas (`bg-[var(--bg-2)]` h-10, solo tabs + Nueva vista) · **Fila 2** toolbar (`bg-[var(--bg)]` h-11, Filtrar/Ordenar/Agrupar con badge counts a la izq + Columnas a la der) · **Fila 3** chips de estado activo conditional (filtros con ×, sort con ↑↓, grupo con bucket) — helpers `operatorLabel()` + `formatFilterValue()`
- Build verde, typecheck limpio. Pendiente: `update_column` / `delete_column` / stage CRUD (destructivos — quedan para sesión futura con confirmación pattern)

**~sesión 1 — Fase 20 Tratto AI Agent (sidebar web) + billing + UI polish**
- Fase 20 CLOSED sprint 20.A+20.B: engine provider-agnostic (`LLMAdapter` interface con implementaciones Gemini 2.5 Flash + Anthropic Haiku 4.5), agent loop con streaming/tool_use (`agent.ts`, max 8 iter), 8 tools (search_items · get_item · create_item · update_item · change_stage · add_message · list_boards · get_board_summary), cada tool valida Zod + usa `AgentContext` del JWT + aplica `restrict_to_own` automático, system prompt con guardrail de scope "solo Tratto"
- Transport sidebar: `POST /api/chat` SSE streaming (max 500 chars input), `hooks/useChat.ts` (SSE parser, sessionStorage sessionId, tool pill state), `components/ChatPanel.tsx` drawer 420px con burbujas user/assistant + tool pills animadas + Enter envía, botón burbuja en footer del sidebar extrae `boardSid` activo del pathname
- Billing system **indispensable** para nunca pagar: migration `20260423000002_llm_billing.sql` con 3 tablas — `llm_pricing` seeded (gemini 2.5 flash/lite/pro, haiku 4.5, sonnet 4.6, opus 4.7), `llm_usage` append-only, `llm_budgets` con global row (workspace_id=NULL) $0.25/día $3/mes conservador. `lib/tratto-agent/billing.ts`: `assertBudget()` pre-flight + cada iteración, `recordUsage()` post-step calcula cost desde pricing table. Chat route devuelve 429 si budget exceeded ANTES de tocar LLM. Endpoint `GET /api/chat/usage` expone {budget, usage, remaining}. Verified: query test costó $0.000456 con Gemini free tier (~548 queries/día de headroom)
- LLM adapter translator: `ChatMessage[]` ↔ Gemini `Content[]` (tool_result → `user` + `functionResponse`) + Anthropic `MessageParam[]` (tool_result → `user` con `tool_use_id`). Custom `zodToJsonSchema.ts` para convertir schemas Zod a JSON Schema que ambos providers consumen. Gemini 2.0 Flash deprecated para cuentas nuevas → default cambiado a 2.5 Flash
- Migration `20260423000001_chat_sessions.sql`: `chat_sessions` (transport + last_message_at) + `chat_messages` (role user/assistant/tool_result, tool_calls jsonb) + RLS user-only + trigger touch_last_message_at
- UI polish: logo Tratto ahora es "dos tiras" curvas del design handoff (path M5 6c3 3 5 6 7 12) reemplazando la "T"; workspace chip movido al footer del sidebar arriba del logout (era top, ahora bottom); orden de system boards reforzado con `SYSTEM_BOARD_ORDER` map (Oportunidades=0 first, Contactos=1, Cuentas=2, Catálogo=3, Cotizaciones=4, Proveedores=5); iconos de boards cambiados a los del handoff (bandera=oportunidades, 2 personas=contactos, edificio con ventanas=cuentas, caja 3D=catálogo, doc con líneas=cotizaciones, camión=proveedores); `app/icon.svg` con logo Tratto sobre fondo brand pino reemplaza favicon.ico default
- Deps instaladas en `web/`: `@google/genai` 1.50 + `@anthropic-ai/sdk` 0.90 + `zod` 4.3
- Env vars nuevas: `LLM_PROVIDER=gemini|anthropic` (default gemini), `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`, `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`
- 2 migraciones aplicadas a remote. Build verde 80+ rutas, typecheck limpio. Stage gates server-side simplificado (solo required+empty check, no conditions todavía — ButtonCell sigue evaluando conditions en client para UI path)

## 2026-04-22

**~sesión 8 — Fase 19 polish + sub-items UX cleanup**
- Fix cascada paneles filtro/orden/agrupar: doble positioning roto (absolute interno + wrapper absolute) → solo wrapper; `bg-[var(--bg)]` invisible (mismo que página) → `bg-[var(--surface)]`; width overflow por `<select>` people con nombres largos → layout apilado [col/op/×] arriba + valor full-width abajo + `min-w-0`; popover clipping → subheader `z-[5]` → `z-30` (vence al thead sticky z-20 que escapaba al root)
- Banner dedicado para cambios locales (fuera del subheader, debajo): chip "• Aplicado solo para ti" + Descartar + Guardar en vista (admin-only) — evita que se lea como parte del popover
- Toggle "Solo en esta vista" al crear columna (visible solo si views.length > 1): POST columna + PATCH paralelo `board_view_columns is_visible=false` para otras vistas
- Sub-items CTAs simplificados: quitado "Desde catálogo" del subheader, "Agregar desde fuente" → "Nuevo", "Agregar sub-item" → "Nuevo", hint técnico "Bloques drag-and-drop..." removido
- Sub-items table: header/rows/footer ahora scrollean juntos (wrapper overflow-auto + min-w-max + sticky top/bottom); columna # (sid) eliminada; alineación kind-aware width default image/file=180 en header y footer para matchear body

**~sesión 7 — Fase 19 UX refinement: subheader + local vs vista + permiso**
- Botones Filtrar/Ordenar/Agrupar reubicados del top header al subheader (junto a Columnas) con estilo compacto — quedan claramente asociados a la vista activa
- Modelo dual: edits en paneles → `localConfig` (preview inmediato, solo para el usuario). Chip "• Aplicado solo para ti" + "Descartar" aparecen cuando hay cambios locales
- Botón "Guardar en vista" gateado por `isBoardAdmin` — solo board admins promueven el config local a `board_views.config` via PATCH. No-admins pueden explorar/descartar pero nunca persisten globalmente
- Removido el debounced auto-save anterior. `localConfig` resetea al cambiar de vista (silent drop)
- `effectiveConfig = localConfig ?? savedConfig` alimenta el engine; paneles siguen recibiendo arrays vía effective
- Permiso basado en el modelo existente `board_members.access='admin'` (ya propagado como prop `isBoardAdmin`)
- Typecheck limpio, build verde

**~sesión 6 — Fase 19 Filter/Sort/Group per view CLOSED**
- Migration `20260422000012_board_views_config.sql`: `board_views.config jsonb DEFAULT '{}'` — aplicada a remote
- `lib/view-engine.ts` (511 LOC): `applyFilters` (11 operators AND), `applySort` (multi-col estable, nulls al final), `groupRows` (explode multiselect, bucket date day/week/month, option-order-aware), `dateBucketKey` helper
- Types en `components/data-table/types.ts`: `ViewFilter/ViewSort/ViewConfig/FilterOperator/FilterValue/DateBucket/GroupedRows`
- `BoardView` type + `getBoardViews` + PATCH `/api/boards/[id]/views/[viewId]` aceptan `config`
- 3 paneles en `components/view-config/`: FilterPanel (operators por kind, between dual input, select/people dropdown, boolean toggle), SortPanel (↑/↓ swap + ASC/DESC + prioridad numerada), GroupPanel (radio + DateBucket picker inline)
- `GenericDataTable` acepta `groups?: GroupedRows[]` + `groupedStorageKey` — grouped mode skip virtualization, header `<tr>` colapsable con chevron + color dot + count, colapsos persisten en localStorage. Flat mode intacto.
- `BoardView` wiring: 3 botones toolbar (entre Sub-items e Importar) con badge count + estado brand, `processedRows` memo (filter→sort), `groupedRows` memo, debounced PATCH 500ms al editar config, click-outside close para los 3 popovers
- Delegación: 4 Haiku en paralelo (types+API / engine / paneles / GenericDataTable) + 1 Haiku secuencial (BoardView wiring)
- Estado: typecheck limpio, `npm run build` verde 80+ rutas
- DIFERIDO: 19.12 (agregados footer por grupo), 19.15 (filter/sort/group en sub-items — SubItemsView usa renderers custom, requiere wiring aparte)

**~sesión 5 — Quote editor v2 + institucion→cuenta rename + chain resolution**
- Editor cotización v2: drag-reorder cols (handle-only, no conflicto con slider), sliders ancho por col + botón distribuir (100/n), sección Tipografía fontSize 10-16px, Encabezado textarea libre, label Notas editable, firma vendedor sin header (hide_label) → muestra owner debajo de línea. Interlineado apretado (1.5→1.3, marginBottom 8→2px). Thumbnail tabla jala columna `foto` via `thumbnail_col_key` (antes colored placeholder siempre). column_configs extendido con `width_pct` (fr en html grid, flex en PDF). Preview real: folio/cuenta/contacto/cargo/owner via sample-context.
- Schema rename `institucion`→`cuenta` completo: board display Instituciones→Cuentas (slug `cuentas`, system_key `accounts` ya era genérico), col_key `institucion`→`cuenta` en Contactos, col directa dropada de Cotizaciones (la cuenta VIENE del contacto via chain lookup, no link). Nueva col `cargo` (text) en Contactos. Migraciones `20260422000010_contacts_cargo_col.sql` + `20260422000011_rename_institucion_to_cuenta.sql` idempotentes, aplicadas a remote.
- Chain resolution: `{{institucion.nombre}}`/`{{contacto.nombre}}` estaban rotos (resolver no drill relation). Ahora template usa `{{cuenta}}`/`{{contacto}}`/`{{cargo}}`/`{{owner}}`. context/route.ts `fetchContactChain()` + generate/route.ts chain lookup jalan cargo text + cuenta name desde contacto relacionado → pueblan rootValues para render. flattenValues extiende image/file kinds (`value_json[0].url` → string URL) — antes nulls siempre.
- Layout: removido bloque "Para/Att:", ahora Cotización·Fecha·Cliente·Cuenta viven en la columna superior derecha del header. Firma vendedor solo nombre owner (sin "Firma del Vendedor"). SignatureBlock extendido con `hide_label` + `fallback_name: 'owner'|'generated_by'|string`.
- Estado: typecheck limpio. 2 migraciones aplicadas en remote via `supabase db push`. 6 archivos tocados (defaults.ts, html-preview.tsx, pdf-renderer.tsx, TemplateEditorView.tsx, sample-context.ts, context+generate routes) + seed-perf renombres + ContactCard label.

**~sesión 4 — Quote editor simplified + folio per board + sid → folio swap**
- Editor cotización reescrito: sidebar 4 secciones (Productos checkboxes, IVA %, Notas, Firmas). Fuera BlockPalette/BlockCanvas/SlashMenu + 11 BlockEditors (-1500 LOC). Body regenerado desde `QuoteConfig` en `style_json.quote_config` — single source of truth. Nuevo block `quote_totals` (Subtotal + IVA 16% + Total, suma sub_items en render). Migración `20260422000008_catalog_system_cols.sql`: catalog cols (foto/sku/descripcion/unit_price/unidad) → `is_system=true` + nueva col `unidad`; seed_system_boards rewrite.
- Folio por board (`20260422000009_folio_per_board.sql`): `boards.folio_{prefix,counter,pad}` + `items.folio_number` + trigger `assign_item_folio` BEFORE INSERT (monotónico, nunca reutiliza). Prefijos default por system board (OPP/QUO/CON/INS/PRO/CAT). Col `folio` (kind=autonumber, is_system, pos -1) auto-inyectada vía trigger `inject_system_board_columns`. Backfill items existentes ordenados por created_at.
- Removido virtual `__sid` de BoardView — folio es ahora la primera columna default. AutonumberCell ahora formatea `{prefix}-{padded}`. ColumnSettingsPanel: inputs prefijo (uppercase, max 8) + dígitos pad (0-8). Nueva opción "ID del sistema" en + columna → crea autonumber con `settings.source='sid'` (toRow resuelve desde `items.sid`).
- Fix bonus: `created_by/created_at/updated_at` mostraban vacío — faltaban en SELECT de `getBoardItems` + `BoardItem` type + `getItemsFieldMap`. Agregado también `folio_number` al SELECT.
- Migraciones 8 y 9 aplicadas a prod. Build verde, typecheck limpio.

**~sesión 3 — Chat files+privacy + kind `image` con thumbnails**
- Chat: upload de archivos en canales (endpoint `/api/channels/[id]/attachments` multipart + bucket privado `channel-attachments`, signed URLs 1h, preview imágenes inline + card para otros), visibilidad public/private en `item_channels` con RLS filtrando privados por membership. Hotfix: recursión RLS (item_channels↔channel_members) resuelta con helper `auth_channel_ids()` SECURITY DEFINER. Fix pre-existente: `channel_members` insertaba `workspace_id` inexistente.
- Kind nuevo `image`: celda dedicada (`ImageCell.tsx`) con thumbnails 48×48 (56 en sub-items), canvas genera webp 128px 0.7 client-side al subir, ring índigo en la primera (cover). Endpoints `/files` extendidos con `thumb_filename/thumb_path`, batch `/files/signed-urls`, paralelos en `/api/sub-items/[id]/files`. Dispatch wireado en `ColumnCell` + `SubItemsView` (value_json).
- Oportunidades catálogo: `foto` convertido a `image` y movido a posición 1. Bug atrapado: el orden en boards lo controla `board_view_columns.position` por vista — no `board_columns.position`. Migration adicional upsertea posición por cada view_id del board.
- Migrations aplicadas a prod: `20260422000002` (chat files+privacy), `20260422000003` (RLS recursion fix), `20260422000004` (image kind constraint), `20260422000005` (catálogo foto→image+pos1), `20260422000006` (fix view_columns ordering).
- Memory: saved feedback `feedback_rls_recursion.md` + `feedback_board_column_position.md`.

**~sesión 2 — UX polish: headers bold + avatar pill + channels modal + bug/seed fixes**
- GenericDataTable header `font-bold text-[--ink-2]` (era semibold ink-4); RelationCell pill ahora con avatar 16px iniciales+color hash en warm-earth palette (sin cargo — decisión: "solo pill+avatar").
- ContactCard reusable en `components/ContactCard.tsx` — dos variantes (`contact` con acciones llamar/correo/WhatsApp, `institution` con `extras` para contadores); espera puesto+institución como `subLine`. Creado pero no wireado aún (integrarlo al detail view pide mapping de columnas del board contactos — diferido).
- Modal de canales sin entrar al detalle: nuevo `ItemChannelsModal` + columna `__chat` en GenericDataTable entre chevron y ↗. Icono outline (hover-only) si 0 mensajes, filled brand + puntito si hay; tooltip con conteo. API nueva `/api/boards/[id]/channel-summary` agrega `channel_messages` por item via service client. BoardView fetchea al montar + refresca al cerrar modal.
- Fix 400: `ItemChannels.handleCreateChannel` mandaba `{itemId}` al POST /api/channels que espera `{item_id}` — ahora manda el snake. Migration `20260422000001_channels_default_general.sql` revierte rename General→Actualizaciones (de la fase 7) y backfillea #general a items sin canal internal; aplicada a remoto.
- Heads-up: el indicador "hay mensajes" NO es unread real — no existe `channel_reads (user_id, channel_id, last_read_at)`. Unread por-usuario = siguiente paso cuando se pida.

**~sesión 1 — optimización velocidad + modularización (2 pasadas)**
- Pasada 1 (plan 4 fases): `next.config.ts` con `optimizePackageImports` (@dnd-kit/*, @tanstack/*) + `poweredByHeader:false`; `lib/boards/types.ts` centraliza `SubItemValue`/`SubItemData`/`ColPermission`/`SourceItem` (elimina 14 declaraciones duplicadas en 8 archivos); 44 API routes unificadas con `jsonError()` (191 replacements `NextResponse.json({error},{status})` → `jsonError(msg,status)`); 3 settings pages a Server Components (profile/workspace/superadmin) — 580→420 LOC con subcomponente form; `lib/sub-items/tree.ts` extrae `findInTree`/`patchTree`/`patchValueInTree` (dedupe vs `InlineSubItems`); `dynamic()` con `loading:` fallback en 5 modales (ColumnSettingsPanel, SubItemViewWizard, SourceColumnMapper, ImportWizard, QuoteEditorModal).
- Pasada 2 (split profundo): cleanup 17 imports huérfanos `NextResponse` post-refactor + restauración en 15 archivos que usaban `instanceof`; `SubItemsView.tsx` split a `components/sub-items/` — `types.ts`, `LoadingState`, `BoardItemsRenderer`, `BoardSubItemsRenderer`, `SubItemDetailDrawer`+`DrawerEditField`, `RollupUpPopup`, `AddColumnInline`; `ColumnSettingsPanel.tsx` split — `column-settings/constants.ts` (PRESET_COLORS/KIND_OPTIONS/NUMBER_FORMATS) + `PermissionsTab.tsx` (encapsula 4 useState, 1 useEffect, 4 handlers, ~200 LOC JSX).
- Métricas: `SubItemsView` 2067→1372 LOC (-34%); `ColumnSettingsPanel` 1910→1570 LOC (-18%); settings pages -160 LOC; API routes -150 LOC por `jsonError`. Typecheck limpio, `npm run build` compila en 2.2s con Turbopack (30 pages generadas).
- Skippeado con justificación: `React.memo(ColumnCell)` no aporta porque callbacks inline en `GenericDataTable.tsx:224` (`handleCommit`, `handleStartEdit`, etc.) cambian cada render — requiere refactor del contrato cells o profiling real con React DevTools Profiler antes de decidir. Split por `kind` completo de `ColumnSettingsPanel` (KindSelect, KindFormula, KindRelation, etc.) queda como followup — necesita testing manual por tipo. `typedRoutes:true` desactivado — falla en `SettingsNav.tsx` con hrefs dinámicos, requeriría cast `as Route` en 10+ Links.
- Pendiente siguiente sesión: probar en browser (drawer de sub-item, tab Permisos, 5 modales con Suspense), medir con React DevTools Profiler en `BoardView` + `SubItemsView` con 100+ items para decidir si refactor de cells vale la pena.

## 2026-04-21

**~sesión 12 — UX revamp Taller completo (shell + board + cells + cotización editor)**
- Rama `ux-revamp-taller`. Tokens CSS del tema Taller (bg #F7F6F3 + brand pino #1F4D3F + mono-dominante Geist Mono) en globals.css + @theme inline Tailwind 4; fonts Geist+GeistMono+InstrumentSerif en layout.tsx; `data-theme="taller"` default. Sidebar 52px rail → hover-expand overlay 232px con labels/workspace/user fade in; stats strip removido del board header; GenericDataTable + 17 celdas restyled a vars + hairlines; SelectCell con stage-progress (5 segmentos) cuando role=primary_stage; PeopleCell avatar 22px paleta warm earth; DateCell doble línea absoluta+relativa.
- SubItemsView: card wrapper + sub-header "PARTIDAS · N" + CTA footer "Abrir cotización en editor" (navega a /settings/.../templates) + "Generar PDF" (POST /api/documents/generate). CTA siempre visible, disabled con tooltip cuando no hay template/partidas.
- Template editor revamp al mockup quote-editor.jsx: top bar COT-XXXX·v1 mono + nombre uppercase + status + PDF + Plantilla básica + X; layout 3-col (BLOQUES palette + VARIABLES chips dashed | ESTRUCTURA canvas | paper preview); html-preview 816×1056px Carta con page-break visual cada 1056px + thumbnails hsl hash + tabla grid dinámica respetando column_configs (width/align por col). SubitemsTableBlockEditor con reorder ▲▼ + width presets S/M/L + align toggles + toggle miniatura.
- Editor ahora **modal overlay** (QuoteEditorModal 1400×900 con backdrop blur) desde subitems — ya no navega a /settings; nuevo endpoint `/api/document-templates/[id]/context?item_id=X` devuelve template+board+cols+workspace+liveItem (rootItem+subItems flattened con resolución relation/people/select→labels) en una llamada → preview usa datos reales de la oportunidad, no dummy. Fix hydration @dnd-kit con `dynamic(ssr:false)` sobre BlockCanvas.
- Migration `20260421000004_drop_generate_cotizacion_button.sql`: DELETE button columns action=generate_document + seed_system_boards sin el button (CTA vive en subitems). Migration `20260421000005_cotizacion_catalog_sub_item_cols.sql`: agrega `sku` a catalog (pos 1) + seed sub_item_columns en vista Catálogo de Oportunidades (sku/descripcion/foto/unit_price source-mapeados + cantidad default=1 + subtotal formula multiply). Ambas aplicadas a remote. lib/document-blocks/defaults.ts `basicQuoteTemplateBody()` con header columns/Para/subitems_table+thumbnail/total/signatures — botón "Plantilla básica" reemplaza bloques actuales. POST /api/document-templates usa este body cuando viene vacío.
- Build verde 75 rutas. 13 commits en rama — pendiente merge a main.

**~sesión 11 — Polish + fixes post knowledge graph (dummy data + bugs + UX)**
- Migration `20260421000002_dummy_data_seed.sql`: 20 rows × 5 boards (Instituciones/Contactos/Proveedores/Catálogo/Oportunidades) con nombres mexicanos + fotos picsum + relations cruzadas
- Migration `20260421000003_drop_opp_institucion.sql`: dropped `institucion` col de Oportunidades (vive solo en Contactos). Generate route ahora resuelve quote.institucion vía chain `opp.contacto → contact.institucion`. Sub_item_view "Oportunidades" removida de Instituciones (llega vía Contactos→Oportunidades)
- Fixes: FileCell null-safe en `mime` + soporte URLs externas; SourceColumnMapper lee `source_board_id` del view activo (no del board legacy); auto-backfill de values al crear sub_item_column con `source_col_key` (eliminó UX papercut del ↻ manual); ColumnSettingsPanel doble ancho (w-[40rem])
- Auth UX: proxy.ts extiende maxAge de cookies Supabase a 30d (sobrevive restart dev); login email ahora muestra "Revisa tu correo" (magic link) en vez de input OTP
- start.md sincronizado: quotes agregado a system boards table, document_templates schema documentado, auth dual (email + phone), roadmap actualizado a Fases 0-18 done + backlog 19-23

**~sesión 10 — Fase 18.5/18.6/18.7 — Opinionated Knowledge Graph (quotes pipeline + default relations)**
- Pivot de diseño: `documents` system board → `cotizaciones` (quotes) pipeline. Rationale: Tratto NO es Monday — viene opinionado. Cada board de sistema trae relations + sub_item_views por defecto, cero config.
- Migration `20260421000001_quotes_opinionated_graph.sql`: wipe CMP + rewrite `seed_system_boards()` + re-seed. Usa `SET session_replication_role=replica` para saltar triggers `log_sub_item_activity`/`log_sub_item_deleted` durante el wipe (cascade → trigger → INSERT a item_activity que luego viola FK al borrar sub_items)
- Quotes board: type=pipeline, stages Borrador→Enviada→Pendiente firma→Firmada→Anulada (2 closed). Columns: name · stage (primary_stage) · oportunidad/contacto/institucion (relations) · monto · pdf_url · folio · signatures · template_id · generated_by. Dropped legacy `source_item_id` + `status` select (reemplazados por relations + stages)
- Default sub_item_views seeded: Oportunidades={Catálogo native, Cotizaciones board_items via oportunidad rel}; Contactos={Oportunidades, Cotizaciones via contacto rel}; Instituciones={Contactos, Oportunidades, Cotizaciones via institucion rel}; Catálogo={Variantes native L2}; Cotizaciones=terminal
- Catálogo con cols: name + descripcion + foto (file) + unit_price (currency) + owner — listo para que el repeat block del template consuma directamente
- Default template "Cotización estándar" auto-seeded por workspace (heading + fields + repeat sub_items con columns image-izq+texto-der + total monto + 2 signatures cliente/vendedor)
- Button column "Generar cotización" auto-seeded en Oportunidades apuntando al default template (action=generate_document, confirm=true)
- Rename `accounts` slug → 'instituciones' + name → 'Instituciones' (system_key intacto)
- API updates (Haiku): 3 rutas `/api/documents/*` queries system_key `'documents'` → `'quotes'`; generate route extendido para populate relations oportunidad/contacto/institucion/monto desde source opp via item_values lookup; sign route limpia lógica de status (ahora stage-based)
- DELETE /api/boards/[id] ya bloqueaba system boards (pre-existía) + UI de lista settings/boards ya condicionaba botón a `!board.system_key`
- Plan.md: agregado Fase 22 Bidirectional Graph Editing al backlog — click en relation chip abre drawer lateral con cols editables del item relacionado (extensión de Fase 16.6 ref cols a UX de 1st class)
- Build verde, typecheck limpio

**~sesión 9 — Fase 18 Document Templates CLOSED (rediseño completo + implementación autónoma)**
- Rediseño: Fase 18 cambió de "Quote Engine" CMP-específico a sistema genérico de plantillas (más fácil que Eledo). Templates apuntan a cualquier target_board, body = array de blocks JSON portable. Stack: `@react-pdf/renderer` + custom block list con `@dnd-kit/sortable` (en vez de TipTap/Chromium)
- Migration `20260420000001_document_templates.sql`: `document_templates`, `document_audit_events`, `seed_system_boards` extendida con board `documents` (system_key='documents', 9 cols: template_id/source_item_id/pdf_url/folio/status/signatures/generated_by + 3 system). Backfill al workspace CMP. Fix: `ON CONFLICT DO NOTHING` en backfill porque `trg_boards_inject_system_cols` ya inyecta los 3 system cols
- `lib/document-blocks/`: types.ts (11 block types, RenderContext, DocumentMeta), resolver.ts (formatValue/resolveField/resolveTemplate/withRepeatScope, formatters es-MX nativos Intl, 0 deps), pdf-renderer.tsx (DocumentPdf, 442 LOC), html-preview.tsx (DocumentHtmlPreview para editor live preview, 438 LOC), validator.ts (validatePreConditions con scope root/sub_items_all/sub_items_any), sample-context.ts (dummy data para preview)
- Block types v1: heading · text (con inline markdown `**bold**` `*italic*`) · field · image · columns · spacer · divider · **repeat** (killer feature: loop sub_items/relation con inner blocks, scope switch dentro) · subitems_table · total · signature. `{{col_key|formatter}}` placeholders, `{{parent.col_key}}` escapa scope en repeat
- Template editor UI en `components/templates/`: BlockCanvas (dnd-kit sortable, expand/collapse inline), BlockPalette (11 botones + defaults), SlashMenu (popover de fields filtrable con hook `useSlashMenu`), 11 editores específicos en `blocks/` (uno por tipo)
- Página editor `/app/w/[workspaceSid]/settings/boards/[boardId]/templates/[tplId]`: layout 3-panel (palette | canvas | preview live), auto-save debounced 1.5s
- Tab "Documentos" en board settings: lista templates del board, CRUD inline con navegación al editor
- API: `/api/document-templates` GET/POST + `/api/document-templates/[id]` GET/PATCH/DELETE (RLS + admin check workspace O target_board), `/api/documents/generate` POST (valida → resuelve valores relations/people/select a labels → render PDF server-side con React-PDF renderToBuffer → upload bucket `documents` → crea item + audit event), `/api/documents/[id]/sign` POST (decode base64 → upload bucket `signatures` → re-render PDF con firma stampada → update pdf_url + signatures, auto-status 'signed' si todas required listas), `/api/documents?source_item_id=X` GET (lista docs generados desde item)
- Wiring: ButtonCell action `'generate_document'` (pre-conditions errors inline, abre PDF new tab, dispatch `document-generated` event), SignatureDrawModal (canvas HTML5 mouse+touch, base64 → sign API), DocumentsTab en ItemDetailView (lista con "Ver PDF"/"Firmar"/"Eliminar", listeners `document-generated`/`document-signed`)
- Delegación: 6 agentes Haiku paralelos en 4 layers (types/validator/API → renderers → editor UI → wiring) + orquestación Sonnet. ~3,500 LOC netos
- Build verde 80+ rutas, typecheck limpio
- Verificación manual de flujo end-to-end pendiente (crear template, agregar repeat+image block, generar PDF, firmar)

## 2026-04-20

**~sesión 8 — Fase 17.5 CLOSED (auditoría retroactiva + migration push)**
- Retomé proyecto tras 5 días off; descubrí que Fase 17.5 entera ya estaba implementada en código (commit 6c59785 del 16-abr) pero nunca loggeada ni marcada en plan.md
- Auditoría confirmó 11/11 tareas done: virtual scrolling activo (`useVirtualizer` GenericDataTable:303), 4 modales lazy (BoardView:11-14 `next/dynamic`), `Promise.all` en refColsMeta (BoardView:514,532), `useMemo(()=>createClient(),[])` (BoardView:91), 12+ callbacks memoizados, hooks compartidos (`useAsyncData/useDisclosure/useClickOutside`), helpers (`lib/api-helpers.ts`, `lib/column-permissions-handler.ts`, `lib/auth/resolve-profile.ts`), dup `SubItemColumn` borrada
- Migration `20260416000001_db_indexes.sql` (7 CREATE INDEX en FKs frecuentes) estaba committed local pero NO aplicada en remote Supabase — `supabase db push --linked` aplicada hoy; `supabase migration list` confirma versión remota actualizada
- Build verde 73+ rutas, plan.md actualizado con todos los `[x]`, Fase 17.5 marcada CLOSED
- `.claude/commands/start.md` restaurado desde git (commit cb1d37b) — había quedado vacío

## 2026-04-16

**~sesión 7 — Audit completo + Fase 17.5 Performance plan**
- Audit 5 dimensiones: componentes (131 archivos, 23K LOC), API routes (56), lib/, frontend perf, DB layer
- Hallazgos clave: `@tanstack/react-virtual` instalado pero NO USADO, 7 DB indexes faltantes, zero lazy loading, N+1 waterfall en refColsMeta, ~3K inline callbacks recreados por render
- Fase 17.5 agregada a plan.md: 3 sprints (speed → re-renders → code reduction) con 11 tasks concretas
- Decisión: no splitear megafiles ahora — speed fix real es virtual scrolling + lazy load + indexes

**~sesión 6 — Fase 17.B Email auth + cierre Fase 17**
- Login page: toggle Email/Teléfono con tabs pill — email como método default, `signInWithOtp({ email })` + `verifyOtp({ type:'email' })`
- Fase 17 cerrada: 17.A invitations + 17.B email auth done; 17.C multi-identity, 17.D trusted devices, 17.E cost monitoring DIFERIDOS (no críticos para CMP 21 users)
- Build limpio 72+ rutas

**~sesión 5 — Fase 17.A Invitations slice vertical**
- Migration 15 `invitations` table + migration 16 hardened `handle_new_auth_user` (SET search_path + EXCEPTION block para email signups)
- 3 API routes: POST/GET `/api/invitations`, DELETE `/api/invitations/[id]`, POST `/api/invitations/accept` (token validation + user provisioning)
- Landing page `/invite/[token]`: server component validates token/expiry, client component handles both PKCE (`?code=`) and implicit (`#access_token=`) flows via `exchangeCodeForSession`/`setSession`
- Settings → Members: botón "Invitar por email" + modal (email+role) + tabla invitaciones pendientes con "Copiar link" / "Revocar"
- Email via Resend directo (bypass Supabase 2/hr rate limit): `generateLink({ type:'invite' })` + Resend REST API con template HTML; cleanup automático de auth.users huérfanos en re-invite

## 2026-04-15

**~sesión 4 — 16.6 ref cols shipped + fixes RLS/UUID**
- `kind='reflejo'` como tipo real: CellKind union extendido, migration 14 agrega al `board_columns_kind_check`, PATCH route permite transición reflejo↔original en system cols, ColumnCell case 'reflejo' dispatcha por `ref_field_kind` (read-only), ColumnSettingsPanel.handleSaveRef persiste kind + guarda `original_kind` para revert
- Nested relation resolution: `refNestedBoardId` state capturado en ref fetch useEffect cuando mirrored field es kind='relation'; `relationTargetBoards` memo expandido para incluir nested boards; toRow resuelve rawValue via `relationLabelMap[nestedBoardId]`
- Bug root causes resueltos: (a) `/api/items?format=col_keys` usaba JWT+RLS para board_columns → silent 0 filas → col_values vacío; fix service client; (b) `column_permissions` GET/POST/DELETE mismo patrón → 404; fix service client; (c) toRow fallback `?? targetId/rawValue` leakeaba UUID durante carga; fix fallback null; (d) ref edit PUT leía NAME de row.cells en vez de item_id de rawItems; fix raw item lookup
- Visual: chip `rounded-md border bg-gray-50 px-1.5 py-0.5` para relation cells, prefix ↪ ámbar dentro del chip cuando isRef, wrapper amber del ColumnCell removido
- Migration chain aplicada: 11 (system cols+triggers+metatags), 12 (backfill contacto/institucion/monto), 13 (end_date metatag), 14 (reflejo kind constraint)

**~sesión 3 — Fase 16 CLOSED**
- Fase 16 cerrada completa: 16.5 (25/25), 16.6 (ref cols), RelationPicker, auto-fill runtime, required enforcement
- **RelationPicker modal**: nuevo `components/RelationPicker.tsx` con fetch target board items + search + clear button + Esc cierra; `RelationCell` ahora clickable (no double-click) llama `onCommit(item_id)`; `BoardView.relationLabelMap` useEffect batch-fetch items de target boards → `toRow` resuelve id → name en cells relation (fallback a id mientras carga)
- **Fase 16.6 Ref Columns (mirror/lookup)**: nuevo concepto — col que muestra campo de item relacionado, editar escribe al source. `isRefCol()` helper, `GET /api/items?ids=a,b&format=col_keys` devuelve `col_values: {col_key: value}` mapeado server-side, `BoardView` refColsMeta + refMap + refTargetCols, `toRow` pobla ref cells, `handleCellChange` intercepta ref cols → PUT al source item con optimistic + revert. `ColumnCell` wrapper `bg-amber-50/30 ring-amber-200` cuando isRef. `GenericDataTable` header icon ↪ + tooltip. `ColumnSettingsPanel` tab "Reflejo" con dropdowns (relation col + target field) + handleSaveRef/handleClearRef
- **16.5.16 auto-fill runtime**: `handleCellChange` detecta `col.settings.auto_fill_targets` en relation cols; al picker: fetch source item via `/api/items?format=col_keys`, itera targets, para cada empty en row actual hace PUT con optimistic update. Zero-overwrite (solo rellena empty)
- **16.5.18 required enforcement**: `ButtonCell.runValidations` añade required-empty check antes de condition validation (mensaje "X es requerido"); `ColumnCell.isInvalid` considera `settings.required` → red overlay + tooltip "Campo requerido"
- **ColumnSettings type** extendido con `required`, `role`, `display`, `read_only`, `auto_fill_targets`, `ref_source_col_key`, `ref_field_col_key`, `ref_field_kind` — centraliza config de Fase 16.5/16.6
- **Fase 16.5 remates**: `16.5.4` sub-item-views POST auto-inyecta 3 system sub_item_columns (created_by/created_at/updated_at); `end_date` metatag agregado (role='end_date' para date cols, helper getEndDateColKey, dropdown ColumnSettingsPanel, PATCH unicidad, backfill en migration 13); backfill migration 12 agrega opportunities.contacto/institucion/monto + contacts.institucion a workspaces existentes
- Fixes build: `ColumnSettings` type extendido para soportar nuevos campos sin `as any` en todos lados; `toRow` cast paren fix en ref cells

**~sesión 2**
- Fase 16.5 lanzada completa: 22/25 tareas done, 3 diferidas (16.5.4/16/18/25)
- Migration `20260415000011` (263 líneas): `items.created_by`, `sub_items.created_by`+`updated_at`, `sub_item_columns.is_system`, triggers `set_created_by`/`set_updated_at`/`log_sub_item_activity`/`log_sub_item_value_activity`, rewrite `seed_system_boards` con metatags + opportunities contacto/institucion/monto + contacts.institucion + auto-inject 3 system cols por board, trigger `inject_system_board_columns` en boards nuevos, backfill existentes + metatag stage/owner
- `lib/boards/helpers.ts` client-safe: `getPrimaryStageColKey`/`getOwnerColKey` con fallback soft a `col_key='stage'`/`'owner'` (zero break legacy); re-export desde `lib/boards/index.ts`
- Refactor `BoardView.tsx` + `ItemDetailView.tsx`: `ITEMS_FIELD` → dinámico `getItemsFieldMap(stageKey, ownerKey)`, `augmentSettings(col, stageColKey, ownerColKey, ...)`, useMemo en los col keys
- `ColumnSettingsPanel`: dropdown "Rol del sistema" (visible solo para people/select non-system), `isStageCol` lee `settings.role`, 409 handling al guardar
- PATCH `/api/boards/[id]/columns/[colId]` valida unicidad de role='owner' y 'primary_stage' por board → 409
- `DateCell` modo relativo ("hace X min/h/d") + read_only; `PeopleCell` read-only mode; `ColumnCell` `isSystemReadOnly` bloquea onStartEdit
- `ActivityFeed`: 3 acciones nuevas `sub_item_created`/`sub_item_deleted`/`sub_item_value_changed` + realtime subscription a `item_activity` (fallback "Alguien" si realtime sin join)
- RelationCell auto-fill (16.5.16) DIFERIDO: component sigue display-only (Phase 4 picker TODO) — seed config `auto_fill_targets` ya puesta en `contacto` (inerte hasta que exista picker)
- Fixes durante build: (a) `server-only` en `lib/boards/index.ts` bloqueaba import desde client comps → helpers movidos a `lib/boards/helpers.ts`; (b) `toRow()` top-level ref a `ITEMS_FIELD` → convertido a parámetro; (c) `ColumnCell` typing → `settings as any`
- Build 72+ rutas verde

**~sesión 1**
- Fase 16 completa (13 tareas): herencia permisos columna, `lib/permissions.ts` con userCanViewColumn/userCanEditColumn/userCanAccessItem/requireBoardAdmin, 5 rutas sub-items hardened con workspace_id + access checks
- Nuevo modelo `default_access` (edit/view/restricted) + admin bypass + ColumnSettingsPanel dropdown + backend anota user_access por columna + cells renderizan empty/readonly/edit
- Per-board admin: migration `board_members.access` con nivel 'admin', 12 rutas migradas de requireAdminApi→requireBoardAdmin, frontend gating (BoardView/SubItemsView/ItemDetailView reciben isBoardAdmin server-side), Settings Members dropdown 3 niveles
- Fix: botón Territorio → Permisos con link a `?tab=acceso`, users prop propagada a sub-item panels, eliminar última vista permitido, default_access solo oculta lista en sub-item cols
- Plan: Fase 17/18 rotadas (Invites ↔ Quote), Fase 16.5 nueva (system cols + meta-tags + activity audit), Fase 21 Filter/Sort/Group, backup `plan_20260415.md`, plan.md compactado Fases 0–16 (2189→1380 líneas)

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
