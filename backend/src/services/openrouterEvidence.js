'use strict';

const CANONICAL_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function openRouterConfig(env = process.env) {
  const apiKey = (env.OPENROUTER_API_KEY || '').trim();
  const model = (env.OPENROUTER_MODEL || '').trim();
  const baseUrl = (env.OPENROUTER_BASE_URL || '').replace(/\/$/, '');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');
  if (!model) throw new Error('OPENROUTER_MODEL is required');
  if (baseUrl !== CANONICAL_OPENROUTER_BASE_URL) throw new Error(`OPENROUTER_BASE_URL must be ${CANONICAL_OPENROUTER_BASE_URL}`);
  return { apiKey, model, baseUrl };
}

async function requestLaundryOperationsReadiness(workflowSummary, request = fetch) {
  const config = openRouterConfig();
  const startedAt = Date.now();
  const response = await request(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://127.0.0.1',
      'X-Title': 'Laundry Services Operations Readiness',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: 'system', content: 'Review deidentified laundry-service administrative controls for traceability, authorization, evidence retention, exception handling, and qualified human review. Do not approve or reject claims, determine liability, make legal conclusions, or invent customer facts. Return concise operational readiness findings.' },
        { role: 'user', content: workflowSummary },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}`);
  const data = await response.json();
  const result = data?.choices?.[0]?.message?.content?.trim();
  const requestId = data?.id;
  const providerModel = data?.model || config.model;
  if (!requestId || !result || result.length < 40) throw new Error('OpenRouter returned incomplete evidence');
  return {
    result,
    latencyMs: Date.now() - startedAt,
    providerReceipt: { provider: 'openrouter', requestId, model: providerModel, created: data?.created || null, usage: data?.usage || null },
  };
}

module.exports = { CANONICAL_OPENROUTER_BASE_URL, openRouterConfig, requestLaundryOperationsReadiness };
