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

  // Normalize page-break newlines but preserve real answer lines (A., B., ✓C., etc.)
  const text = data.text.replace(/\r?\n(?=[^\nA-F✓\d])/g, ' ');

  const questions = [];

  // Extract only question blocks (Question #: <n> up to first choice like A./✓B./3C.)
  const rawBlocks = [];
  const questionBlockRegex = /Question #:\s*\d+\s*\n([\s\S]*?)(?=\n\s*\d?\s*[✓]?\s*[A-F]\.)/g;
  let match;
  while ((match = questionBlockRegex.exec(text)) !== null) {
    const block = match[1].trim();
    if (block.length > 20) {
      rawBlocks.push(block);
    }
  }

  for (let i = 0; i < rawBlocks.length; i++) {
    let block = rawBlocks[i];

    // === DEBUG: Show first 5 blocks before cleanup ===
    if (i < 5) {
      console.log(`\n===== RAW BLOCK ${i + 1} =====\n`);
      console.log(block);
    }

    // Remove everything between "Item Psychometrics:" and the next "Question #:"
    const cleanedBlock = block.replace(/Item Psychometrics:[\s\S]*?(?=Question #:|$)/gi, '');

    const idMatch = cleanedBlock.match(/Item ID:\s*(\d+)/);
    const id = idMatch ? idMatch[1] : '';

    const courseMatch = cleanedBlock.match(/NU\s*\d{3}/);
    const courseNumber = courseMatch ? courseMatch[0] : '';
    const level = getLevelFromCourse(courseNumber);

    // We already extracted only the question text; just use the whole cleanedBlock
    const question = cleanedBlock.trim();

    const choiceRegex = /(?:^|\n)\s*(\d)?\s*([A-F])\.\s*(.*?)(?=(?:\n\s*\d?\s*[A-F]\.|$))/gs;
    const choices = [];
    let matchChoice;
    let correctIndex = -1;

    while ((matchChoice = choiceRegex.exec(cleanedBlock)) !== null) {
      const isCorrect = !!matchChoice[1]; // "3B." style — if there's a number, it's the correct one
      const letter = matchChoice[2];
      const text = matchChoice[3].trim();
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

    const rationaleMatch = cleanedBlock.match(/Rationale:\s*(.+?)(?=\n{2,}|Item ID:|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

    const catSectionMatch = cleanedBlock.match(/Category Name[\s\S]*?\n([\s\S]*?)\nItem Creator:/);
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
