// Sustainability dashboard (water, energy, chemical per customer / region).
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// In-memory consumption log.
const logs = [];

// Each kg of laundry: ~10L water, ~0.4 kWh, 0.02L detergent (industry rough averages).
const FACTORS = { waterLitersPerKg: 10, energyKwhPerKg: 0.4, detergentLitersPerKg: 0.02, co2KgPerKwh: 0.4 };

router.post('/log', authenticateToken, (req, res) => {
  const { facilityId, dateISO, kgProcessed, customers = [] } = req.body;
  if (!facilityId || kgProcessed == null) return res.status(400).json({ error: 'facilityId and kgProcessed required' });
  const entry = {
    id: logs.length + 1,
    facilityId,
    dateISO: dateISO || new Date().toISOString().slice(0, 10),
    kgProcessed: Number(kgProcessed),
    waterL: Number(kgProcessed) * FACTORS.waterLitersPerKg,
    energyKwh: Number(kgProcessed) * FACTORS.energyKwhPerKg,
    detergentL: Number(kgProcessed) * FACTORS.detergentLitersPerKg,
    co2Kg: Number(kgProcessed) * FACTORS.energyKwhPerKg * FACTORS.co2KgPerKwh,
    customers
  };
  logs.push(entry);
  res.json(entry);
});

router.get('/facility/:facilityId', authenticateToken, (req, res) => {
  const rows = logs.filter(l => l.facilityId === req.params.facilityId);
  if (!rows.length) return res.json({ facilityId: req.params.facilityId, totals: null });
  const totals = rows.reduce((acc, r) => ({
    kgProcessed: acc.kgProcessed + r.kgProcessed,
    waterL: acc.waterL + r.waterL,
    energyKwh: acc.energyKwh + r.energyKwh,
    detergentL: acc.detergentL + r.detergentL,
    co2Kg: acc.co2Kg + r.co2Kg
  }), { kgProcessed: 0, waterL: 0, energyKwh: 0, detergentL: 0, co2Kg: 0 });
  res.json({ facilityId: req.params.facilityId, totals, rows: rows.slice(-30) });
});

router.get('/customer/:customerId', authenticateToken, (req, res) => {
  let kg = 0;
  for (const l of logs) {
    if ((l.customers || []).includes(req.params.customerId)) kg += l.kgProcessed / Math.max(1, l.customers.length);
  }
  res.json({
    customerId: req.params.customerId,
    estimatedKg: Math.round(kg),
    waterL: Math.round(kg * FACTORS.waterLitersPerKg),
    energyKwh: Math.round(kg * FACTORS.energyKwhPerKg * 10) / 10,
    co2Kg: Math.round(kg * FACTORS.energyKwhPerKg * FACTORS.co2KgPerKwh * 10) / 10
  });
});

module.exports = router;
