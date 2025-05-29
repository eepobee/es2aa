// File: server.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csvWriter = require('fast-csv');
const parseQuestionsFromTxtWithCSV = require('./parsers/txtWithCSVParser');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true })); // <-- Needed to read form fields like campus
app.use('/tools/es2aa', express.static(path.join(__dirname, 'public')));

app.post('/tools/es2aa/uploads', upload.fields([
  { name: 'txt', maxCount: 1 },
  { name: 'csv', maxCount: 1 }
]), async (req, res) => {
  try {
    const txtPath = req.files?.txt?.[0]?.path;
    const csvPath = req.files?.csv?.[0]?.path;
    const selectedCampus = req.body.campus;

    const txtBuffer = fs.readFileSync(txtPath);
    const questions = await parseQuestionsFromTxtWithCSV(txtBuffer, csvPath);

    const MAX_TOPICS = 5;

    const rawRows = questions.map(q => {
      const row = {
        'Question ID': q.id || '',
        Title: q.title || '',
        'Question Text': q.question || '',
        'Correct Answer': q.correctAnswer || '',
        'Question Type': 'Multiple Choice',
        Template: q.correctAnswer?.includes(';') ? 'multiple response' : 'standard',
        "Tag: Bloom's": q.bloom || '',
        'Tag: Level': q.level || '',
        'Tag: NCLEX': q.nclex || '',
        'Tag: Course #': q.course || '',
        'Tag: Campus': selectedCampus || '',
        'Correct Feedback': q.rationale || ''
      };

      const topicList = Array.from(new Set(
        (q.topics || '').split(/[,;]/).map(t => t.trim()).filter(Boolean)
      ));

      for (let i = 0; i < MAX_TOPICS; i++) {
        row[`Tag: Topic_${i + 1}`] = topicList[i] || '';
      }

      const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
      labels.forEach((label, i) => {
        row[`Option ${label}`] = q.choices?.[i] || '';
      });

      return row;
    });

    // Identify which topic columns are actually used
    const usedTopicCols = new Set();
    rawRows.forEach(row => {
      for (let i = 1; i <= MAX_TOPICS; i++) {
        const key = `Tag: Topic_${i}`;
        if (row[key]) usedTopicCols.add(key);
      }
    });

    const csvRows = rawRows.map(row => {
      const newRow = {};
      for (const key in row) {
        if (!key.startsWith('Tag: Topic') || usedTopicCols.has(key)) {
          newRow[key] = row[key];
        }
      }
      return newRow;
    });

    const firstRow = csvRows[0] || {};
    const originalHeaders = Object.keys(firstRow);
    const topicHeaders = originalHeaders.filter(h => h.startsWith('Tag: Topic_'));
    const nonTopicHeaders = originalHeaders.filter(h => !h.startsWith('Tag: Topic_'));
    const headers = [...nonTopicHeaders, ...topicHeaders];

    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');

    const csvStream = csvWriter.format({ headers });
    csvStream.pipe(res);

    csvRows.forEach(row => csvStream.write(row));
    csvStream.end();

    fs.unlinkSync(txtPath);
    fs.unlinkSync(csvPath);
  } catch (err) {
    console.error('Error processing upload:', err);
    res.status(500).send('Failed to process input.');
  }
});

app.get('/tools/es2aa/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
