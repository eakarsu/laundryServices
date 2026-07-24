'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { openRouterConfig, requestLaundryOperationsReadiness } = require('../src/services/openrouterEvidence');

test('requires the canonical OpenRouter endpoint', () => {
  assert.throws(() => openRouterConfig({ OPENROUTER_API_KEY: 'key', OPENROUTER_MODEL: 'model', OPENROUTER_BASE_URL: 'https://example.invalid' }), /must be https:\/\/openrouter\.ai\/api\/v1/);
});

test('returns substantive provider evidence', async () => {
  const prior = { key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL, base: process.env.OPENROUTER_BASE_URL };
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'test-model';
  process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
  try {
    const evidence = await requestLaundryOperationsReadiness('Deidentified administrative workflow evidence with human review.', async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(JSON.parse(options.body).model, 'test-model');
      return { ok: true, json: async () => ({ id: 'req_test', model: 'test-model', choices: [{ message: { content: 'Controls are traceable, exceptions are escalated, and qualified staff retain final authority.' } }] }) };
    });
    assert.equal(evidence.providerReceipt.requestId, 'req_test');
    assert.ok(evidence.result.length >= 40);
  } finally {
    process.env.OPENROUTER_API_KEY = prior.key;
    process.env.OPENROUTER_MODEL = prior.model;
    process.env.OPENROUTER_BASE_URL = prior.base;
  }
});
