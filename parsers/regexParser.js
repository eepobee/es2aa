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

    const choicesMatch = block.match(/A\.\s*(.*?)\nB\.\s*(.*?)\nC\.\s*(.*?)\nD\.\s*(.*?)(?=\n|$)/s);
    const choices = choicesMatch ? [choicesMatch[1], choicesMatch[2], choicesMatch[3], choicesMatch[4]] : [];

    // More robust correct answer match
    let correctAnswer = '';
    const correctMarkMatch = block.match(/✓\s*([ABCD])\.\s*(.*)/i);
    if (correctMarkMatch) {
      const correctLetter = correctMarkMatch[1].toUpperCase();
      const correctText = correctMarkMatch[2].trim();
      const correctIndex = 'ABCD'.indexOf(correctLetter);
      if (correctIndex !== -1) {
        choices[correctIndex] = correctText;  // overwrite if necessary
        correctAnswer = correctText;
      }
    }

    const rationaleMatch = block.match(/Rationale:\s*(.+?)(?=\n{2,}|Item ID:|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

    const catSectionMatch = block.match(/Category Name\s+Category Path\n([\s\S]+?)\n\n/);
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
      "Tag: Bloom's": bloom,
      "Tag: Topics": topics,
      "Tag: Level": level,
      "Course Number": courseNumber
    });
  }

  return questions;
}

module.exports = parseQuestionsFromPDF;
