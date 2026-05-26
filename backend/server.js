require('dotenv').config();
const express = require('express');
const cors = require('cors');
const roadmapRoute = require('./routes/roadmap');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/roadmap', roadmapRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Skill-gap roadmap backend on port ${PORT}`));
