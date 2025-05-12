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

    const questionMatch = block.match(/^(.*?)(?=\n[A-F]\.)/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    // Extract choices dynamically
    const choiceRegex = /([A-F])\.\s*([\s\S]*?)(?=\n[A-F]\.|Rationale:|Item ID:|\n{2,}|$)/g;
    let match;
    const choices = new Array(6).fill('');
    while ((match = choiceRegex.exec(block)) !== null) {
      const index = 'ABCDEF'.indexOf(match[1]);
      if (index !== -1) {
        choices[index] = match[2].trim();
      }
    }

    // Extract correct answer by checkmark
    const correctMatch = block.match(/✓\s*([A-F])\./);
    const correctIndex = correctMatch ? 'ABCDEF'.indexOf(correctMatch[1].toUpperCase()) : -1;
    const correctAnswer = correctIndex !== -1 && choices[correctIndex] ? choices[correctIndex] : '';

    const rationaleMatch = block.match(/Rationale:\s*(.+?)(?=\n{2,}|Item ID:|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

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
      choices: choices.filter(c => c !== ''),
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
