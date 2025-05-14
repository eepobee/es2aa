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
  'Physiological Adaption',
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
    const categories = row['Categories'] || '';

    const bloomMatch = categories.match(/\b0[1-6]\s*-\s*\w+/);
    const courseMatch = categories.match(/\bNU\s*\d{3}\b/);

    const bloom = bloomMatch ? bloomMatch[0].trim() : '';
    const course = courseMatch ? courseMatch[0].trim() : '';
    const level = course ? getLevel(course) : '';

    let nclex = '';
    for (const domain of NCLEX_DOMAINS) {
      if (categories.includes(domain)) {
        nclex = domain === 'Reduction of Risk Potentia' ? 'Reduction of Risk Potential' : domain;
        break;
      }
    }

    const exclusions = [bloom, course, nclex];
    const topics = categories.split(',').map(s => s.trim())
      .filter(c => c && !exclusions.includes(c)).join('; ');

    metadata[id] = {
      type: row['Type'] || '',
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