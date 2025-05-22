// File: parsers/txtWithCSVParser.js

const fs = require('fs');
const csv = require('csv-parser');

function loadTitleToIdMap(csvPath) {
  return new Promise((resolve, reject) => {
    const map = {};
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', row => {
        const title = row['Title']?.trim();
        const id = row['ID/Rev']?.trim();
        if (title && id) {
          map[title] = id;
        }
      })
      .on('end', () => resolve(map))
      .on('error', err => reject(err));
  });
}

module.exports = async function parseQuestionsFromTxtWithCSV(txtBuffer, csvPath) {
  const titleToIdMap = await loadTitleToIdMap(csvPath);
  const text = txtBuffer.toString('utf-8');

  const blocks = text.split(/\n(?=\d+\)\s)/).map(b => b.trim()).filter(Boolean);
  const questions = [];

  let currentTitle = '';
  let currentCategory = '';

  for (const block of blocks) {
    const titleMatch = block.match(/Title:\s*(.*?)\s+Category:/i);
    const categoryMatch = block.match(/Category:\s*(.*?)(?=\d+\))/s);

    if (titleMatch) currentTitle = titleMatch[1].trim();
    if (categoryMatch) currentCategory = categoryMatch[1].trim();

    const questionMatch = block.match(/\d+\)\s*(.*?)\s*~\s*(.*?)\s*(?=^[a-g]\)|\*[a-g]\))/ims);
    if (!questionMatch) continue;

    const questionText = questionMatch[1].replace(/\s+/g, ' ').trim();
    const rationaleText = questionMatch[2].replace(/\s+/g, ' ').trim();

    const choiceRegex = /(^|\n)(\*?)([a-g])\)\s*(.*?)(?=\n[\*]?[a-g]\)|\n*$)/gis;
    const choices = [];
    const correctLetters = [];

    let match;
    while ((match = choiceRegex.exec(block)) !== null) {
      const isCorrect = match[2] === '*';
      const letter = match[3].toUpperCase();
      const text = match[4].trim();
      const index = 'ABCDEFGHIJK'.indexOf(letter);
      choices[index] = text;
      if (isCorrect) correctLetters.push(letter);
    }

    // Parse tags
    const allTags = currentCategory.split(/[,;]/).map(t => t.trim());
    const bloomTag = allTags.find(t => /^0[1-6]\s*[-–]?\s*\w+/.test(t));
    const bloom = bloomTag ? bloomTag.replace(/\s*[-–]\s*/, ' ').trim() : '';
    const course = allTags.find(t => /\bNU\s*\d{3}\b/.test(t)) || '';
    const courseNumber = course.match(/\d{3}/)?.[0];
    const level = courseNumber
      ? parseInt(courseNumber) < 400 ? 'Undergraduate'
        : parseInt(courseNumber) >= 500 ? 'Graduate'
        : ''
      : '';

    const nclexDomains = [
      'Basic Care and Comfort', 'Fundamentals Review', 'Health Promotion and Maintenance',
      'Management of Care', 'Medical Calculations', 'Pharmalogical and Parenteral Therapies',
      'Physiological Adaptation', 'Psychosocial Integrity', 'Reduction of Risk Potentia',
      'Safety and Infection Control'
    ];
    const nclex = nclexDomains.find(domain =>
      currentCategory.toLowerCase().includes(domain.toLowerCase())
    ) || '';

    const exclusions = new Set([bloom, course, nclex]);
    const topics = allTags
      .filter(tag => tag && ![...exclusions].includes(tag))
      .join(', ');

    // Final ID mapping
    const id = titleToIdMap[currentTitle] || '';
    const prefix = level === 'Undergraduate' ? 'U' : level === 'Graduate' ? 'G' : '';
    const questionId = id ? `${prefix}${id}` : '';

    questions.push({
      id: questionId,
      title: id,
      question: questionText,
      correctAnswer: correctLetters.join(';'),
      choices,
      rationale: rationaleText,
      bloom,
      level,
      course,
      nclex,
      topics
    });
  }

  return questions;
};
