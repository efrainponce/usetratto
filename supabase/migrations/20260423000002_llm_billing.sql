-- LLM billing: pricing + usage log + budgets. Default caps muy conservadores.

-- ── Pricing table ($USD por millón de tokens) ─────────────────────────
CREATE TABLE llm_pricing (
  provider          text NOT NULL,
  model             text NOT NULL,
  input_per_mtok    numeric(10,4) NOT NULL,
  output_per_mtok   numeric(10,4) NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, model)
);

-- Seed con precios conocidos (enero 2026). Ajusta via UPDATE si Google/Anthropic cambian.
-- Gemini free tier = $0 real pero tracking igual con precios paid (para cuando migres).
INSERT INTO llm_pricing (provider, model, input_per_mtok, output_per_mtok) VALUES
  ('gemini',    'gemini-2.5-flash',       0.075, 0.30),
  ('gemini',    'gemini-2.5-flash-lite',  0.038, 0.15),
  ('gemini',    'gemini-2.5-pro',         1.25,  5.00),
  ('gemini',    'gemini-2.0-flash',       0.075, 0.30),
  ('anthropic', 'claude-haiku-4-5-20251001',  1.00,  5.00),
  ('anthropic', 'claude-sonnet-4-6-20251001', 3.00, 15.00),
  ('anthropic', 'claude-opus-4-7',            15.00, 75.00);

-- ── Usage log (append-only) ───────────────────────────────────────────
CREATE TABLE llm_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id      uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  provider        text NOT NULL,
  model           text NOT NULL,
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  cost_usd        numeric(12,6) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_usage_workspace_created ON llm_usage(workspace_id, created_at DESC);
CREATE INDEX idx_llm_usage_user_created ON llm_usage(user_id, created_at DESC);

-- ── Budgets (workspace-level + global fallback) ───────────────────────
-- workspace_id NULL = default global para workspaces sin budget propio.
CREATE TABLE llm_budgets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  daily_limit_usd   numeric(10,4) NOT NULL,
  monthly_limit_usd numeric(10,4) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

-- Global default: $0.25/día, $3.00/mes. Se usa si un workspace no tiene budget propio.
INSERT INTO llm_budgets (workspace_id, daily_limit_usd, monthly_limit_usd)
VALUES (NULL, 0.25, 3.00);

-- Trigger touch updated_at
CREATE OR REPLACE FUNCTION touch_llm_budget_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_llm_budget_touch
  BEFORE UPDATE ON llm_budgets
  FOR EACH ROW EXECUTE FUNCTION touch_llm_budget_updated();

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE llm_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_budgets ENABLE ROW LEVEL SECURITY;

-- Pricing: todos leen, nadie escribe vía RLS (solo service client)
CREATE POLICY llm_pricing_select ON llm_pricing FOR SELECT USING (true);

-- Usage: el user ve lo suyo; admins del workspace ven todo del workspace; superadmin ve todo
CREATE POLICY llm_usage_select ON llm_usage FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role = 'superadmin'
             OR (u.role = 'admin' AND u.workspace_id = llm_usage.workspace_id))
    )
  );

-- Budgets: admins del workspace ven + editan su budget; superadmin ve/edita todos
CREATE POLICY llm_budgets_select ON llm_budgets FOR SELECT
  USING (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role = 'superadmin'
             OR (u.role = 'admin' AND u.workspace_id = llm_budgets.workspace_id))
    )
  );

CREATE POLICY llm_budgets_upsert ON llm_budgets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role = 'superadmin'
             OR (u.role = 'admin' AND u.workspace_id = llm_budgets.workspace_id))
    )
  );

-- ── Helpers ──────────────────────────────────────────────────────────
-- Suma gasto de un workspace en un rango [from, now). Usado en pre-flight.
CREATE OR REPLACE FUNCTION llm_usage_sum(p_workspace_id uuid, p_from timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)
    FROM llm_usage
   WHERE workspace_id = p_workspace_id
     AND created_at >= p_from;
$$;
