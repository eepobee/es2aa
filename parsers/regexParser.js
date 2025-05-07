// File: parsers/regexParser.js

const pdfParse = require('pdf-parse');

function getLevelFromCourse(course) {
  const match = course.match(/NU\s*(\d{3})/i);
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

    const courseMatch = block.match(/NU\s*(\d{3})/);
    const courseNumber = courseMatch ? `NU ${courseMatch[1]}` : '';
    const level = getLevelFromCourse(courseNumber);

    const questionMatch = block.match(/^(.*?)(?=\n[ABCD]\.)/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    const choicesMatch = block.match(/A\.\s*(.*?)\nB\.\s*(.*?)\nC\.\s*(.*?)\nD\.\s*(.*?)(?=\n|$)/s);
    const choices = choicesMatch ? [choicesMatch[1], choicesMatch[2], choicesMatch[3], choicesMatch[4]] : [];

    const correctMatch = block.match(/✓\s*([ABCD])\./i);
    const correctIndex = correctMatch ? 'ABCD'.indexOf(correctMatch[1].toUpperCase()) : -1;
    const correctAnswer = correctIndex !== -1 && choices.length === 4 ? choices[correctIndex] : '';

    const rationaleMatch = block.match(/Rationale:\s*(.+?)(?:\n{2,}|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

    // Extract the Category Name section
    const catSectionMatch = block.match(/Category Name\s+Category Path\n([\s\S]+?)\n\n/);
    const catLines = catSectionMatch ? catSectionMatch[1].split('\n').map(line => line.trim()) : [];

    const bloomMatch = catLines.find(line => /^\d{2}\s*-/.test(line));
    const bloom = bloomMatch || '';

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
