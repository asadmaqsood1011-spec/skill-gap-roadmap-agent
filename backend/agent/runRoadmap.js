const {
  extractResumeSkills,
  extractJobSkills,
  diffSkills,
  pickResources,
  orderRoadmap,
} = require('../services/openai');
const { tavilySearch } = require('../services/search');
const { keepAlive } = require('../services/linkcheck');

// Run an array of async tasks with a concurrency cap.
async function pool(items, limit, worker) {
  const results = [];
  let i = 0;
  const runners = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
      }
    });
  await Promise.all(runners);
  return results;
}

// Find verified free resources for one skill gap. Self-corrects once with a
// broader query if the first round yields no live resources.
async function resourcesForGap(skill, roleTitle, emit) {
  emit('status', { step: 'searching_gap', gap: skill, message: `Finding resources for ${skill}…` });

  async function attempt(query) {
    const results = await tavilySearch(query);
    const picked = await pickResources(skill, roleTitle, results);
    return keepAlive(picked);
  }

  let live = await attempt(`best free resource to learn ${skill} for ${roleTitle}`);
  if (live.length === 0) {
    emit('status', { step: 'retry_gap', gap: skill, message: `Retrying broader search for ${skill}…` });
    live = await attempt(`free ${skill} tutorial`);
  }
  return live;
}

// Full agent loop. `emit(event, data)` streams progress to the caller (SSE).
async function runRoadmap({ resumeText, jobText }, emit) {
  emit('status', { step: 'extracting_resume', message: 'Reading your resume…' });
  const resumeSkills = await extractResumeSkills(resumeText);

  emit('status', { step: 'extracting_job', message: 'Reading the job description…' });
  const { roleTitle, jobSkills } = await extractJobSkills(jobText);

  emit('status', { step: 'diffing', message: 'Comparing your skills to the role…' });
  const { matched, missing } = await diffSkills(resumeSkills, jobSkills);

  const totalRequired = matched.length + missing.length;
  const matchScore = totalRequired ? Math.round((matched.length / totalRequired) * 100) : 0;

  // Per-gap resource search, capped at 5 concurrent.
  const missingNames = missing.map((m) => m.skill);
  const resourceLists = await pool(missingNames, 5, (skill) =>
    resourcesForGap(skill, roleTitle, emit)
  );
  const resourcesBySkill = {};
  missingNames.forEach((skill, idx) => {
    resourcesBySkill[skill] = resourceLists[idx];
  });

  emit('status', { step: 'ordering', message: 'Building your week-by-week plan…' });
  const order = await orderRoadmap(missing, roleTitle);

  const roadmap = order.map((item) => ({
    week: item.week,
    skill: item.skill,
    why: item.why,
    estHours: item.estHours,
    resources: resourcesBySkill[item.skill] || [],
  }));

  return {
    roleTitle,
    matchScore,
    matchedSkills: matched,
    missingSkills: missingNames,
    roadmap,
  };
}

module.exports = { runRoadmap };
