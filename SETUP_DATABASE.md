# Database Setup Guide

## Prerequisites
- Supabase project created at https://app.supabase.com
- Environment variables set in `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=your_project_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  ```

## Method 1: SQL Editor (Quickest)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy contents from `supabase/migrations/20251121205919_create_telemetry_tables.sql`
6. Paste and click **Run**
7. Verify tables created in **Table Editor**

## Method 2: Supabase CLI (Recommended)

### Install Supabase CLI
```bash
# macOS/Linux
npm install -g supabase

# Or using brew (macOS)
brew install supabase/tap/supabase
```

### Link to Your Project
```bash
# Login to Supabase
npx supabase login

# Link to your project (get project ref from dashboard URL)
npx supabase link --project-ref your-project-ref
```

### Run Migrations
```bash
# Push migrations to Supabase
npx supabase db push
```

## Method 3: Manual Table Creation

If you prefer, create tables manually in **Table Editor**, but using the migration file is recommended.

## Verify Tables Created

Run this query in SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('telemetry_sessions', 'chat_messages');
```

You should see both tables listed.

## Test the Setup

After creating tables, test by uploading a telemetry file at http://localhost:3000
