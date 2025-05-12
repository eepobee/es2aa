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

app.use('/tools/es2aa', express.static(path.join(__dirname, 'public')));

app.post('/tools/es2aa/uploads', upload.single('pdf'), async (req, res) => {
  try {
    console.log('Received file:', req.file); // Debug: log uploaded file

    const pdfBuffer = fs.readFileSync(req.file.path);
    const questions = await parseQuestionsFromPDF(pdfBuffer);

    console.log('Parsed questions:', questions); // Debug: log parsed output

    const csvRows = questions.map(q => {
      const row = {
        Title: q.id || '',
        'Question Text': q.question || '',
        'Correct Answer': q.correctAnswer || '',
        'Tag: Topics': q.topics || '',
        "Tag: Bloom's": q.bloom || '',
        'Tag: Level': q.level || '',
        'Tag: Course #': q.courseNumber || '',
        Feedback: q.rationale || ''
      };
    
      // Add dynamic choices (A–F)
      const choiceLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
      choiceLabels.forEach((label, index) => {
        row[`Choice ${label}`] = q.choices?.[index] || '';
      });
    
      return row;
    }); 

    res.setHeader('Content-disposition', 'attachment; filename=es2aa_output.csv');
    res.setHeader('Content-Type', 'text/csv');

    const csvStream = csvWriter.format({ headers: true });
    csvStream.pipe(res);
    csvRows.forEach(row => csvStream.write(row));
    csvStream.end();

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('Error processing PDF upload:', err);
    res.status(500).send('Failed to process PDF.');
  }
});

app.get('/tools/es2aa/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Server running on port 3000'));
