const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Run a chat completion in JSON mode and parse the result.
async function jsonCall(system, user) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  return JSON.parse(completion.choices[0].message.content);
}

// 1. Skills the candidate already has.
async function extractResumeSkills(resumeText) {
  const out = await jsonCall(
    `Extract concrete technical skills, tools, languages, and frameworks the candidate already has from their resume.
Return JSON: { "skills": ["..."] }. Only hard/technical skills. Ignore soft skills, fluff, and job titles.`,
    `Resume:\n${resumeText}`
  );
  return out.skills || [];
}

// 2. Skills the role requires, ranked by importance.
async function extractJobSkills(jobText) {
  const out = await jsonCall(
    `Extract the concrete technical skills/tools/frameworks this job requires.
Return JSON: { "roleTitle": "...", "skills": [ { "skill": "...", "importance": "high|med|low" } ] }.
Ignore soft skills and generic fluff. Rank importance by how central each is to the role.`,
    `Job description:\n${jobText}`
  );
  return { roleTitle: out.roleTitle || 'this role', jobSkills: out.skills || [] };
}

// 3. Reconcile (treat synonyms/abbreviations as equal) -> matched + missing.
async function diffSkills(resumeSkills, jobSkills) {
  const out = await jsonCall(
    `Given the candidate's skills and the role's required skills, decide which required skills the candidate already has.
Treat synonyms and abbreviations as equal (JS = JavaScript, k8s = Kubernetes, TS = TypeScript, CI/CD includes GitHub Actions, etc.).
Return JSON: { "matched": ["..."], "missing": [ { "skill": "...", "importance": "high|med|low" } ] }.
"matched" = required skills the candidate has. "missing" = required skills they lack (keep the importance from the job).`,
    `Candidate skills: ${JSON.stringify(resumeSkills)}\nRequired skills: ${JSON.stringify(jobSkills)}`
  );
  return { matched: out.matched || [], missing: out.missing || [] };
}

// 4. From raw search results, pick the best 1-2 FREE resources for one gap.
async function pickResources(skill, roleTitle, searchResults) {
  const trimmed = searchResults.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: (r.content || '').slice(0, 400),
  }));
  const out = await jsonCall(
    `From these search results for learning a skill, choose the 1-2 best FREE resources.
Reject paywalled/paid resources (e.g. most Udemy/Coursera paid listings, anything that requires purchase to start).
Prefer official docs, free university courses (audit), well-known free YouTube courses, and free interactive platforms.
Return JSON: { "resources": [ { "title": "...", "url": "...", "type": "docs|course|video|article|interactive" } ] }.
Only include resources that appear in the provided results. If none are clearly free, return the most likely-free 1.`,
    `Skill to learn: ${skill} (for role: ${roleTitle})\nSearch results:\n${JSON.stringify(trimmed, null, 2)}`
  );
  return out.resources || [];
}

// 5. Order the gaps into a week-by-week plan.
async function orderRoadmap(missing, roleTitle) {
  const out = await jsonCall(
    `Order these missing skills into a week-by-week learning plan for the role "${roleTitle}".
Earlier weeks = higher job importance AND prerequisites first (e.g. learn a language before a framework built on it).
Return JSON: { "order": [ { "skill": "...", "week": 1, "why": "one sentence on why it matters for this role", "estHours": 8 } ] }.
Assign realistic estHours (4-20). Multiple skills can share a week if small. Keep every skill from the input.`,
    `Missing skills: ${JSON.stringify(missing)}`
  );
  return out.order || [];
}

module.exports = {
  extractResumeSkills,
  extractJobSkills,
  diffSkills,
  pickResources,
  orderRoadmap,
};
