import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function createDoc() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText('This is a test resume.\nJoão Vitor\nNode.js\nReact');
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test_real.pdf', pdfBytes);
}
createDoc();
