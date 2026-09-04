const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { generateDocx, generatePdf } = require('./lib/generate');

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

  try {
    if (['docx', 'pdf'].includes(format)) {
      if (format === 'docx') {
        const buffer = generateDocx(values);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${req.query.filename || 'accomplishment-report'}.docx"`);
        return res.send(buffer);
      }
      if (format === 'pdf') {
        const buffer = await generatePdf(values);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${req.query.filename || 'accomplishment-report'}.pdf"`);
        return res.send(buffer);
      }
    }
    res.status(400).send('Unsupported format');
  } catch (err) {
    console.error(err);
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

app.listen(PORT, () => {
  console.log(`Accomplishment Report app running at http://localhost:${PORT}`);
});
