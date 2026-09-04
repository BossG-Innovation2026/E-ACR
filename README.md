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

## Configuration

- `config/fields.json` — report title, file name, signature, and form fields (label, name/placeholder token, type, required).
- `templates/report-template.docx` — the Word blueprint; placeholders like `{fullName}` are replaced on generation.
- Admin page edits fields and lets you upload a template.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/config` | Returns current form/config JSON |
| POST | `/api/config` | Saves form/config JSON |
| POST | `/api/generate?format=docx\|pdf` | Generate report from submitted values |
| GET | `/api/template` | Download current template |
| POST | `/api/template` | Upload a new `.docx` template |
