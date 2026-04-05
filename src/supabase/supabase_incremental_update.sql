-- =============================================
-- Existing Supabase project — run in SQL Editor
-- (Latest app features: optional qty + per-head budget)
-- Safe to re-run: CREATE IF NOT EXISTS; DROP NOT NULL is idempotent in Postgres.
-- =============================================

-- A) Quantity optional on main budget line items
ALTER TABLE expense_items
  ALTER COLUMN quantity DROP NOT NULL;

-- B) Per-head budget (name dropdown + products per person)
CREATE TABLE IF NOT EXISTS expense_per_head_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  for_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INT,
  amount NUMERIC(10,2) NOT NULL
);

ALTER TABLE expense_per_head_items DISABLE ROW LEVEL SECURITY;

-- C) Budget action notifications (add / edit / delete → bell for other members)
CREATE TABLE IF NOT EXISTS budget_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expense_id UUID,               -- nullable: deleted budgets lose their row
  action TEXT NOT NULL,          -- 'added' | 'edited' | 'deleted'
  expense_date DATE,
  total_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_notifications DISABLE ROW LEVEL SECURITY;

-- Enable Realtime on budget_notifications in:
-- Supabase Dashboard → Database → Replication → budget_notifications ✓
-- =============================================
-- Done. No change needed for: users, expenses, comments
-- if you already have them from the original setup.
-- =============================================
