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

## Free Cloud Deployment

The app is plain Node.js (no headless browser), so it runs on any free Node host. Suggested: **Render (free)** + a **free Postgres** (Neon or Supabase).

1. Push this folder to a GitHub repo.
2. Create a free Postgres DB (e.g. Neon → get a connection string).
3. **Render** → *New Web Service* → connect the repo (or use `render.yaml` — Blueprint).
   - Build: `npm ci` — Start: `node server.js`
   - Add env var `DATABASE_URL` with your Postgres connection string.
4. Deploy; the app auto-creates the `reports` table.
5. Visit the service URL, confirm `/health`, then set the template + fields via `/admin.html`.

Alternative hosts: Railway, Fly.io. For the Dockerfile, any container host works.
