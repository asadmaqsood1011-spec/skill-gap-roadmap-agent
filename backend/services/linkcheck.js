// Verify a URL is alive. Try HEAD, fall back to GET (some hosts reject HEAD).
async function isAlive(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    clearTimeout(t);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

// Filter a list of {url,...} resources, keeping only live ones.
async function keepAlive(resources) {
  const checks = await Promise.all(resources.map((r) => isAlive(r.url)));
  return resources.filter((_, i) => checks[i]);
}

module.exports = { isAlive, keepAlive };
