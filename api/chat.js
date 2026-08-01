// Chat proxy for the Imara Digital site assistant.
// The API key lives in the ANTHROPIC_API_KEY environment variable on Vercel —
// never in this file. Requests are locked to our own domain and the model,
// token budget and conversation length are fixed here rather than trusted
// from the browser, so nobody can point a script at this endpoint and spend
// our credits.

const ALLOWED_ORIGINS = [
  'https://www.imaradigital.digital',
  'https://imaradigital.digital'
];

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;
const MAX_MESSAGES = 40;
const MAX_CHARS = 12000;

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Block anything not coming from our own pages.
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const messages = req.body && req.body.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Bad request' });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Conversation too long' });
  }

  const totalChars = messages.reduce(
    (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
    0
  );
  if (totalChars > MAX_CHARS) {
    return res.status(400).json({ error: 'Conversation too long' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      // Model and max_tokens are set here, not taken from the caller.
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages })
    });

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'API call failed' });
  }
}
