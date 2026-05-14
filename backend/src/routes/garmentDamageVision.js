// Vision-based garment damage assessment (shrinkage, fading, staining).
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

router.post('/assess', authenticateToken, async (req, res) => {
  try {
    const { imageUrl, garmentId, garmentType } = req.body;
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
            { type: 'text', text: `Garment: ${garmentType || 'unknown'}. Return JSON {"damage":[{"type":"shrinkage|fading|staining|tear|other","severity":"none|minor|moderate|severe","location":string}],"overall_condition":"excellent|good|fair|poor","reserveUSD":number}.` },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 500
      })
    });
    const d = await r.json();
    if (d.error) return res.status(502).json({ error: d.error.message });
    let parsed;
    try { parsed = JSON.parse(d.choices[0].message.content.match(/\{[\s\S]*\}/)[0]); } catch { parsed = { raw: d.choices[0].message.content }; }
    res.json({ garmentId, assessment: parsed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
