-- =============================================
-- Homies Budget App — Supabase SQL Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_first_login BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_amount NUMERIC(10,2) DEFAULT 0,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPENSE ITEMS TABLE
CREATE TABLE IF NOT EXISTS expense_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INT,
  amount NUMERIC(10,2) NOT NULL
);

-- 3b. PER-HEAD BUDGET (optional breakdown by homie)
CREATE TABLE IF NOT EXISTS expense_per_head_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  for_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INT,
  amount NUMERIC(10,2) NOT NULL
);

-- =============================================
-- 4. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. SEED USERS
-- Replace passwords with your desired defaults
-- Users must change password on first login
-- =============================================

INSERT INTO users (username, password, is_first_login) VALUES
  ('Yadhu', 'pass123', true),
  ('Nive', 'pass123', true),
  ('Kavi', 'pass123', true)
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- 6. DISABLE RLS (Simple trusted crew / homies app)
-- =============================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_per_head_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. OPTIONAL: create per-head table on existing projects (run in SQL Editor)
/*
CREATE TABLE IF NOT EXISTS expense_per_head_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  for_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INT,
  amount NUMERIC(10,2) NOT NULL
);
ALTER TABLE expense_per_head_items DISABLE ROW LEVEL SECURITY;
*/

-- =============================================
-- 8. OPTIONAL: existing DBs created with NOT NULL quantity
-- Run once in SQL Editor if inserts fail without quantity:
-- ALTER TABLE expense_items ALTER COLUMN quantity DROP NOT NULL;
-- =============================================
-- Done! Enable Realtime for expenses & comments
-- in Supabase Dashboard → Database → Replication
-- =============================================
