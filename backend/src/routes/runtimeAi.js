'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requestLaundryOperationsReadiness } = require('../services/openrouterEvidence');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/operations-readiness', async (req, res) => {
  const workflowSummary = typeof req.body?.workflowSummary === 'string' ? req.body.workflowSummary.trim() : '';
  if (workflowSummary.length < 10 || workflowSummary.length > 1000) return res.status(400).json({ error: 'workflowSummary must contain 10-1000 characters' });
  try {
    const evidence = await requestLaundryOperationsReadiness(workflowSummary);
    const saved = await prisma.aIResult.create({
      data: {
        feature: 'operations-readiness',
        model: evidence.providerReceipt.model,
        userId: req.user.id,
        input: { workflowSummary },
        output: { result: evidence.result, providerReceipt: evidence.providerReceipt },
        success: true,
        latencyMs: evidence.latencyMs,
      },
      select: { id: true, createdAt: true },
    });
    return res.json({ analysisId: saved.id, createdAt: saved.createdAt, ...evidence });
  } catch (error) {
    console.error('[runtime-ai] operations readiness failed:', error.message);
    return res.status(502).json({ error: 'AI provider request failed' });
  }
});

module.exports = router;
