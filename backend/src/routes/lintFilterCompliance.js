const express = require('express');
const router = express.Router();

let rows = [
  { id: 1, machine: 'Dryer-07', location: 'Plant A', lastCleaned: '2026-05-22 09:10', cycleCount: 18, operator: 'Maya', status: 'due soon' },
  { id: 2, machine: 'Dryer-11', location: 'Plant A', lastCleaned: '2026-05-22 11:30', cycleCount: 5, operator: 'Dev', status: 'clear' },
  { id: 3, machine: 'Dryer-03', location: 'Hotel line', lastCleaned: '2026-05-21 16:45', cycleCount: 31, operator: 'Rosa', status: 'overdue' }
];

router.get('/', (_req, res) => {
  const summary = rows.reduce((acc, row) => {
    acc.total += 1;
    acc.overdue += row.status === 'overdue' ? 1 : 0;
    acc.dueSoon += row.status === 'due soon' ? 1 : 0;
    return acc;
  }, { total: 0, overdue: 0, dueSoon: 0 });
  res.json({ rows, summary });
});

router.post('/', (req, res) => {
  const item = {
    id: Date.now(),
    machine: req.body.machine || 'Dryer TBD',
    location: req.body.location || 'Unassigned',
    lastCleaned: req.body.lastCleaned || new Date().toISOString(),
    cycleCount: Number(req.body.cycleCount || 0),
    operator: req.body.operator || 'Unassigned',
    status: req.body.status || 'due soon'
  };
  rows = [item, ...rows];
  res.status(201).json(item);
});

module.exports = router;
