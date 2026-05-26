// POST to /api/roadmap and read the SSE stream.
// EventSource can't POST, so we read the response body manually and parse
// `event:` / `data:` blocks separated by blank lines.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function streamRoadmap(formData, { onStatus, onResult, onError }) {
  const res = await fetch(`${API_BASE}/api/roadmap`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok || !res.body) {
    onError?.({ message: `Server error (${res.status})` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Each SSE message ends with a blank line.
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop(); // keep incomplete tail

    for (const block of blocks) {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === 'status') onStatus?.(parsed);
      else if (event === 'result') onResult?.(parsed);
      else if (event === 'error') onError?.(parsed);
    }
  }
}
