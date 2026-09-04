const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { generateDocx, generatePdf } = require('./lib/generate');
const store = require('./lib/store');
const supabase = require('./lib/supabase');

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

function isSupabaseEnabled() {
  return supabase.enabled;
}

async function requireAuth(req, res, next) {
  if (!isSupabaseEnabled()) return next();
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await supabase.verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

app.get('/health', (req, res) => {
  res.json({ ok: true, mode: isSupabaseEnabled() ? 'supabase' : 'local', time: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

app.get('/config/supabase', (req, res) => {
  if (!isSupabaseEnabled()) return res.status(404).json({ error: 'Supabase not configured' });
  res.json({ url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_PUBLISHABLE_KEY });
});

app.post('/api/config', requireAuth, (req, res) => {
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

app.post('/api/generate', requireAuth, async (req, res) => {
  const values = req.body || {};
  const format = req.query.format || 'docx';
  if (!['docx', 'pdf'].includes(format)) return res.status(400).send('Unsupported format');

  try {
    const docx = generateDocx(values);
    const pdf = await generatePdf(values);
    const id = require('crypto').randomUUID();
    const fileName = req.query.filename || 'accomplishment-report';

    if (isSupabaseEnabled()) {
      const userId = req.user.id;
      const docxPath = await supabase.uploadFile(userId, id, 'docx', docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const pdfPath = await supabase.uploadFile(userId, id, 'pdf', pdf, 'application/pdf');
      await supabase.saveReport(userId, id, values, docxPath, pdfPath);
    } else {
      await store.save(values, docx, pdf);
    }

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

app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      return res.json(await supabase.listReports(req.user.id));
    }
    res.json(await store.list());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const report = await supabase.getReport(req.user.id, req.params.id);
      if (!report) return res.status(404).json({ error: 'Not found' });
      return res.json({ id: report.id, createdAt: report.createdAt, form_values: report.form_values });
    }
    const report = await store.get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json({ id: report.id, createdAt: report.createdAt, form_values: report.form_values });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:id/download', requireAuth, async (req, res) => {
  try {
    const format = req.query.format || 'docx';
    let buffer = null;
    if (isSupabaseEnabled()) {
      const report = await supabase.getReport(req.user.id, req.params.id);
      if (!report) return res.status(404).send('Not found');
      buffer = format === 'pdf' ? report.pdf : report.docx;
    } else {
      const report = await store.get(req.params.id);
      if (!report) return res.status(404).send('Not found');
      buffer = format === 'pdf' ? report.pdf : report.docx;
    }
    if (!buffer) return res.status(404).send('File not available');
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.pdf"`);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.docx"`);
    }
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({ dest: path.join(__dirname, 'uploads') });
app.post('/api/template', requireAuth, upload.single('template'), (req, res) => {
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
  } catch (err) {
    console.warn('Local store init failed:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Accomplishment Report app running at http://localhost:${PORT} [mode: ${isSupabaseEnabled() ? 'supabase' : 'local'}]`);
  });
})();
