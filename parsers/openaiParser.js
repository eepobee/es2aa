require('dotenv').config();
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MAX_QUESTIONS_PER_BATCH = 5;

async function parseQuestionsFromPDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;

  const rawBlocks = text.split(/Question #:\s*\d+/).filter(b => b.trim().length > 20);
  const results = [];

  for (let i = 0; i < rawBlocks.length; i += MAX_QUESTIONS_PER_BATCH) {
    const batch = rawBlocks.slice(i, i + MAX_QUESTIONS_PER_BATCH);
    const prompt = buildPrompt(batch);

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You extract structured multiple choice questions from medical exam text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const jsonText = completion.choices[0].message.content;
      const parsed = JSON.parse(jsonText);
      results.push(...parsed);

    } catch (err) {
      console.error(`Error in batch ${i / MAX_QUESTIONS_PER_BATCH + 1}:`, err.message);
    }
  }

  return results;
}

function buildPrompt(batch) {
  return `Extract each ExamSoft-style multiple choice item below. For each question, return JSON with:
- id (from "Item ID")
- question (stem only)
- choices (array of 4)
- correctAnswer (text of correct choice)
- rationale
- courseNumber (e.g. NU 674)
- level (Undergraduate or Graduate)
- topics (array of strings)

Return only a JSON array (no explanation).

---\n\n${batch.join('\n\n---\n\n')}`;
}

module.exports = parseQuestionsFromPDF;
