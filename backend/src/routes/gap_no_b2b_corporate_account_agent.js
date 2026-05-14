// // === Batch 10 Gaps & Frontend Mounts ===
// Batch 10 Gap: "No B2B / corporate account agent" (ai-gap) for laundryServices
// Mount path: /api/gap-no-b2b-corporate-account-agent
const express = require('express');
const router = express.Router();

const SLUG = "no-b2b-corporate-account-agent";
const LABEL = "No B2B / corporate account agent";
const SECTION = "ai-gap";

let _prisma = null;
function prismaClient() {
  if (_prisma) return _prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  } catch (_err) {
    _prisma = null;
  }
  return _prisma;
}

let _tableReady = false;
async function ensureGapFeatureTable() {
  if (_tableReady) return true;
  const prisma = prismaClient();
  if (!prisma || !prisma.$executeRawUnsafe) return false;
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "gap_features" (
      "id" SERIAL PRIMARY KEY,
      "slug" TEXT NOT NULL,
      "section" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "payload" JSONB,
      "result" JSONB,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    _tableReady = true;
    return true;
  } catch (_err) {
    return false;
  }
}

async function callOpenRouter(prompt, system) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku';
  if (!apiKey) {
    return { mocked: true, output: `[mock] ${LABEL}: ${String(prompt).slice(0, 240)}` };
  }
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [
          { role: 'system', content: system || `You assist with "${LABEL}" (${SECTION}).` },
          { role: 'user', content: String(prompt || '').slice(0, 4000) }
        ]
      })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { error: `openrouter ${resp.status}`, detail: text.slice(0, 200) };
    }
    const json = await resp.json();
    return { output: json.choices?.[0]?.message?.content || '', model };
  } catch (err) {
    return { error: 'openrouter_fetch_failed', detail: String(err).slice(0, 200) };
  }
}

router.get('/', (_req, res) => {
  res.json({ slug: SLUG, label: LABEL, section: SECTION, endpoints: ['GET /', 'POST /run', 'GET /history'] });
});

router.post('/run', async (req, res) => {
  const payload = req.body || {};
  const prompt = payload.prompt || payload.text || payload.input || `Outline an actionable plan for: ${LABEL}`;
  const ai = await callOpenRouter(prompt, payload.system);
  const record = { slug: SLUG, section: SECTION, label: LABEL, payload, result: ai, createdAt: new Date().toISOString() };
  const ok = await ensureGapFeatureTable();
  if (ok) {
    try {
      const prisma = prismaClient();
      await prisma.$executeRawUnsafe(
        'INSERT INTO "gap_features" ("slug","section","label","payload","result") VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)',
        SLUG, SECTION, LABEL, JSON.stringify(payload), JSON.stringify(ai)
      );
    } catch (_err) { /* persistence best-effort */ }
  }
  res.json(record);
});

router.get('/history', async (_req, res) => {
  const ok = await ensureGapFeatureTable();
  if (!ok) return res.json({ items: [] });
  try {
    const prisma = prismaClient();
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, slug, section, label, payload, result, "createdAt" FROM "gap_features" WHERE slug=$1 ORDER BY id DESC LIMIT 25',
      SLUG
    );
    res.json({ items: rows });
  } catch (_err) {
    res.json({ items: [] });
  }
});

module.exports = router;
