// Extract text from a PDF buffer. pdf-parse is required lazily so the rest of
// the app boots even if the optional dep misbehaves on import.
async function extractText(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}

module.exports = { extractText };
