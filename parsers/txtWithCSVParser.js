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
  const blocks = text.split(/(?=Title:\s.*?Category:)/g).map(b => b.trim()).filter(Boolean);
  const questions = [];

  let currentTitle = '';
  let currentCategory = '';
  let fallbackCourse = '';
  let fallbackLevel = '';

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

    // Tag parsing
    const allTags = currentCategory.split(/[,;]/).map(t => t.trim());

    // Normalize Bloom's taxonomy
    const BLOOM_LEVELS = {
      '01': 'Remembering',
      '02': 'Understanding',
      '03': 'Applying',
      '04': 'Analyzing',
      '05': 'Evaluating',
      '06': 'Creating'
    };

    const bloomRaw = allTags.find(tag => /\b0[1-6]\b.*\b(Remember|Understand|Apply|Analyz|Evaluat|Creat)/i.test(tag));
    let bloom = '';

    if (bloomRaw) {
      const numMatch = bloomRaw.match(/\b0[1-6]\b/);
      const num = numMatch ? numMatch[0] : '';
      const label = BLOOM_LEVELS[num];
      if (num && label) {
        bloom = `${num} ${label}`;
      }
    }

    // Course + Level extraction
    const courseTag = allTags.find(t => /\bNU\s*\d{3}\b/.test(t));
    const courseMatch = courseTag?.match(/NU\s*\d{3}/i);
    const course = courseMatch ? courseMatch[0].replace(/\s+/g, '') : '';
    const courseNumber = course?.match(/\d{3}/)?.[0];
    const level = courseNumber
      ? parseInt(courseNumber) < 400 ? 'Undergraduate'
        : parseInt(courseNumber) >= 500 ? 'Graduate'
        : ''
      : '';

    if (!fallbackCourse && course) fallbackCourse = course;
    if (!fallbackLevel && level) fallbackLevel = level;

    // NCLEX domain match (normalized + typo fix)
    const NCLEX_DOMAINS = [
      'Basic Care and Comfort',
      'Fundamentals Review',
      'Health Promotion and Maintenance',
      'Management of Care',
      'Medical Calculations',
      'Pharmalogical and Parenteral Therapies',
      'Physiological Adaptation',
      'Psychosocial Integrity',
      'Reduction of Risk Potentia',
      'Safety and Infection Control'
    ];

    let nclex = '';
    const exclusions = new Set([bloom, course]);

    for (const domain of NCLEX_DOMAINS) {
      const match = allTags.find(tag => tag.toLowerCase().includes(domain.toLowerCase()));
      if (match) {
        nclex = domain === 'Reduction of Risk Potentia'
          ? 'Reduction of Risk Potential'
          : domain;
        exclusions.add(match);
        break;
      }
    }

    // Topics = everything else
    const topics = allTags
      .filter(tag => tag && ![...exclusions].includes(tag))
      .join(', ');

    // Final ID mapping
    const id = titleToIdMap[currentTitle] || '';
    const prefix = fallbackLevel === 'Undergraduate' ? 'U' : fallbackLevel === 'Graduate' ? 'G' : '';
    const questionId = id ? `${prefix}${id}` : '';

    questions.push({
      id: questionId,
      title: id,
      question: questionText,
      correctAnswer: correctLetters.join(';'),
      choices,
      rationale: rationaleText,
      bloom,
      level: fallbackLevel,
      course: fallbackCourse,
      nclex,
      topics
    });
  }

  return questions;
};
