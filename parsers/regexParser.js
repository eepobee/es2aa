// File: parsers/regexParser.js

const pdfParse = require('pdf-parse');

function getLevelFromCourse(course) {
  const match = course.match(/NU\s*(\d{3})/);
  if (!match) return '';
  const num = parseInt(match[1], 10);
  if (num >= 100 && num <= 399) return 'Undergraduate';
  if (num >= 500 && num <= 899) return 'Graduate';
  return '';
}

async function parseQuestionsFromPDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const questions = [];

  const rawBlocks = text.split(/Question #:\s*\d+/).filter(q => q.trim().length > 20);

  for (const block of rawBlocks) {
    const idMatch = block.match(/Item ID:\s*(\d+)/);
    const id = idMatch ? idMatch[1] : '';

    const courseMatch = block.match(/NU\s*\d{3}/);
    const courseNumber = courseMatch ? courseMatch[0] : '';
    const level = getLevelFromCourse(courseNumber);

    // Extract question text before first labeled choice
    const questionMatch = block.match(/^(.*?)(?=\n[✓✔]?\s*[A-F]\.)/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    // Extract choices and identify the correct one
    const choices = {};
    const choicePattern = /^(?:✓\s*)?([A-F])\.\s*(.+?)(?=\n(?:✓?\s*[A-F]\.|Item ID:|Rationale:|$))/gms;
    let match;
    let correctLetter = null;

    while ((match = choicePattern.exec(block)) !== null) {
      const letter = match[1];
      const text = match[2].trim();
      choices[letter] = text;
      if (/^✓/.test(match[0])) {
        correctLetter = letter;
      }
    }

    const allChoices = ['A', 'B', 'C', 'D', 'E', 'F'].map(label => choices[label] || '');
    const correctAnswer = correctLetter ? choices[correctLetter] || '' : '';

    // Extract rationale
    const rationaleMatch = block.match(/Rationale:\s*(.+?)(?=\n{2,}|Item ID:|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

    // Extract category data
    const catSectionMatch = block.match(/Category Name[\s\S]*?\n([\s\S]*?)\nItem Creator:/);
    const catLines = catSectionMatch ? catSectionMatch[1].split('\n').map(l => l.trim()) : [];

    const bloomLine = catLines.find(line => /^\d{2}\s*-/.test(line));
    const bloom = bloomLine || '';

    const topics = catLines
      .filter(line => line && !/^Imported_/i.test(line) && !/^\d{2}\s*-/.test(line))
      .join('; ');

    questions.push({
      id,
      question,
      choices: allChoices,
      correctAnswer,
      rationale,
      bloom,
      topics,
      courseNumber,
      level
    });
  }

  return questions;
}

module.exports = parseQuestionsFromPDF;
