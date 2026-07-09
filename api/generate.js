// Vercel serverless function.
// Keeps the Gemini API key server-side (in an env var) so it's never exposed
// in the browser, unlike putting it directly in app.js.
//
// Set GEMINI_API_KEY in Vercel: Project Settings -> Environment Variables.
// Get a free key at https://aistudio.google.com/apikey

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel project settings.' });
  }

  const { topic, count } = req.body || {};
  const cleanTopic = (topic || '').toString().trim().slice(0, 6000);
  const cardCount = Math.min(Math.max(parseInt(count) || 10, 1), 25);

  if (!cleanTopic) {
    return res.status(400).json({ error: 'No topic or notes provided.' });
  }

  const prompt = `You are a study assistant. Create exactly ${cardCount} flashcards from the material below.
Return ONLY valid JSON, no markdown fences, no commentary, in this exact shape:
[{"front": "question or term", "back": "answer or definition"}, ...]

Rules:
- front should be short (a question or term)
- back should be short (a direct answer, 1-2 sentences max)
- cover the most important / testable points
- if the material is thin, it's fine to return fewer than ${cardCount}

Material:
"""
${cleanTopic}
"""`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || 'Gemini request failed';
      return res.status(geminiRes.status).json({ error: msg });
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

    let cards;
    try {
      cards = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'Model returned unparseable output. Try again.' });
    }

    if (!Array.isArray(cards)) {
      return res.status(502).json({ error: 'Unexpected response shape from model.' });
    }

    cards = cards
      .filter(c => c && c.front && c.back)
      .map(c => ({ front: String(c.front).slice(0, 500), back: String(c.back).slice(0, 500) }));

    return res.status(200).json({ cards });
  } catch (err) {
    return res.status(500).json({ error: 'Server error calling Gemini: ' + err.message });
  }
}
