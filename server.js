// File: server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parsePdfToJson } = require('./parsers/regexParser');
const csvWriter = require('fast-csv');
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use('/tools/es2aa', express.static(path.join(__dirname, 'public')));

app.post('/tools/es2aa/upload', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBuffer = fs.readFileSync(req.file.path);
    const questions = await parsePdfToJson(pdfBuffer);

    const csvRows = questions.map(q => ({
      Title: q.Title || '',
      'Question Text': q.Question || '',
      'Choice A': q.OptionA || '',
      'Choice B': q.OptionB || '',
      'Choice C': q.OptionC || '',
      'Choice D': q.OptionD || '',
      'Correct Answer': q.Correct || '',
      Topics: q.Topic || '',
      "Bloom's Taxonomy": q.Bloom || '',
      'Tag: Level': q.Level || '',
      Feedback: q.Feedback || ''
    }));

    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');

    const csvStream = csvWriter.format({ headers: true });
    csvStream.pipe(res);
    csvRows.forEach(row => csvStream.write(row));
    csvStream.end();

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to process PDF.');
  }
});

app.get('/tools/es2aa/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Server running on port 3000'));
