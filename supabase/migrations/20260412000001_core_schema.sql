-- =============================================================================
-- 001_core_schema.sql
-- Tratto — schema completo (multi-tenant, sid global, EAV, sub-items)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SEQUENCE GLOBAL — compartida entre TODAS las entidades con sid
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS tratto_sid_seq START 10000000;

-- ---------------------------------------------------------------------------
-- WORKSPACES
-- ---------------------------------------------------------------------------
CREATE TABLE workspaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid         bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- USERS  (profile de auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sid          bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  name         text        NOT NULL DEFAULT '',
  phone        text        UNIQUE,
  email        text,
  role         text        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('superadmin','admin','member','viewer')),
  workspace_id uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TEAMS
-- ---------------------------------------------------------------------------
CREATE TABLE teams (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid          bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_teams (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id  uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, team_id)
);

-- ---------------------------------------------------------------------------
-- TERRITORIES
-- ---------------------------------------------------------------------------
CREATE TABLE territories (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid          bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  parent_id    uuid        REFERENCES territories(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_territories (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  territory_id uuid NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, territory_id)
);

-- ---------------------------------------------------------------------------
-- BOARDS
-- ---------------------------------------------------------------------------
CREATE TABLE boards (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid          bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  slug         text        NOT NULL,
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  type         text        NOT NULL DEFAULT 'table'
                           CHECK (type IN ('pipeline','table')),
  description  text,
  system_key   text,       -- NULL = board custom; string = board de sistema
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

-- ---------------------------------------------------------------------------
-- BOARD STAGES  (solo para boards tipo 'pipeline')
-- ---------------------------------------------------------------------------
CREATE TABLE board_stages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid        bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  board_id   uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#6B7280',
  position   int         NOT NULL DEFAULT 0,
  is_closed  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- BOARD COLUMNS
-- ---------------------------------------------------------------------------
CREATE TABLE board_columns (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid         bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  board_id    uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  col_key     text        NOT NULL,  -- identificador estable ('stage','owner','deadline','custom_1')
  name        text        NOT NULL,
  kind        text        NOT NULL
              CHECK (kind IN ('text','number','date','select','multiselect',
                              'people','boolean','url','file','email','phone',
                              'autonumber','formula','relation')),
  position    int         NOT NULL DEFAULT 0,
  is_system   boolean     NOT NULL DEFAULT false,
  is_hidden   boolean     NOT NULL DEFAULT false,
  required    boolean     NOT NULL DEFAULT false,
  settings    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, col_key)
);

-- ---------------------------------------------------------------------------
-- BOARD MEMBERS  (acceso al board — user XOR team)
-- ---------------------------------------------------------------------------
CREATE TABLE board_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  team_id    uuid        REFERENCES teams(id) ON DELETE CASCADE,
  access     text        NOT NULL DEFAULT 'view'
                         CHECK (access IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xor_user_team CHECK (
    (user_id IS NOT NULL AND team_id IS NULL) OR
    (user_id IS NULL AND team_id IS NOT NULL)
  ),
  UNIQUE (board_id, user_id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (board_id, team_id) DEFERRABLE INITIALLY DEFERRED
);

-- ---------------------------------------------------------------------------
-- COLUMN PERMISSIONS  (visibilidad/edición por columna — user XOR team)
-- ---------------------------------------------------------------------------
CREATE TABLE column_permissions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id  uuid        NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  team_id    uuid        REFERENCES teams(id) ON DELETE CASCADE,
  access     text        NOT NULL DEFAULT 'view'
                         CHECK (access IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xor_user_team CHECK (
    (user_id IS NOT NULL AND team_id IS NULL) OR
    (user_id IS NULL AND team_id IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------------
-- ITEMS  (registros de cualquier board)
-- ---------------------------------------------------------------------------
CREATE TABLE items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid          bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id     uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id     uuid        REFERENCES board_stages(id) ON DELETE SET NULL,
  name         text        NOT NULL DEFAULT '',
  owner_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  territory_id uuid        REFERENCES territories(id) ON DELETE SET NULL,
  deadline     date,
  position     int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX items_board_id_idx     ON items(board_id);
CREATE INDEX items_workspace_id_idx ON items(workspace_id);
CREATE INDEX items_stage_id_idx     ON items(stage_id);
CREATE INDEX items_owner_id_idx     ON items(owner_id);

-- ---------------------------------------------------------------------------
-- ITEM VALUES  (EAV — columnas custom)
-- ---------------------------------------------------------------------------
CREATE TABLE item_values (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  column_id    uuid        NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  value_text   text,
  value_number numeric,
  value_date   date,
  value_json   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, column_id)
);

CREATE INDEX item_values_item_id_idx ON item_values(item_id);

-- ---------------------------------------------------------------------------
-- SUB-ITEMS  (jerárquicos, tabla separada)
-- ---------------------------------------------------------------------------
CREATE TABLE sub_items (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid              bigint      UNIQUE NOT NULL DEFAULT nextval('tratto_sid_seq'),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id          uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  parent_id        uuid        REFERENCES sub_items(id) ON DELETE CASCADE,
  depth            smallint    NOT NULL DEFAULT 0 CHECK (depth IN (0,1)),
  name             text        NOT NULL DEFAULT '',
  qty              numeric     NOT NULL DEFAULT 1,
  unit_price       numeric     NOT NULL DEFAULT 0,
  notes            text,
  catalog_item_id  uuid        REFERENCES items(id) ON DELETE SET NULL,
  position         int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sub_items_item_id_idx ON sub_items(item_id);

-- ---------------------------------------------------------------------------
-- SUB-ITEM VALUES
-- ---------------------------------------------------------------------------
CREATE TABLE sub_item_values (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_item_id    uuid    NOT NULL REFERENCES sub_items(id) ON DELETE CASCADE,
  column_id      uuid    NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  value_text     text,
  value_number   numeric,
  value_date     date,
  value_json     jsonb,
  UNIQUE (sub_item_id, column_id)
);

-- ---------------------------------------------------------------------------
-- SUB-ITEM VIEWS  (qué columnas mostrar por board/stage)
-- ---------------------------------------------------------------------------
CREATE TABLE sub_item_views (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id       uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id       uuid        REFERENCES board_stages(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  column_ids     jsonb       NOT NULL DEFAULT '[]',
  show_variants  boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ITEM CHANNELS
-- ---------------------------------------------------------------------------
CREATE TABLE item_channels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id      uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  type         text        NOT NULL DEFAULT 'internal'
                           CHECK (type IN ('internal','system')),
  team_id      uuid        REFERENCES teams(id) ON DELETE SET NULL,
  position     int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- CHANNEL MESSAGES
-- ---------------------------------------------------------------------------
CREATE TABLE channel_messages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id     uuid        NOT NULL REFERENCES item_channels(id) ON DELETE CASCADE,
  user_id        uuid        REFERENCES users(id) ON DELETE SET NULL,
  body           text        NOT NULL DEFAULT '',
  type           text        NOT NULL DEFAULT 'text'
                             CHECK (type IN ('text','system','whatsapp')),
  metadata       jsonb       NOT NULL DEFAULT '{}',
  whatsapp_sid   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX channel_messages_channel_id_idx ON channel_messages(channel_id);

-- ---------------------------------------------------------------------------
-- CHANNEL MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE channel_members (
  channel_id uuid        NOT NULL REFERENCES item_channels(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- MENTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE mentions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id         uuid        NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
  mentioned_user_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notified           boolean     NOT NULL DEFAULT false,
  replied            boolean     NOT NULL DEFAULT false,
  reply_message_id   uuid        REFERENCES channel_messages(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ITEM ACTIVITY  (audit trail — alimentado por triggers)
-- ---------------------------------------------------------------------------
CREATE TABLE item_activity (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id       uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  sub_item_id   uuid        REFERENCES sub_items(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  action        text        NOT NULL,  -- 'created','updated','stage_changed','deleted', etc.
  old_value     jsonb,
  new_value     jsonb,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX item_activity_item_id_idx ON item_activity(item_id);

-- ---------------------------------------------------------------------------
-- QUOTE TEMPLATES
-- ---------------------------------------------------------------------------
CREATE TABLE quote_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id       uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  stage_id       uuid        REFERENCES board_stages(id) ON DELETE SET NULL,
  template_html  text        NOT NULL DEFAULT '',
  header_fields  jsonb       NOT NULL DEFAULT '[]',
  line_columns   jsonb       NOT NULL DEFAULT '[]',
  footer_fields  jsonb       NOT NULL DEFAULT '[]',
  show_prices    boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------------------
CREATE TABLE quotes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id        uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  template_id    uuid        NOT NULL REFERENCES quote_templates(id) ON DELETE RESTRICT,
  generated_by   uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pdf_url        text,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','sent','accepted','rejected')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
