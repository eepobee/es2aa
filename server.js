// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const parseQuestionsFromPDF = require('./parsers/regexParser');
const csvWriter = require('fast-csv');
const app = express();
const upload = multer({ dest: 'uploads/' });
const parseXLSXMetadata = require('./parsers/xlsxParser'); // <- New module

app.use('/tools/es2aa', express.static(path.join(__dirname, 'public')));

app.post('/tools/es2aa/uploads', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'xlsx', maxCount: 1 }
]), async (req, res) => {
  try {
    const pdfPath = req.files?.pdf?.[0]?.path;
    const xlsxPath = req.files?.xlsx?.[0]?.path;

    const pdfBuffer = fs.readFileSync(pdfPath);
    const questions = await parseQuestionsFromPDF(pdfBuffer);

    let metadataMap = {};
    if (xlsxPath) {
      metadataMap = await parseXLSXMetadata(xlsxPath); // returns object by ID
    }

    const csvRows = questions.map(q => {
      const meta = metadataMap[q.id] || {};
      const correctIndex = q.choices.findIndex(c => c === q.correctAnswer);
      const correctLetter = correctIndex !== -1 ? 'ABCDEF'[correctIndex] : '';

      const row = {
     'Question ID': q.id
    ? (meta.level === 'Undergraduate' ? 'U' : meta.level === 'Graduate' ? 'G' : '') + q.id
    : '',
        Title: q.id || '',
   'Question Text': q.question || '',
  'Correct Answer': q.correctAnswer || '',
  'Question Type': (meta.type || '').toLowerCase() === 'mchoice' ? 'multiple choice' : (meta.type || ''),
  'Tag: Topics': meta.topics || '',
  "Tag: Bloom's": meta.bloom || '',
  'Tag: Level': meta.level || '',
  'Tag: NCLEX': meta.nclex || '',
  'Tag: Course #': meta.course || '',
  'Correct Feedback': meta.feedback || ''
};

const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
labels.forEach((label, i) => {
  row[`Option ${label}`] = q.choices?.[i] || '';
});

      return row;
    });

    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');
    const csvStream = csvWriter.format({ headers: true });
    csvStream.pipe(res);
    csvRows.forEach(row => csvStream.write(row));
    csvStream.end();

    fs.unlinkSync(pdfPath);
    if (xlsxPath) fs.unlinkSync(xlsxPath);
  } catch (err) {
    console.error('Error processing upload:', err);
    res.status(500).send('Failed to process input.');
  }
});

app.get('/tools/es2aa/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Server running on port 3000'));
