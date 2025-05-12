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

    const questionMatch = block.match(/^(.*?)(?=\nA\.)/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    // Dynamically extract choices A–F
    const choiceLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    const choices = [];

    for (let i = 0; i < choiceLabels.length; i++) {
      const label = choiceLabels[i];
      const nextLabel = choiceLabels[i + 1];
      const regex = new RegExp(`${label}\\.\\s*([\\s\\S]*?)\\s*(?=${nextLabel ? nextLabel + '\\.' : '\\n{2,}|$'})`, 'i');
      const match = block.match(regex);
      if (match) {
        choices.push(match[1].trim());
      } else {
        break;
      }
    }

    // Identify correct answer from ✓ or other symbol in front of label
    const correctMatch = block.match(/[^a-zA-Z0-9\s]?\s*([A-F])\./);
    const correctIndex = correctMatch ? choiceLabels.indexOf(correctMatch[1].toUpperCase()) : -1;
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
      choices,
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
