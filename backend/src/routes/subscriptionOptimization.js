// Subscription optimization agent (frequency, add-ons, pauses).
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

router.post('/recommend', authenticateToken, async (req, res) => {
  try {
    const { customerId, currentFrequency = 'weekly', recentOrders = [], avgWeight, addOns = [] } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId required' });

    const utilization = recentOrders.length > 0
      ? recentOrders.filter(o => o.skipped !== true).length / recentOrders.length
      : 0.5;

    const recs = [];
    if (utilization < 0.4) recs.push({ change: 'reduce_frequency', from: currentFrequency, to: 'biweekly', reason: 'low utilization' });
    else if (utilization > 0.9 && avgWeight > 25) recs.push({ change: 'increase_frequency', from: currentFrequency, to: 'twice-weekly', reason: 'high utilization + heavy loads' });
    if (avgWeight > 30 && !addOns.includes('bulky-bag')) recs.push({ change: 'add_addon', addon: 'bulky-bag', reason: 'high avg weight' });

    let narrative = null;
    if (OPENROUTER_API_KEY) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: 'system', content: 'Write a friendly 2-sentence subscription tweak suggestion.' },
              { role: 'user', content: JSON.stringify({ recs, utilization, avgWeight }) }
            ],
            max_tokens: 200
          })
        });
        const d = await r.json();
        narrative = d.choices?.[0]?.message?.content;
      } catch {}
    }

    res.json({ customerId, utilization, recommendations: recs, narrative });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
