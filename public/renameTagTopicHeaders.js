const fs = require('fs');
const csv = require('fast-csv');

const inputPath = './es2aa_output (2).csv';         // <-- input file name
const outputPath = './es2aa_output_cleaned.csv';   // <-- desired output file

const rows = [];

fs.createReadStream(inputPath)
  .pipe(csv.parse({ headers: true }))
  .on('error', err => console.error('❌ Error:', err))
  .on('data', row => rows.push(row))
  .on('end', () => {
    if (!rows.length) {
      console.error('⚠️ No data found in input file.');
      return;
    }

    // Find all headers and build new ones
    const originalHeaders = Object.keys(rows[0]);
    const newHeaders = [];
    const topicCols = [];

    originalHeaders.forEach(header => {
      if (header.toLowerCase().startsWith('tag: topic')) {
        topicCols.push(header);
      } else {
        newHeaders.push(header);
      }
    });

    // Append flat 'Tag: Topic' for each used column
    newHeaders.push(...Array(topicCols.length).fill('Tag: Topic'));

    // Rebuild rows with renamed keys
    const updatedRows = rows.map(row => {
      const updated = {};

      // Copy non-topic keys
      for (const key in row) {
        if (!key.toLowerCase().startsWith('tag: topic')) {
          updated[key] = row[key];
        }
      }

      // Flatten topics into repeated 'Tag: Topic' keys
      topicCols.forEach((key, idx) => {
        updated[`Tag: Topic_${idx + 1}`] = row[key];
      });

      return updated;
    });

    // Write to new CSV
    const ws = fs.createWriteStream(outputPath);
    const csvStream = csv.format({ headers: newHeaders });
    csvStream.pipe(ws);

    updatedRows.forEach(row => {
      const outputRow = {};

      for (const key in row) {
        if (key.startsWith('Tag: Topic_')) {
          outputRow['Tag: Topic'] = row[key];
        } else {
          outputRow[key] = row[key];
        }
      }

      csvStream.write(outputRow);
    });

    csvStream.end();
    console.log(`✅ Cleaned file saved as: ${outputPath}`);
  });
