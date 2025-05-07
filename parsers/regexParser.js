// File: openaiParser.js

const fs = require("fs");
const pdfParse = require("pdf-parse");

function extractQuestionsFromText(text) {
  const questions = [];

  const blocks = text.split(/Question #:\s*/).slice(1); // drop preamble

  for (const block of blocks) {
    const questionMatch = block.match(/^(.*?)\nA\./s);
    const optionsMatch = block.match(/A\.\s*(.*?)\nB\.\s*(.*?)\nC\.\s*(.*?)\nD\.\s*(.*?)\n/s);
    const correctAnswerMatch = block.match(/✓([A-D])\./);
    const rationaleMatch = block.match(/Rationale:\s*(.*?)\n(?:Item ID:|$)/s);
    const itemIdMatch = block.match(/Item ID:\s*(\d+)\s*\//);
    const categoryMatches = [...block.matchAll(/Category Name\s+Category Path\n([\s\S]*?)\n\n/g)].map(m => m[1]);

    const categories = [...new Set(
      categoryMatches
        .flatMap(c => c.split(/\n+/))
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("Topical") && !line.startsWith("IMPORTS"))
    )];

    const courseMatch = categories.find(c => /NU\s*(\d{3})/.test(c));
    const courseNumberMatch = courseMatch?.match(/NU\s*(\d{3})/);
    const courseNumber = courseNumberMatch ? parseInt(courseNumberMatch[1]) : null;
    const level = courseNumber
      ? courseNumber < 400
        ? "Undergraduate"
        : courseNumber < 900
          ? "Graduate"
          : ""
      : "";

    const blooms = categories.find(c => /^\d{2}\s*-/.test(c)) || "";
    const topics = categories.filter(c => !/^\d{2}\s*-/.test(c)).join("; ");

    if (questionMatch && optionsMatch && correctAnswerMatch) {
      questions.push({
        Title: itemIdMatch?.[1] || "",
        Question: questionMatch[1].trim(),
        OptionA: optionsMatch[1].trim(),
        OptionB: optionsMatch[2].trim(),
        OptionC: optionsMatch[3].trim(),
        OptionD: optionsMatch[4].trim(),
        Correct: correctAnswerMatch[1],
        Feedback: rationaleMatch?.[1].trim() || "",
        Level: level,
        Bloom: blooms,
        Topic: topics,
      });
    }
  }

  return questions;
}

async function parsePdfToJson(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  return extractQuestionsFromText(data.text);
}

module.exports = { parsePdfToJson };
