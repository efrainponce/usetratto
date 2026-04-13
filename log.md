# log

## 2026-04-13

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
