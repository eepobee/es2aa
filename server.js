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
const parseXLSXMetadata = require('./parsers/xlsxParser');

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
      metadataMap = await parseXLSXMetadata(xlsxPath);
    }

    // Fallback course/level
    let fallbackCourse = '';
    let fallbackLevel = '';
    for (const meta of Object.values(metadataMap)) {
      if (meta.course && meta.level) {
        fallbackCourse = meta.course;
        fallbackLevel = meta.level;
        break;
      }
    }

    // === Build rows ===
    let csvRows = questions.map(q => {
      const meta = metadataMap[q.id] || {};
      const level = meta.level || fallbackLevel;
      const course = meta.course || fallbackCourse;
      const prefix = level === 'Undergraduate' ? 'U' : level === 'Graduate' ? 'G' : '';

      const row = {
        'Question ID': q.id ? prefix + q.id : '',
        Title: q.id || '',
        'Question Text': q.question || '',
        'Correct Answer': q.correctAnswer || '',
        'Question Type': (meta.type || '').toLowerCase() === 'mchoice' ? 'multiple choice' : (meta.type || ''),
        'Tag: Topics': meta.topics || '',
        "Tag: Bloom's": meta.bloom || '',
        'Tag: Level': level,
        'Tag: NCLEX': meta.nclex || '',
        'Tag: Course #': course,
        'Correct Feedback': meta.feedback || ''
      };

      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      labels.forEach((label, i) => {
        row[`Option ${label}`] = q.choices?.[i] || '';
      });

      return row;
    });

    // === Expand unique Tag: Topics into separate columns ===
    // === Expand unique Tag: Topics into individual "Tag: Topic" columns ===
const uniqueTopics = new Set();

csvRows.forEach(row => {
  (row['Tag: Topics'] || '')
    .split(/[,;]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .forEach(topic => uniqueTopics.add(topic));
});

const topicList = Array.from(uniqueTopics).sort();

csvRows = csvRows.map(row => {
  const topics = row['Tag: Topic'] || [];
  delete row['Tag: Topic'];
  topics.forEach(topic => {
    row['Tag: Topic'] = row['Tag: Topic'] || [];
    row['Tag: Topic'].push(topic);
  });
  return row;
});

    // === Send CSV ===
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
