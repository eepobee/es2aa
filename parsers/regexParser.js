// File: parsers/regexParser.js

const pdfParse = require('pdf-parse');

async function parseQuestionsFromPDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const questions = [];

  const rawBlocks = text.split(/Question #:\s*\d+/).filter(q => q.trim().length > 20);

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];

    if (i < 12) {
      console.log(`\n===== RAW BLOCK ${i + 1} =====\n`);
      console.log(block);
    }

    const cleanedBlock = block.replace(/Item Psychometrics:[\s\S]*?(?=Question #:|$)/gi, '');

    // === Extract question text up until first A. or ✓A.
    const questionMatch = cleanedBlock.match(/^(.*?)(?=\n(?:\d?\s*[\u2713]?\s*[A-F]\.|$))/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    // === Extract answer options ===
    const choiceRegex = /(?:^|\n)\s*(\d)?\s*([A-F])\.\s*(.*?)(?=(?:\n\s*\d?\s*[A-F]\.|Rationale:|Item ID:|Item Description:|Item Categories:|Item Creator:|$))/gs;
    const choices = [];
    let match;
    let correctIndex = -1;

    while ((match = choiceRegex.exec(cleanedBlock)) !== null) {
      const isCorrect = !!match[1];
      const letter = match[2];
      const text = match[3].trim();
      const index = 'ABCDEF'.indexOf(letter);

      choices[index] = text;
      if (isCorrect) correctIndex = index;
    }

    const correctAnswer = correctIndex !== -1 ? 'ABCDEF'[correctIndex] : '';

    questions.push({
      question,
      choices,
      correctAnswer
    });
  }

  return questions;
}

module.exports = parseQuestionsFromPDF;
