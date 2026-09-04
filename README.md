# Accomplishment Report Webapp

Internal tool for employees to fill an accomplishment-report form and download a finished report as **Word (.docx)** or **PDF**, generated from an admin-provided template.

## Stack

- Node.js + Express
- Plain browser frontend (no bundler)
- `.docx` generation: `docxtemplater` (fills placeholders `{fieldName}` in `templates/report-template.docx`)
- PDF generation: `pdfmake`

## Quick Start

```bash
npm install
npm run make-template   # (re)creates the starter Word template from config/fields.json
npm start               # http://localhost:3000
```

- **Form**: `http://localhost:3000/`
- **Admin**: `http://localhost:3000/admin.html`
- **Saved reports**: `http://localhost:3000/reports.html`

## Configuration

- `config/fields.json` — report title, file name, signature, and form fields (label, name/placeholder token, type, required).
- `templates/report-template.docx` — the Word blueprint; placeholders like `{fullName}` are replaced on generation.
- Admin page edits fields and lets you upload a template.
- `.env` — `PORT` and optional `DATABASE_URL`. Copy `.env.example`.

## Storage

Reports are saved at submit time and listed on the reports page.
- **Supabase mode** (recommended): reports stored as rows in the `reports` table + docx/pdf files in the `reports` storage bucket. No login required in this mode; every user sees only their own reports (RLS).
- **Local mode** (no Supabase configured): falls back to a `data/submissions.json` file store and no login. Dev only.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/config` | no | Form/config JSON |
| POST | `/api/config` | yes | Save form/config JSON |
| POST | `/api/generate?format=docx\|pdf` | yes | Generate + save a report, returns the file |
| GET | `/api/reports` | yes | List the current user's reports |
| GET | `/api/reports/:id` | yes | Report metadata |
| GET | `/api/reports/:id/download?format=docx\|pdf` | yes | Download a saved report |
| GET | `/config/supabase` | no | Supabase client config (url + anon key) |
| GET | `/health` | no | Health check |
| GET | `/api/template` | no | Download current template |
| POST | `/api/template` | yes | Upload a new `.docx` template |

> In local mode (Supabase not configured), the `yes` endpoints skip auth. In Supabase mode, they require a valid `Authorization: Bearer <jwt>` header from `/login.html`.

## Free Cloud Deployment (Supabase)

Supabase provides free **Postgres + Auth + Storage**. This makes it an employee-facing tool with login and file storage, without a DB password needing to circulate. The app runs in **Supabase mode** when `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` are set.

### Setup your Supabase project

1. Create a free Supabase project.
2. **Auth → Providers → Email** is enabled by default (disable email confirm for instant login, or keep it).
3. **Storage** → create a bucket named `reports` (set to *private*).
4. **SQL Editor** → run the setup (table + RLS). Example:

```sql
create table if not exists reports (
  id text primary key,
  created_at timestamptz default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_values jsonb not null,
  docx_path text,
  pdf_path text
);
alter table reports enable row level security;
create policy "own reports" on reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

5. Copy the **Project URL** and the **publishable (anon) key** from *Settings → API*.

### Configure the app

Set env vars on the host (or a gitignored local `.env`):

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-side writes; never expose to browser
```

> Keys are gitignored. Never commit them — `E-ACR` is public and auto-pushes.

### Host the Node server

The docx/pdf generation runs in Node, so host `server.js` on a free Node platform (Render/Railway) or run it locally/intranet:
- Render: *New Web Service* → connect repo → build `npm ci` → start `node server.js` → add the env vars.
- Local: `npm start`.

`POST /api/generate` and the report endpoints require a signed-in user (Supabase Auth JWT). The app serves `/login.html`, `/index.html`, `/reports.html`, `/admin.html`.

> Supabase does not host the Node server — it provides DB/Auth/Storage. Use Render/Railway for the host, or move docx/pdf generation client-side for a fully serverless setup.

