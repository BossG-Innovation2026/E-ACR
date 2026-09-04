const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const config = require('../config/fields.json');
const OUT = path.join(__dirname, '..', 'templates', 'report-template.docx');

function buildChildren() {
  const children = [
    new Paragraph({
      text: config.report.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '', spacer: {}, children: [] }),
  ];

  for (const field of config.fields) {
    children.push(
      new Paragraph({
        text: `${field.label}:`,
        heading: HeadingLevel.HEADING_3,
      })
    );
    if (field.type === 'textarea') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `{${field.name}}` })],
        })
      );
      children.push(new Paragraph({ children: [] }));
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `{${field.name}}` })],
        })
      );
    }
  }

  if (config.report.includeSignature) {
    children.push(new Paragraph({ children: [] }));
    children.push(
      new Paragraph({
        text: `${config.report.signatureLabel}: ______________________________`,
      })
    );
    children.push(new Paragraph({ text: 'Date: ______________________________' }));
  }

  return children;
}

async function main() {
  const doc = new Document({
    sections: [{ children: buildChildren() }],
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log(`Template written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
