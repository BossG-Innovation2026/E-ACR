const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { generateDocx, generatePdf } = require('./lib/generate');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.join(__dirname, 'config', 'fields.json');
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'report-template.docx');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

app.post('/api/config', (req, res) => {
  const body = req.body;
  if (!body || !Array.isArray(body.fields) || !body.report) {
    return res.status(400).json({ ok: false, error: 'Expected { report, fields: [...] }' });
  }
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  const values = req.body || {};
  const format = req.query.format || 'docx';

  if (!['docx', 'pdf'].includes(format)) {
    return res.status(400).send('Unsupported format');
  }

  try {
    const docx = generateDocx(values);
    const pdf = await generatePdf(values);
    const id = await store.save(values, docx, pdf);

    const fileName = req.query.filename || 'accomplishment-report';
    if (format === 'docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
      return res.send(docx);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    res.json(await store.list());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await store.get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json({ id: report.id, createdAt: report.createdAt, form_values: report.form_values });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:id/download', async (req, res) => {
  try {
    const report = await store.get(req.params.id);
    if (!report) return res.status(404).send('Not found');
    const format = req.query.format || 'docx';
    const buffer = format === 'pdf' ? report.pdf : report.docx;
    if (!buffer) return res.status(404).send('File not available');
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.pdf"`);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.docx"`);
    }
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({ dest: path.join(__dirname, 'uploads') });
app.post('/api/template', upload.single('template'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  fs.mkdirSync(path.dirname(TEMPLATE_PATH), { recursive: true });
  fs.copyFileSync(req.file.path, TEMPLATE_PATH);
  fs.unlink(req.file.path, () => {});
  res.json({ ok: true, message: 'Template updated' });
});

app.get('/api/template', (req, res) => {
  if (fs.existsSync(TEMPLATE_PATH)) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="report-template.docx"');
    return res.send(fs.readFileSync(TEMPLATE_PATH));
  }
  res.status(404).send('No template');
});

(async () => {
  try {
    await store.init();
    console.log('Storage ready:', process.env.DATABASE_URL ? 'Postgres' : 'local file store');
  } catch (err) {
    console.warn('DB init failed, using local file store:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Accomplishment Report app running at http://localhost:${PORT}`);
  });
})();
