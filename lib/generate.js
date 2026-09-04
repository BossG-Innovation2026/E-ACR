const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const pdfmake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');

const config = require('../config/fields.json');

pdfmake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'report-template.docx');

function generateDocx(values) {
  if (!values || typeof values !== 'object') {
    throw new Error('Valid values object is required to generate a report');
  }

  let content = fs.readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  const resolved = {};
  for (const field of config.fields) {
    resolved[field.name] = values[field.name] == null ? '' : String(values[field.name]);
  }

  doc.render(resolved);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function generatePdf(values) {
  if (!values || typeof values !== 'object') {
    throw new Error('Valid values object is required to generate a report');
  }

  const content = [];
  content.push({
    text: config.report.title,
    style: 'title',
    alignment: 'center',
  });
  content.push({ text: '', margin: [0, 0, 0, 10] });

  for (const field of config.fields) {
    content.push({
      text: field.label,
      style: 'label',
      margin: [0, 8, 0, 2],
    });
    content.push({
      text: values[field.name] == null ? '' : String(values[field.name]),
      style: 'body',
    });
  }

  if (config.report.includeSignature) {
    content.push({ text: '', margin: [0, 20, 0, 0] });
    content.push({
      text: `${config.report.signatureLabel}: ______________________________`,
      margin: [0, 0, 0, 4],
    });
    content.push({ text: 'Date: ______________________________' });
  }

  const docDefinition = {
    styles: {
      title: { fontSize: 18, bold: true },
      label: { fontSize: 11, bold: true },
      body: { fontSize: 11 },
    },
    content,
  };

  return new Promise((resolve, reject) => {
    const pdf = pdfmake.createPdf(docDefinition);
    try {
      pdf.getBuffer((buffer) => {
        if (!buffer || !buffer.length) return reject(new Error('No PDF data generated'));
        resolve(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateDocx, generatePdf };
