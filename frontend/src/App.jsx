import { useState } from 'react';
import { streamRoadmap } from './api';

const TYPE_ICON = { docs: '📄', course: '🎓', video: '▶️', article: '📰', interactive: '🧩' };

function ScoreRing({ pct }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div className="ring">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c8cff" />
            <stop offset="100%" stopColor="#5fd4e6" />
          </linearGradient>
        </defs>
        <circle className="track" cx="52" cy="52" r={r} fill="none" strokeWidth="8" />
        <circle
          className="fill"
          cx="52" cy="52" r={r}
          fill="none"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="label">
        <span className="pct">{pct}<small>%</small></span>
      </div>
    </div>
  );
}

export default function App() {
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [jobText, setJobText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [status, setStatus] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus([]);
    setResult(null);
    setError('');
    setLoading(true);

    const fd = new FormData();
    if (resumeFile) fd.append('resume', resumeFile);
    if (resumeText.trim()) fd.append('resumeText', resumeText);
    if (jobText.trim()) fd.append('jobText', jobText);
    if (jobUrl.trim()) fd.append('jobUrl', jobUrl);

    await streamRoadmap(fd, {
      onStatus: (s) => setStatus((prev) => [...prev, s]),
      onResult: (r) => {
        setResult(r);
        setLoading(false);
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });
    setLoading(false);
  }

  function copyRoadmap() {
    if (!result) return;
    const lines = [`Roadmap for ${result.roleTitle} — ${result.matchScore}% match`, ''];
    result.roadmap.forEach((w) => {
      lines.push(`Week ${w.week}: ${w.skill} (~${w.estHours}h) — ${w.why}`);
      w.resources.forEach((r) => lines.push(`  • ${r.title}: ${r.url}`));
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="page">
      <header className="hero">
        <span className="eyebrow">Skill-Gap Agent</span>
        <h1>Close the gap between<br />where you are and the job.</h1>
        <p>Paste your resume and a target job description. The agent diffs them, finds exactly what you're missing, and builds a week-by-week plan with verified, free resources — live.</p>
      </header>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="grid">
          <div className="field">
            <label><span className="ord">01</span> Your resume</label>
            <textarea
              rows={8}
              placeholder="Paste your resume text…"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
            <label className={`file${resumeFile ? ' has-file' : ''}`}>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setResumeFile(e.target.files[0] || null)}
              />
              {resumeFile ? `📎 ${resumeFile.name}` : 'Drop a PDF or click to upload'}
            </label>
          </div>

          <div className="field">
            <label><span className="ord">02</span> Target job</label>
            <textarea
              rows={8}
              placeholder="Paste the job description…"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
            />
            <input
              className="url"
              type="url"
              placeholder="…or paste a job posting URL"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Working…' : 'Build my roadmap'}
        </button>
      </form>

      {loading && (
        <div className="card stream">
          <div className="stream-head">
            <span className="live" /> Agent working
          </div>
          {status.length === 0 && (
            <div className="step"><span className="dot" /> Connecting to the agent…</div>
          )}
          {status.map((s, i) => (
            <div key={i} className="step" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="dot" /> {s.message}
            </div>
          ))}
        </div>
      )}

      {error && <div className="card error">⚠️ {error}</div>}

      {result && (
        <div className="result">
          <div className="card summary">
            <ScoreRing pct={result.matchScore} />
            <div>
              <h2>{result.roleTitle}</h2>
              <p className="sub">
                You match <b>{result.matchedSkills.length}</b> of{' '}
                <b>{result.matchedSkills.length + result.missingSkills.length}</b> key skills.{' '}
                {result.missingSkills.length} to close.
              </p>
              <div className="chips">
                {result.matchedSkills.map((s) => <span key={s} className="chip have">{s}</span>)}
                {result.missingSkills.map((s) => <span key={s} className="chip gap">{s}</span>)}
              </div>
            </div>
          </div>

          <div className="weeks-label">Your roadmap · {result.roadmap.length} weeks</div>
          <div className="weeks">
            {result.roadmap.map((w, i) => (
              <div key={i} className="card week" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="week-head">
                  <span className="week-num">Week {w.week}</span>
                  <span className="hours">~{w.estHours}h</span>
                </div>
                <h3>{w.skill}</h3>
                <p className="why">{w.why}</p>
                <ul>
                  {w.resources.length === 0 && <li className="none">No free resource found — search manually.</li>}
                  {w.resources.map((r, j) => (
                    <li key={j}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        <span className="ic">{TYPE_ICON[r.type] || '🔗'}</span> {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button className={`copy${copied ? ' done' : ''}`} onClick={copyRoadmap}>
            {copied ? 'Copied ✓' : 'Copy roadmap'}
          </button>
        </div>
      )}
    </div>
  );
}
