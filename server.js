require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const parseQuestionsFromPDF = require('./parsers/regexParser');
const csvWriter = require('fast-csv');
const parseXLSXMetadata = require('./parsers/xlsxParser');

const app = express();
const upload = multer({ dest: 'uploads/' });

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

    let fallbackCourse = '';
    let fallbackLevel = '';
    for (const meta of Object.values(metadataMap)) {
      if (meta.course && meta.level) {
        fallbackCourse = meta.course;
        fallbackLevel = meta.level;
        break;
      }
    }

    const MAX_TOPICS = 5;

    const rawRows = questions
      .filter(q => {
        const meta = metadataMap[q.id];
        return meta && meta.type === 'Multiple Choice';
      })
      .map(q => {
        const meta = metadataMap[q.id];
        const level = meta.level || fallbackLevel;
        const course = meta.course || fallbackCourse;
        const prefix = level === 'Undergraduate' ? 'U' : level === 'Graduate' ? 'G' : '';

        const row = {
          'Question ID': q.id ? prefix + q.id : '',
          Title: q.id || '',
          'Question Text': q.question || '',
          'Correct Answer': q.correctAnswer || '',
          'Question Type': meta.type || '',
          "Tag: Bloom's": meta.bloom || '',
          'Tag: Level': level,
          'Tag: NCLEX': meta.nclex || '',
          'Tag: Course #': course,
          'Correct Feedback': meta.feedback || ''
        };

        const topicList = (meta.topics || '')
          .split(/[,;]/)
          .map(t => t.trim())
          .filter(Boolean);

        for (let i = 0; i < MAX_TOPICS; i++) {
          row[`Tag: Topic_${i + 1}`] = topicList[i] || '';
        }

        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
        labels.forEach((label, i) => {
          row[`Option ${label}`] = q.choices?.[i] || '';
        });

        return row;
      });

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

    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');

    const originalHeaders = Object.keys(csvRows[0] || []);
const headers = [];
const seen = new Set();

originalHeaders.forEach(key => {
  if (key.toLowerCase().startsWith('tag: topic')) {
    let colName = 'Tag: Topic';
    let suffix = 1;
    while (seen.has(colName)) {
      suffix++;
      colName = `Tag: Topic ${suffix}`;
    }
    seen.add(colName);
    headers.push(colName);
  } else {
    headers.push(key);
  }
});

    const csvStream = csvWriter.format({ headers });
    csvStream.pipe(res);

   csvRows.forEach(row => {
  const renamedRow = {};
  let topicIndex = 1;
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().startsWith('tag: topic')) {
      renamedRow[`Tag: Topic ${topicIndex}`] = row[key];
      topicIndex++;
    } else {
      renamedRow[key] = row[key];
    }
  }
  csvStream.write(renamedRow);
});

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
