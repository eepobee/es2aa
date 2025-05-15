const xlsx = require('xlsx');

function getLevel(course) {
  const match = course.match(/\d{3}/);
  if (!match) return '';
  const num = parseInt(match[0]);
  if (num >= 100 && num <= 399) return 'Undergraduate';
  if (num >= 500 && num <= 899) return 'Graduate';
  return '';
}

const NCLEX_DOMAINS = [
  'Basic Care and Comfort',
  'Fundamentals Review',
  'Health Promotion and Maintenance',
  'Management of Care',
  'Medical Calculations',
  'Pharmalogical and Parenteral Therapies',
  'Physiological Adaptation',
  'Psychosocial Integrity',
  'Reduction of Risk Potentia', // will normalize this below
  'Safety and Infection Control'
];

function parseXLSXMetadata(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const metadata = {};
  for (const row of rows) {
    const id = row['ID/Rev']?.toString().trim();
    const type = row['Type']?.toString().trim();

    // 🚫 Skip if not MChoice
    if (!id || type.toLowerCase() !== 'mchoice') continue;

    const categories = row['Categories'] || '';

    const allTags = categories
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean);

    const bloomTag = allTags.find(tag => /^0[1-6]\s*-?\s*\w+/.test(tag));
    const bloom = bloomTag ? bloomTag.replace(/\s*-\s*/, ' ').trim() : '';

    const courseMatch = categories.match(/\bNU\s*\d{3}\b/);
    const course = courseMatch ? courseMatch[0].trim() : '';
    const level = course ? getLevel(course) : '';

    let nclex = '';
    const exclusions = new Set();
    if (bloomTag) exclusions.add(bloomTag);
    if (course) exclusions.add(course);

    for (const domain of NCLEX_DOMAINS) {
      if (categories.includes(domain)) {
        nclex = domain === 'Reduction of Risk Potentia'
          ? 'Reduction of Risk Potential'
          : domain;
        exclusions.add(domain);
        break;
      }
    }

    const topics = allTags
      .filter(tag => !exclusions.has(tag))
      .map(tag => tag.replace(/^0[1-6]\s*-?\s*/, '')) // remove prefix from topics
      .join(', ');

    metadata[id] = {
      type: 'Multiple Choice', // force normalized
      bloom,
      course,
      level,
      topics,
      nclex,
      feedback: row['Rationale'] || ''
    };
  }

  return metadata;
}

module.exports = parseXLSXMetadata;