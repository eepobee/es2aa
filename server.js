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

    // Get fallback level and course
    let fallbackCourse = '';
    let fallbackLevel = '';
    for (const meta of Object.values(metadataMap)) {
      if (meta.course && meta.level) {
        fallbackCourse = meta.course;
        fallbackLevel = meta.level;
        break;
      }
    }

    // === STEP 1: Build rows with base structure ===
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
        "Tag: Bloom's": meta.bloom || '',
        'Tag: Level': level,
        'Tag: NCLEX': meta.nclex || '',
        'Tag: Course #': course,
        'Correct Feedback': meta.feedback || ''
      };

      ['A', 'B', 'C', 'D', 'E', 'F'].forEach((label, i) => {
        row[`Option ${label}`] = q.choices?.[i] || '';
      });

      // Store list of topics temporarily
      row._topics = (meta.topics || '')
        .split(/[,;]+/)
        .map(t => t.trim())
        .filter(Boolean);

      return row;
    });

    // === STEP 2: Extract all unique topics ===
    const uniqueTopics = Array.from(new Set(
      csvRows.flatMap(row => row._topics)
    )).sort();

    // === STEP 3: Insert 1 column per topic (same label) ===
    csvRows.forEach(row => {
      uniqueTopics.forEach(topic => {
        row['Tag: Topic'] ??= [];
        row['Tag: Topic'].push(row._topics.includes(topic) ? topic : '');
      });
      delete row._topics;
    });

    // === STEP 4: Stream CSV with repeated "Tag: Topic" headers ===
    const staticHeaders = [
      'Question ID', 'Title', 'Question Text', 'Correct Answer', 'Question Type',
      "Tag: Bloom's", 'Tag: Level', 'Tag: NCLEX', 'Tag: Course #', 'Correct Feedback',
      'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F'
    ];

    const topicHeaders = uniqueTopics.map(() => 'Tag: Topic');
    const allHeaders = [...staticHeaders, ...topicHeaders];

    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');

    const csvStream = csvWriter.format({ headers: allHeaders });
    csvStream.pipe(res);

    csvRows.forEach(row => {
      const flattened = { ...row };
      const topicValues = flattened['Tag: Topic'] || [];

      // Remove the array-based column
      delete flattened['Tag: Topic'];

      // Add each column value explicitly
      topicValues.forEach((value, i) => {
        flattened[`Tag: Topic ${i}`] = value;
      });

      // Rename keys back to 'Tag: Topic' for identical column labels
      const reordered = {};
      allHeaders.forEach(h => {
        if (h === 'Tag: Topic') {
          const topicValue = topicValues.shift();
          reordered[h] = topicValue || '';
        } else {
          reordered[h] = flattened[h] || '';
        }
      });

      csvStream.write(reordered);
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
