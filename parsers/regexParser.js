// File: parsers/regexParser.js
const pdfParse = require('pdf-parse');

async function parseQuestionsFromPDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const questions = [];

  // Match each full item block, starting with Item ID and ending before the next
  const itemRegex = /Item ID:\s*(\d+)[\s\S]*?(?=(?:\nItem ID:|\Z))/g;
  const matches = [...text.matchAll(itemRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const id = match[1];
    const block = match[0];

    console.log(`\n===== BLOCK FOR ID ${id} =====\n`);
    console.log(block);

    // Remove metadata headers from the top and bottom
    let cleanedBlock = block
      .replace(/Item (Description|Weight|Group|Categories|Creator|Psychometrics):[\s\S]*?(?=\n[A-D]\.|✓[A-D]\.|Rationale:)/gi, '')
      .replace(/Item ID:\s*\d+/, '')
      .replace(/Item Psychometrics:[\s\S]*/gi, '')  // remove trailing psychometrics
      .trim();

    // Extract question
    const lines = cleanedBlock.split('\n');
    let question = '';
    let firstChoiceIndex = lines.findIndex(line =>
      /^\s*[✓3]?\s*[A-K]\./.test(line)
    );

    if (firstChoiceIndex > 0) {
      const questionLines = lines.slice(0, firstChoiceIndex)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !/^Rationale:/i.test(line));
      question = questionLines.join(' ');
    }

    const choices = [];
    const correctLetters = [];

    const choiceRegex = /(?:^|\n)\s*(✓|3|\d+)?\s*([A-K])\.\s*(.*?)(?=(?:\n\s*(?:✓|3|\d+)?\s*[A-K]\.|Rationale:|Item ID:|Item Description:|Attachment:|Item Categories:|Category Name|Item Creator:|$))/gs;

    let matchChoice;
    while ((matchChoice = choiceRegex.exec(cleanedBlock)) !== null) {
      const marker = matchChoice[1] ? matchChoice[1].trim() : '';
      const letter = matchChoice[2];
      let text = matchChoice[3].trim();

      if (/^(Category|Item|Attachment|Rationale)/i.test(text)) continue;

      text = text.replace(/(Category Name|Attachment:|Item ID:).*$/is, '').trim();

      const index = 'ABCDEFGHIJK'.indexOf(letter);
      choices[index] = text;

      const isCorrect = marker && (marker === '✓' || marker === '3' || /^\d+$/.test(marker));
      if (isCorrect) correctLetters.push(letter);
    }

    const correctAnswer = correctLetters.join(';');

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
