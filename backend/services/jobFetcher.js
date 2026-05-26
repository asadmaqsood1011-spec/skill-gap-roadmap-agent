// Fetch a job-posting URL and return readable text (crude tag strip).
// JS-heavy postings may return little usable text — caller should fall back
// to asking the user to paste the description.
async function fetchJobText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  const res = await fetch(url, {
    redirect: 'follow',
    signal: ctrl.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (roadmap-agent)' },
  });
  clearTimeout(t);
  if (!res.ok) throw new Error(`Job URL fetch ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

module.exports = { fetchJobText };
