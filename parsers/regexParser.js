// File: parsers/regexParser.js

const pdfParse = require('pdf-parse');

async function parseQuestionsFromPDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const questions = [];

  const rawBlocks = text.split(/Question #:\s*\d+/).filter(q => q.trim().length > 20);

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const questionNum = i + 1;

    console.log(`\n===== RAW BLOCK ${questionNum} =====\n`);
    console.log(block);

    const cleanedBlock = block.replace(/Item Psychometrics:[\s\S]*?(?=Question #:|$)/gi, '');

    const questionMatch = cleanedBlock.match(/^(.*?)(?=\n(?:\d*[\u2713✓]?\s*[A-F]\.))/s);
    const question = questionMatch ? questionMatch[1].trim() : '';
    console.log(`\n[Q${questionNum}] Question: ${question}`);

    const choiceRegex = /(?:^|\n)\s*(\d+|✓)?\s*([A-F])\.\s*(.*?)(?=(?:\n\s*(?:\d+|✓)?\s*[A-F]\.|Rationale:|Item ID:|Item Description:|Item Categories:|Item Creator:|$))/gs;
    const cleanText = text.split(/(Category Name|Rationale:|Item ID:|Item Description:|Attachment:)/)[0].trim();
    choices[index] = cleanText;


    const choices = [];
    let match;
    const correctLetters = [];

    console.log(`\n[Q${questionNum}] Choices:`);

    while ((match = choiceRegex.exec(cleanedBlock)) !== null) {
      const marker = match[1] ? match[1].trim() : '';
      const letter = match[2];
      const text = match[3].trim();
      const index = 'ABCDEF'.indexOf(letter);

      choices[index] = text;

      const isCorrect = marker && (marker === '✓' || /^\d+$/.test(marker));
      if (isCorrect) correctLetters.push(letter);

      console.log(`  [${marker || ' '}${letter}] ${text} ${isCorrect ? '<-- correct' : ''}`);
    }

    const correctAnswer = correctLetters.join(';');
    console.log(`[Q${questionNum}] Correct Answer: ${correctAnswer}`);

    const idMatch = cleanedBlock.match(/Item ID:\s*(\d+)/);
    const id = idMatch ? idMatch[1].trim() : '';
    console.log(`[Q${questionNum}] Item ID: ${id}`);

    questions.push({
      id,
      question,
      choices,
      correctAnswer
    });
  }

  return questions;
}

module.exports = parseQuestionsFromPDF;
