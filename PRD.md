# PRD — Skill-Gap → Learning Roadmap Agent

**Owner:** Asad Maqsood
**Status:** Draft v1 — ready to build
**One-liner:** Paste your resume + a target job → an AI agent finds your real skill gaps and builds a week-by-week learning roadmap with verified, free resources for each gap.

---

## 1. Goal & Why

Job seekers see a posting, feel underqualified, don't know exactly *what* to learn or *where*. This agent diffs your resume against a real job description, surfaces the precise missing skills, then — for each gap — searches the live web, picks the best free resource, verifies the link is alive, and assembles an ordered weekly plan.

**Why it's a strong portfolio piece:**
- True **agent tool-use loop** (web search fan-out + link validation), not a single prompt.
- Self-referential: demo it with Asad's own resume against a real internship posting.
- Broad utility + shareable ("AI made me a roadmap to land X").

**Success criteria (MVP):**
1. Given a resume + job desc, returns a gap list + ordered roadmap in < 30s.
2. Every resource link in the output returns HTTP 200 (validated, no dead links).
3. Roadmap is ordered by dependency/priority, grouped into weeks.
4. Live deployed URL (Vercel + Render).

---

## 2. Scope

### In (MVP)
- Resume input: paste text **or** upload PDF.
- Job input: paste job-description text **or** paste a job-posting URL (agent fetches + extracts).
- Output: matched skills, missing skills (gaps), ranked week-by-week roadmap, 1–2 verified free resources per gap, time estimate per item.
- Streaming progress UI (show the agent working: "diffing skills → searching Docker → validating links…").

### Out (later)
- Accounts / login / DB persistence.
- Saving roadmaps, progress tracking / check-off.
- Paid resources, course-platform integrations.
- Multi-resume / multi-job comparison.

---

## 3. User Flow

```
1. User pastes resume (or uploads PDF) + pastes job desc (or job URL)
2. Click "Build my roadmap"
3. Live progress streams: parsing → diffing → searching each gap → validating
4. Result page:
     - Match summary (have X of Y key skills)
     - Matched skills (green) / Missing skills (red)
     - Week-by-week roadmap cards, each gap with:
         • why it matters for this role
         • 1–2 verified free resources (title + link + type)
         • est. time to learn
5. Copy / share button
```

---

## 4. Architecture

```
frontend/                 React + Vite + Tailwind
  src/
    App.jsx
    components/
      InputForm.jsx        resume (paste/PDF) + job (paste/URL)
      ProgressStream.jsx   SSE live agent steps
      MatchSummary.jsx     have X of Y skills
      SkillLists.jsx       matched / missing
      RoadmapWeek.jsx      weekly card w/ gap + resources
    lib/api.js             calls backend, reads SSE

backend/                  Node + Express
  server.js
  routes/
    roadmap.js            POST /api/roadmap  (SSE stream)
  services/
    openai.js             gpt-4o calls (extract, diff, plan)
    search.js             Tavily web search per gap
    linkcheck.js          HEAD/GET each URL, keep only 200s
    pdfParser.js          pdf-parse -> text
    jobFetcher.js         fetch job URL -> readable text
  agent/
    runRoadmap.js         orchestrates the agent loop (below)
```

**Stack:** React/Vite + Tailwind · Node/Express · OpenAI `gpt-4o` (JSON mode) · Tavily Search API · `pdf-parse` · deploy Vercel (frontend) + Render (backend).

---

## 5. Agent Loop (the core)

```
INPUT: resumeText, jobText
1. extractResumeSkills(resumeText)      -> [skills user has]      (LLM, JSON)
2. extractJobSkills(jobText)            -> [skills role requires] (LLM, JSON, ranked by importance)
3. diff -> matched[], missing[]         (LLM reconciles synonyms: "JS" == "JavaScript")
4. FOR EACH gap in missing (parallel, capped):
     a. query = `best free resource to learn ${gap} for ${roleTitle}`
     b. results = tavilySearch(query)              [tool]
     c. candidates = LLM picks top 1-2 + classifies type (course/docs/video/article)
     d. linkcheck each candidate -> drop non-200    [tool]
     e. if all dropped -> re-search once with broader query (self-correct)
5. orderRoadmap(gaps)                   -> weeks[] ordered by prerequisite + job importance (LLM)
6. emit final JSON
```

Each step streams a status event over SSE so the UI shows the agent working. Steps 1–3 and 5 are LLM calls; 4b/4d are real tool calls (the agentic part).

---

## 6. API Contract

### `POST /api/roadmap`
Content-Type: `multipart/form-data` (to allow PDF) **or** `application/json`.

**Request fields:**
| field | type | notes |
|---|---|---|
| `resumeText` | string | optional if `resume` file given |
| `resume` | file (PDF) | optional if `resumeText` given |
| `jobText` | string | optional if `jobUrl` given |
| `jobUrl` | string | optional; backend fetches + extracts |

**Response:** `text/event-stream` (SSE). Event types:
```
event: status   data: { "step": "extracting_resume", "message": "Reading resume…" }
event: status   data: { "step": "searching_gap", "gap": "Docker", "message": "Finding resources…" }
event: result   data: <final RoadmapResult JSON>
event: error    data: { "message": "..." }
```

### Final `RoadmapResult` shape
```json
{
  "roleTitle": "Software Engineer Intern",
  "matchScore": 72,
  "matchedSkills": ["JavaScript", "React", "Node.js"],
  "missingSkills": ["Docker", "CI/CD", "TypeScript"],
  "roadmap": [
    {
      "week": 1,
      "skill": "TypeScript",
      "why": "Listed as required; you have JS, this is the fastest high-value add.",
      "estHours": 8,
      "resources": [
        { "title": "TypeScript Handbook", "url": "https://...", "type": "docs" },
        { "title": "TS for JS Devs (free)", "url": "https://...", "type": "course" }
      ]
    }
  ]
}
```

---

## 7. Key Prompts (sketch — refine in build)

- **extractJobSkills:** "Extract the concrete technical skills/tools this job requires. Return JSON array of `{skill, importance: high|med|low}`. Ignore soft skills and fluff."
- **diffSkills:** "Given the candidate's skills and the role's required skills, return `{matched, missing}`. Treat synonyms/abbreviations as equal (JS=JavaScript, k8s=Kubernetes)."
- **pickResource:** "From these search results for learning `<skill>`, choose the 1–2 best FREE resources. Return JSON `{title, url, type}`. Prefer official docs and well-known free courses. Reject paywalled."
- **orderRoadmap:** "Order these skills into a week-by-week plan. Earlier = higher job importance AND prerequisites first. Add `why` and `estHours` per item."

All LLM calls use `response_format: { type: 'json_object' }`.

---

## 8. Env / Config
```
# backend/.env
OPENAI_API_KEY=
TAVILY_API_KEY=
PORT=3001
```
Provide `.env.example`. Never commit keys.

---

## 9. Edge Cases
- Resume or job text too short / empty → 400 with friendly message.
- Job URL fetch fails or is JS-heavy → fall back to asking user to paste text.
- A gap returns zero live resources after re-search → keep the gap, mark "no free resource found", still show in roadmap.
- PDF parse yields garbage → detect low text length, ask to paste instead.
- Rate-limit Tavily/OpenAI → cap concurrent gap searches (e.g. 5 at a time).

---

## 10. Milestones (verifiable)
```
M1  Backend skeleton: POST /api/roadmap echoes parsed resume+job   -> verify: curl returns extracted skills
M2  Skill extraction + diff working                                 -> verify: known resume/job gives correct matched/missing
M3  Tavily search + link validation per gap                         -> verify: every returned url is 200
M4  Roadmap ordering + final JSON                                   -> verify: response matches RoadmapResult schema
M5  SSE streaming wired                                             -> verify: client logs status events in order
M6  React UI: form + progress + result cards                        -> verify: end-to-end in browser locally
M7  Deploy Vercel + Render, live URL                                -> verify: works from deployed URL
```

---

## 11. Out-of-Scope Reminders (don't gold-plate)
No auth, no DB, no progress tracking, no payments, no resume editing. Single page, single endpoint. Ship M1–M7, then stop.

---

## 12. Demo Script (for interviews)
1. Paste Asad's resume + a real internship posting.
2. Watch the agent stream: parsing → diffing → searching each gap live.
3. Show the roadmap: "you have 7 of 10 skills; here's a 3-week plan with verified free links."
4. Click a link — it's live (point out link-validation step).
5. One-liner: "It's an agent — it searches the web per gap and verifies every resource, not a single prompt."
