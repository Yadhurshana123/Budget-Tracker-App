# 💰 Homies Budget App

React + Supabase app for your crew to track daily budgets with realtime updates.

---

## 🚀 Setup Steps

### 1. Supabase Setup
1. Go to [supabase.com](https://supabase.com) → Create account → New Project
2. Open **SQL Editor** → Paste contents of `supabase_setup.sql` → Run
3. Go to **Database → Replication** → Enable Realtime for `expenses`, `comments`, and (optional) `expense_per_head_items` tables so live updates and **comment notifications** work
4. Go to **Settings → API** → Copy `Project URL` and `anon public` key

### 2. Project Setup
```bash
# Clone or extract the project folder
cd homies-budget-app

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env
```

Edit `.env` and paste your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run the App
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

---

## 👥 Default Users
| Username | Default Password | Note |
|----------|-----------------|------|
| You | pass123 | Change on first login |
| Friend | pass123 | Change on first login |
| Akka | pass123 | Change on first login |

> You can change usernames in `supabase_setup.sql` before running.

---

## 📁 Project Structure
```
src/
  pages/
    LoginPage.jsx          — Login + First login redirect
    ChangePasswordPage.jsx — First login password change
    DashboardPage.jsx      — Home with menu cards
    AddBudgetPage.jsx      — Add items → Preview → Confirm & Save
    PastHistoryPage.jsx    — Own entries, edit
    OthersBudgetPage.jsx   — All homies' entries + comments (Realtime)
    ProfilePage.jsx        — Spending summary + per-head filter
  components/
    Navbar.jsx             — Top nav with profile + logout
  supabaseClient.js        — Supabase connection
  index.css                — Global styles (White + Blue theme)
  App.jsx                  — Routes
```

---

## ✨ Features
- ✅ Login with username + password
- ✅ First login → mandatory password change
- ✅ Add daily budget with multiple items + optional per-head split
- ✅ Preview summary before confirming
- ✅ View own past history (edit entries)
- ✅ View homies’ confirmed budgets
- ✅ Comment on anyone's budget entry
- ✅ Realtime updates — no page refresh needed
- ✅ Comment notifications (nav bell + optional desktop alerts) when homies comment
- ✅ White + Blue clean desktop theme

---

## 🔧 Build for Production
```bash
npm run build
```
Deploy the `dist/` folder to Vercel or Netlify. Add `.env` values in their dashboard.

---

## 📄 Database Tables
| Table | Purpose |
|-------|---------|
| `users` | Auth (username, password, first login flag) |
| `expenses` | Daily expense header (date, total, confirmed flag) |
| `expense_items` | Line items per expense (product, qty, amount) |
| `expense_per_head_items` | Optional per-homie breakdown |
| `comments` | Comments on expense entries |
