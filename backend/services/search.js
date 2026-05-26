// Tavily web search. Uses global fetch (Node 18+). No SDK needed.
async function tavilySearch(query, maxResults = 5) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.results || [];
}

module.exports = { tavilySearch };
