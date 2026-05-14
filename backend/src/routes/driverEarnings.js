// Driver-earnings optimizer + tips fairness model.
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/optimize', authenticateToken, (req, res) => {
  try {
    const { driverId, routes = [], baseRatePerStop = 4 } = req.body;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    let totalStops = 0, totalMiles = 0;
    for (const r of routes) { totalStops += r.stops || 0; totalMiles += r.miles || 0; }
    const baseEarnings = totalStops * baseRatePerStop + totalMiles * 0.585; // IRS-ish per-mile
    const productivity = totalStops / Math.max(1, totalMiles); // stops per mile
    const bonus = productivity > 0.5 ? Math.round(baseEarnings * 0.1) : 0;
    res.json({
      driverId,
      totalStops,
      totalMiles,
      baseEarnings: Math.round(baseEarnings),
      bonus,
      projectedEarnings: Math.round(baseEarnings + bonus)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tips-fairness', authenticateToken, (req, res) => {
  // Pool tips proportionally to stops handled by each driver.
  const { drivers, totalTipsPoolUSD } = req.body;
  if (!Array.isArray(drivers) || totalTipsPoolUSD == null) return res.status(400).json({ error: 'drivers[] and totalTipsPoolUSD required' });
  const totalStops = drivers.reduce((s, d) => s + (d.stops || 0), 0) || 1;
  const allocation = drivers.map(d => ({ driverId: d.id, stops: d.stops || 0, share: Math.round(totalTipsPoolUSD * (d.stops || 0) / totalStops * 100) / 100 }));
  res.json({ allocation, totalPool: totalTipsPoolUSD });
});

module.exports = router;
