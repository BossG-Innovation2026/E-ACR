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

Every submission is saved and listed on the reports page.
- If `DATABASE_URL` is set (Postgres), reports are stored in a `reports` table.
- Without it, the app falls back to a local `data/submissions.json` (dev only; not for production).

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/config` | Returns current form/config JSON |
| POST | `/api/config` | Saves form/config JSON |
| POST | `/api/generate?format=docx\|pdf` | Generate and save a report, returns the file |
| GET | `/api/reports` | List saved reports |
| GET | `/api/reports/:id` | Report metadata |
| GET | `/api/reports/:id/download?format=docx\|pdf` | Download a saved report |
| GET | `/health` | Health check |
| GET | `/api/template` | Download current template |
| POST | `/api/template` | Upload a new `.docx` template |

## Free Cloud Deployment (Supabase DB + Node host)

Supabase provides a **free Postgres** (plus optional Auth/Storage). It does not host a long-running Node server, so host the Express app on a free Node host (Render or Railway) and point it at Supabase's Postgres.

1. **Supabase** — create a free project → *Project Settings → Database → Connection string*:
   - Copy the **pooler** URI (Session or Transaction pooler). It looks like:
     `postgresql://postgres.<ref>:<password>@...pooler.supabase.com:5432/postgres?sslmode=require`
   - Keep the password (set it under *Database* if not already).
2. **Host the app** on Render (free): *New Web Service* → connect the repo (or use `render.yaml`), build `npm ci`, start `node server.js`.
3. Set env vars on the host:
   - `DATABASE_URL` = the Supabase pooler URI
   - `DATABASE_SSL=true` (or ensure `sslmode=require` is in the URI)
4. Deploy. The app auto-creates the `reports` table. Confirm with the service URL + `/health`.
5. Load your real template + fields at `/admin.html`.

> Because the connection string contains the DB password, keep it in the host's env vars (`DATABASE_URL`) — never commit it. `.env` is gitignored.

## Full-Supabase alternative (no separate host)

If you'd rather not run a Node host, the API can be rewritten as **Supabase Edge Functions** (Deno) instead of Express. That is a larger change (different runtime), so the Express app above is the fast path.
