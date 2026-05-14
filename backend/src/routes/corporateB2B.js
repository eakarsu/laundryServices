// Corporate B2B agent (bulk orders, contract invoicing).
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const accounts = new Map();
const orders = [];
const invoices = [];

router.post('/accounts', authenticateToken, (req, res) => {
  const { id, name, contactEmail, paymentTerms = 'net30', tier = 'standard' } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  accounts.set(id, { id, name, contactEmail, paymentTerms, tier, createdAt: new Date() });
  res.json(accounts.get(id));
});

router.get('/accounts', authenticateToken, (_req, res) => res.json([...accounts.values()]));

router.post('/orders', authenticateToken, (req, res) => {
  const { accountId, items = [] } = req.body;
  const a = accounts.get(accountId);
  if (!a) return res.status(404).json({ error: 'account not found' });
  const total = items.reduce((s, it) => s + (it.unitPrice || 0) * (it.qty || 0), 0);
  const discount = a.tier === 'enterprise' ? 0.15 : a.tier === 'pro' ? 0.08 : 0;
  const order = { id: orders.length + 1, accountId, items, subtotal: total, discount, total: Math.round(total * (1 - discount) * 100) / 100, createdAt: new Date() };
  orders.push(order);
  res.json(order);
});

router.post('/invoices/generate', authenticateToken, (req, res) => {
  const { accountId, periodStart, periodEnd } = req.body;
  const a = accounts.get(accountId);
  if (!a) return res.status(404).json({ error: 'account not found' });
  const matching = orders.filter(o => {
    const d = new Date(o.createdAt);
    return o.accountId === accountId && (!periodStart || d >= new Date(periodStart)) && (!periodEnd || d <= new Date(periodEnd));
  });
  const total = matching.reduce((s, o) => s + o.total, 0);
  const invoice = {
    id: invoices.length + 1,
    accountId,
    periodStart,
    periodEnd,
    orderIds: matching.map(o => o.id),
    total,
    paymentTerms: a.paymentTerms,
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date()
  };
  invoices.push(invoice);
  res.json(invoice);
});

router.get('/invoices', authenticateToken, (_req, res) => res.json({ count: invoices.length, invoices }));

module.exports = router;
