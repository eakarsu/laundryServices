/**
 * AI helpers shared across all AI routes.
 *
 * Exposes:
 *  - callOpenRouter(messages, opts):    chat completion via OpenRouter
 *  - parseAIJson(raw):                   3-strategy JSON parser
 *  - persistAIResult(prisma, payload):   write to ai_results JSONB table
 *  - aiRateLimiter:                       express-rate-limit, 20/hr by user
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const DEFAULT_VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REFERER = process.env.OPENROUTER_REFERER || process.env.PUBLIC_URL || 'http://localhost:3001';
const APP_TITLE = 'Laundry Services AI';

/**
 * Call OpenRouter chat completions.
 *
 * @param {Array} messages
 * @param {Object} opts {model, maxTokens, temperature}
 * @returns {Promise<string>} content of choices[0].message
 */
async function callOpenRouter(messages, opts = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your-openrouter-api-key') {
    const err = new Error('OpenRouter API key not configured');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  const model = opts.model || DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 1000;
  const temperature = opts.temperature ?? 0.4;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': APP_TITLE,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`OpenRouter API error ${response.status}: ${text}`);
    err.code = 'AI_API_ERROR';
    throw err;
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

/**
 * 3-strategy JSON parser:
 *   1) parse the whole string
 *   2) strip ```json fences and parse
 *   3) regex-extract first balanced {...} or [...] and parse
 *
 * Throws if all strategies fail.
 */
function parseAIJson(raw) {
  if (raw == null) throw new Error('parseAIJson: empty input');
  const text = typeof raw === 'string' ? raw : String(raw);

  // Strategy 1: direct
  try {
    return JSON.parse(text.trim());
  } catch (_) {}

  // Strategy 2: strip fenced code blocks
  const fenced = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(fenced);
  } catch (_) {}

  // Strategy 3: find first {...} or [...] block (multi-line, greedy)
  const objMatch = fenced.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch (_) {}
  }
  const arrMatch = fenced.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch (_) {}
  }

  const err = new Error('parseAIJson: failed all 3 strategies');
  err.raw = text.slice(0, 500);
  throw err;
}

/**
 * Persist a single AI result row in ai_results JSONB-backed Prisma table.
 *
 * @param {PrismaClient} prisma
 * @param {{feature:string, model?:string, userId?:string, input:any, output:any, success:boolean, errorMessage?:string, latencyMs?:number}}
 */
async function persistAIResult(prisma, payload) {
  if (!prisma?.aIResult?.create) return null;
  try {
    return await prisma.aIResult.create({
      data: {
        feature: payload.feature,
        model: payload.model || DEFAULT_MODEL,
        userId: payload.userId || null,
        input: payload.input ?? {},
        output: payload.output ?? null,
        success: payload.success !== false,
        errorMessage: payload.errorMessage || null,
        latencyMs: payload.latencyMs || null,
      },
    });
  } catch (err) {
    console.warn('persistAIResult failed:', err.message);
    return null;
  }
}

/**
 * Rate limiter: 20 AI calls per hour per authenticated user (IP fallback).
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.user?.id ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req, res)}`;
  },
  message: { error: 'AI rate limit exceeded — 20 requests per hour per user' },
});

module.exports = {
  callOpenRouter,
  parseAIJson,
  persistAIResult,
  aiRateLimiter,
  DEFAULT_MODEL,
  DEFAULT_VISION_MODEL,
};
