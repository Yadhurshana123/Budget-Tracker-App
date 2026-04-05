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

-- =============================================
-- Done. No change needed for: users, expenses, comments
-- if you already have them from the original setup.
-- =============================================
