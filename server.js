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

    // Fallback level/course
    let fallbackCourse = '';
    let fallbackLevel = '';
    for (const meta of Object.values(metadataMap)) {
      if (meta.course && meta.level) {
        fallbackCourse = meta.course;
        fallbackLevel = meta.level;
        break;
      }
    }

    // STEP 1: Build rows with metadata
    const csvRows = questions.map(q => {
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
        'Correct Feedback': meta.feedback || '',
        _topics: (meta.topics || '')
          .split(/[,;]+/)
          .map(t => t.trim())
          .filter(Boolean)
      };

      ['A', 'B', 'C', 'D', 'E', 'F'].forEach((label, i) => {
        row[`Option ${label}`] = q.choices?.[i] || '';
      });

      return row;
    });

    // STEP 2: Get all unique topics
    const uniqueTopics = Array.from(
      new Set(csvRows.flatMap(row => row._topics))
    ).sort();

    // STEP 3: Write headers
    const staticHeaders = [
      'Question ID', 'Title', 'Question Text', 'Correct Answer', 'Question Type',
      "Tag: Bloom's", 'Tag: Level', 'Tag: NCLEX', 'Tag: Course #', 'Correct Feedback',
      'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F'
    ];

    const topicHeaders = uniqueTopics.map(() => 'Tag: Topic');
    const allHeaders = [...staticHeaders, ...topicHeaders];

    // STEP 4: Output CSV
    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');

    const csvStream = csvWriter.format({ headers: allHeaders });
    csvStream.pipe(res);

    csvRows.forEach(row => {
      const outRow = {};

      // Add all static fields
      staticHeaders.forEach(h => {
        outRow[h] = row[h] || '';
      });

      // Add each topic in its own "Tag: Topic" column
      uniqueTopics.forEach((topic, i) => {
        const header = topicHeaders[i];
        const match = row._topics.includes(topic);
        outRow[header] = match ? topic : '';
      });

      csvStream.write(outRow);
    });

    csvStream.end();

    // Cleanup
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
