const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'unit-test-secret-that-is-longer-than-thirty-two-characters';
process.env.JWT_ISSUER = 'laundry-unit';
process.env.JWT_AUDIENCE = 'laundry-unit-api';

const { canonical, sha256, ClaimWorkflowError } = require('../src/services/damageClaimWorkflow');
const { ProviderConfigurationError, providersFromEnvironment, requireHttpsUrl } = require('../src/services/claimProviders');
const { getJwtSecret, signToken, verifyToken } = require('../src/middleware/auth');

test('canonical serialization is stable across object key order', () => {
  assert.equal(canonical({ z: 1, a: { y: true, x: [2, 1] } }), canonical({ a: { x: [2, 1], y: true }, z: 1 }));
  assert.equal(sha256('evidence'), 'ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e');
});

test('workflow errors carry a stable code and HTTP status', () => {
  const error = new ClaimWorkflowError('VERSION_CONFLICT', 'reload', 409);
  assert.equal(error.code, 'VERSION_CONFLICT');
  assert.equal(error.status, 409);
});

test('provider URLs fail closed unless HTTPS is used', () => {
  assert.throws(() => requireHttpsUrl('OCR_URL', 'http://ocr.example.test'), ProviderConfigurationError);
  assert.equal(requireHttpsUrl('OCR_URL', 'https://ocr.example.test/'), 'https://ocr.example.test');
});

test('all provider credentials are required and short tokens are rejected', () => {
  assert.throws(() => providersFromEnvironment({}), ProviderConfigurationError);
  assert.throws(() => providersFromEnvironment({
    CLAIM_STORAGE_URL: 'https://provider.test', CLAIM_STORAGE_TOKEN: 'short',
  }), ProviderConfigurationError);
});

test('JWTs are issuer/audience bound and algorithm restricted', () => {
  const token = signToken({ id: 'actor-1', type: 'staff', role: 'ADMIN', ver: 1 }, '5m');
  assert.equal(verifyToken(token).id, 'actor-1');
  const [, payload, signature] = token.split('.');
  const alteredPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), aud: 'other-api' })).toString('base64url');
  assert.throws(() => verifyToken(`${token.split('.')[0]}.${alteredPayload}.${signature}`));
});

test('JWT secret has no development fallback', () => {
  const original = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  assert.throws(() => getJwtSecret(), /at least 32/);
  process.env.JWT_SECRET = 'secret';
  assert.throws(() => getJwtSecret(), /at least 32/);
  process.env.JWT_SECRET = original;
});
