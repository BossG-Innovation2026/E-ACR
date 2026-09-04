-- E-ACR Supabase setup
-- Run in Supabase SQL Editor (or `supabase db push`).
-- Assumes Auth is enabled (Email provider). Creates the reports table,
-- enables RLS, and sets a private storage bucket `reports`.

-- 1. Reports table
create table if not exists reports (
  id text primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  form_values jsonb not null default '{}'::jsonb,
  docx_path text,
  pdf_path text
);

-- 2. Row Level Security (each user sees only own reports)
alter table reports enable row level security;

drop policy if exists "own reports select" on reports;
create policy "own reports select" on reports
  for select using (auth.uid() = user_id);

drop policy if exists "own reports insert" on reports;
create policy "own reports insert" on reports
  for insert with check (auth.uid() = user_id);

drop policy if exists "own reports update" on reports;
create policy "own reports update" on reports
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reports delete" on reports;
create policy "own reports delete" on reports
  for delete using (auth.uid() = user_id);

-- 3. Index for lookups
create index if not exists reports_user_created_idx
  on reports (user_id, created_at desc);

-- 4. Private storage bucket for generated docx/pdf
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- 5. Bucket policies (owner access)
drop policy if exists "own reports bucket" on storage.objects;
create policy "own reports bucket" on storage.objects
  for all using (
    bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]
  );
