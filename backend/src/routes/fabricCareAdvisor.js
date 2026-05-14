// Fabric care advisor (care label OCR → instructions + warnings).
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

// POST /api/fabric-care/decode-label — extract care symbols from a label photo.
router.post('/decode-label', authenticateToken, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
    if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Read the care label. Return JSON {"fabric":string,"wash":string,"bleach":string,"dry":string,"iron":string,"dry_clean":string,"warnings":[string]}.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 400
      })
    });
    const d = await r.json();
    if (d.error) return res.status(502).json({ error: d.error.message });
    let parsed;
    try { parsed = JSON.parse(d.choices[0].message.content.match(/\{[\s\S]*\}/)[0]); } catch { parsed = { raw: d.choices[0].message.content }; }
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fabric-care/advise — text-only advice for a known garment.
router.post('/advise', authenticateToken, async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
  const { garment, fabric, color, stains } = req.body;
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'You are a textile care specialist. Return JSON {"steps":[string],"avoid":[string],"risk_level":"low|medium|high"}.' },
        { role: 'user', content: `Garment: ${garment}\nFabric: ${fabric}\nColor: ${color}\nStains: ${(stains || []).join(', ')}` }
      ],
      max_tokens: 400
    })
  });
  const d = await r.json();
  res.json({ raw: d.choices?.[0]?.message?.content });
});

module.exports = router;
