const express = require('express');
const multer = require('multer');
const { runRoadmap } = require('../agent/runRoadmap');
const { extractText } = require('../services/pdfParser');
const { fetchJobText } = require('../services/jobFetcher');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// POST /api/roadmap
// Accepts multipart (resume PDF + fields) or JSON. Streams progress via SSE.
router.post('/', upload.single('resume'), async (req, res) => {
  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const emit = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Resolve resume text (PDF upload or pasted text).
    let resumeText = (req.body.resumeText || '').trim();
    if (req.file) {
      const fromPdf = await extractText(req.file.buffer);
      if (fromPdf.length > resumeText.length) resumeText = fromPdf;
    }

    // Resolve job text (pasted text or fetched URL).
    let jobText = (req.body.jobText || '').trim();
    if (!jobText && req.body.jobUrl) {
      try {
        jobText = await fetchJobText(req.body.jobUrl);
      } catch {
        emit('error', { message: 'Could not read that job URL — paste the description instead.' });
        return res.end();
      }
    }

    if (resumeText.length < 50) {
      emit('error', { message: 'Resume text is too short or unreadable. Paste it directly.' });
      return res.end();
    }
    if (jobText.length < 50) {
      emit('error', { message: 'Job description is too short. Paste the full posting.' });
      return res.end();
    }

    const result = await runRoadmap({ resumeText, jobText }, emit);
    emit('result', result);
    res.end();
  } catch (err) {
    console.error(err);
    emit('error', { message: err.message || 'Roadmap generation failed.' });
    res.end();
  }
});

module.exports = router;
