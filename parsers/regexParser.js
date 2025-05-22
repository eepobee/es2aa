// File: parsers/regexParser.js

const pdfParse = require('pdf-parse');

async function parseQuestionsFromPDF(buffer) {
  const data = await pdfParse(buffer);
  console.log('\n========== RAW PDF TEXT START ==========\n');
  console.log(data.text.slice(0, 3000)); // adjust the length as needed
  console.log('\n========== RAW PDF TEXT END ==========\n');

  const text = data.text;
  const questions = [];

 const rawBlocks = text.split(/(?:^|\n)Item ID:\s*\d+/).filter(q => q.trim().length > 20);

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const questionNum = i + 1;

    console.log(`\n===== RAW BLOCK ${questionNum} =====\n`);
    console.log(block);

    const cleanedBlock = block.replace(/Item Psychometrics:[\s\S]*?(?=Question #:|$)/gi, '');

    // NEW: Extract question line based on position of first choice
    const lines = cleanedBlock.split('\n');
    let question = '';
    let firstChoiceIndex = lines.findIndex(line =>
      /^\s*[✓3]?\s*[A-K]\./.test(line)
    );

    if (firstChoiceIndex > 0) {
      const questionLines = lines.slice(0, firstChoiceIndex)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      question = questionLines.join(' ');
    }

    console.log(`\n[Q${questionNum}] Question: ${question}`);

    const choices = [];
    const correctLetters = [];

    console.log(`\n[Q${questionNum}] Choices:`);

    const choiceRegex = /(?:^|\n)\s*(✓|3|\d+)?\s*([A-K])\.\s*(.*?)(?=(?:\n\s*(?:✓|3|\d+)?\s*[A-K]\.|Rationale:|Item ID:|Item Description:|Attachment:|Item Categories:|Category Name|Item Creator:|$))/gs;

    let match;
    while ((match = choiceRegex.exec(cleanedBlock)) !== null) {
      const marker = match[1] ? match[1].trim() : '';
      const letter = match[2];
      let text = match[3].trim();

      // Skip clearly invalid junk options (page break bleed)
      if (/^(Category|Item|Attachment|Rationale)/i.test(text)) continue;

      // Remove trailing label junk within the option text
      text = text.replace(/(Category Name|Attachment:|Item ID:).*$/is, '').trim();

      const index = 'ABCDEFGHIJK'.indexOf(letter);
      choices[index] = text;

      const isCorrect = marker && (marker === '✓' || marker === '3' || /^\d+$/.test(marker));
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
