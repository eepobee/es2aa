// parsers/regexParser.js
const pdfParse = require('pdf-parse');

function getLevelFromCourse(course) {
  const match = course.match(/NU\s*(\d+)/i);
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

    const courseMatch = block.match(/Course Number:\s*(NU\s*\d+)/i);
    const courseNumber = courseMatch ? courseMatch[1] : '';
    const level = getLevelFromCourse(courseNumber);

    const questionMatch = block.match(/^(.*?)(?:\nA\.|\nA\))/s);
    const question = questionMatch ? questionMatch[1].trim() : '';

    const choices = [];
    const choiceMatch = block.match(/A\.\s*(.*?)\nB\.\s*(.*?)\nC\.\s*(.*?)\nD\.\s*(.*?)(?:\n|$)/s);
    if (choiceMatch) {
      choices.push(choiceMatch[1], choiceMatch[2], choiceMatch[3], choiceMatch[4]);
    }

    const correctMatch = block.match(/✓\s*([A-D])\./);
    const correctLetter = correctMatch ? correctMatch[1].toLowerCase() : '';
    const correctAnswer = correctLetter && choices.length === 4 ? choices['abcd'.indexOf(correctLetter)] : '';

    const rationaleMatch = block.match(/Rationale:\s*(.+?)(?:\n{2,}|$)/is);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : '';

    const categoryMatch = block.match(/Category Name:\s*([\s\S]+?)\n(?:\s*\w+:|$)/);
    const categoryBlock = categoryMatch ? categoryMatch[1] : '';
    const topics = categoryBlock
      .split('\n')
      .map(line => line.replace(/^\s*\d{2}\s*/, '').trim())
      .filter(Boolean);

    const bloomMatch = categoryBlock.match(/\b\d{2}\s*([A-Za-z]+)/);
    const bloom = bloomMatch ? bloomMatch[1] : '';

    questions.push({
      id,
      question,
      choices,
      correctAnswer,
      rationale,
      courseNumber,
      level,
      topics,
      bloom
    });
  }

  return questions;
}

module.exports = parseQuestionsFromPDF;
