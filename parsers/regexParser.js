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

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];

    // === DEBUG: Show first 5 blocks for troubleshooting ===
    if (i < 5) {
      console.log(`\n===== RAW BLOCK ${i + 1} =====\n`);
      console.log(block);
    }

    const idMatch = block.match(/Item ID:\s*(\d+)/);
    const id = idMatch ? idMatch[1] : '';

    const courseMatch = block.match(/NU\s*\d{3}/);
    const courseNumber = courseMatch ? courseMatch[0] : '';
    const level = getLevelFromCourse(courseNumber);

    const questionMatch = block.match(/^(.*?)(?=\n(?:[✓]?\s*[A-F]\.))/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    const choiceRegex = /(?:^|\n)\s*(\d)?\s*([A-F])\.\s*(.*?)(?=(?:\n\s*\d?\s*[A-F]\.|$))/gs;
    const choices = [];
    let match;
    let correctIndex = -1;

    while ((match = choiceRegex.exec(block)) !== null) {
      const isCorrect = !!match[1]; // "3B." style — if there's a number, it's the correct one
      const letter = match[2];
      const text = match[3].trim();
      const index = 'ABCDEF'.indexOf(letter);

      choices[index] = text;
      if (isCorrect) correctIndex = index;
    }

    const correctAnswer = correctIndex !== -1 && correctIndex < choices.length ? choices[correctIndex] : '';

    // === DEBUG ===
    if (i < 5) {
      console.log(`Choices:`, choices);
      console.log(`Correct Index:`, correctIndex);
      console.log(`Correct Answer:`, correctAnswer);
    }

    const rationaleMatch = block.match(/Rationale:\s*(.+?)(?=\n{2,}|Item ID:|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

    const catSectionMatch = block.match(/Category Name[\s\S]*?\n([\s\S]*?)\nItem Creator:/);
    const catLines = catSectionMatch ? catSectionMatch[1].split('\n').map(l => l.trim()) : [];

    const bloomLine = catLines.find(line => /^\d{2}\s*-/.test(line));
    const bloom = bloomLine || '';

    const topics = catLines
  .filter(line =>
    line &&
    !/Import(ed|s)/i.test(line) &&
    !/^\d{2}\s*-/.test(line) &&
    !/Topical Categories by Course/i.test(line)
  )
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
