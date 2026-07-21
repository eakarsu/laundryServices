const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for claims E2E tests');
process.env.JWT_SECRET ||= 'e2e-test-secret-that-is-longer-than-thirty-two-characters';
process.env.JWT_ISSUER ||= 'laundry-e2e';
process.env.JWT_AUDIENCE ||= 'laundry-e2e-api';
process.env.CLAIM_STORAGE_URL = 'https://provider.test/storage';
process.env.CLAIM_STORAGE_TOKEN = 'storage-provider-test-token';
process.env.CLAIM_OCR_URL = 'https://provider.test/ocr';
process.env.CLAIM_OCR_TOKEN = 'ocr-provider-test-token';
process.env.CLAIM_ESIGN_URL = 'https://provider.test/esign';
process.env.CLAIM_ESIGN_TOKEN = 'esign-provider-test-token';
process.env.CLAIM_FILING_URL = 'https://provider.test/filing';
process.env.CLAIM_FILING_TOKEN = 'filing-provider-test-token';
process.env.CLAIM_TEMPLATE_URL = 'https://provider.test/templates';
process.env.CLAIM_TEMPLATE_TOKEN = 'template-provider-test-token';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nativeFetch = global.fetch;
const storedObjects = new Map();
const signatureStates = new Map();
let objectSequence = 0;
let envelopeSequence = 0;
let dispositionCalls = 0;

const templateBody = 'Damage claim {{claimId}} for order {{orderId}} in {{jurisdiction}} on {{incidentDate}}.';
const templateHash = crypto.createHash('sha256').update(templateBody).digest('hex');

global.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  if (url.hostname !== 'provider.test') return nativeFetch(input, options);
  const body = options.body ? JSON.parse(options.body) : {};
  let result;
  if (url.pathname.endsWith('/v1/templates/resolve')) {
    result = {
      provider: 'test-template-registry', authority: 'State Consumer Claims Authority', sourceUri: 'https://authority.example.test/claims/v1',
      jurisdiction: body.jurisdiction, version: '2025.1', effectiveFrom: '2018-01-01T00:00:00.000Z', effectiveTo: null,
      body: templateBody, contentHash: templateHash,
    };
  } else if (url.pathname.endsWith('/v1/objects')) {
    const reference = `object-${++objectSequence}`;
    storedObjects.set(reference, body);
    result = { provider: 'test-storage', reference };
  } else if (url.pathname.endsWith('/v1/dispositions')) {
    dispositionCalls += 1;
    result = { provider: 'test-storage', reference: `disposition-${dispositionCalls}` };
  } else if (url.pathname.endsWith('/v1/extractions')) {
    result = { provider: 'test-ocr', reference: `ocr-${body.contentHash.slice(0, 12)}`, text: 'verified garment damage evidence' };
  } else if (url.pathname.endsWith('/v1/envelopes/status')) {
    const state = signatureStates.get(body.providerRef) || { status: 'PENDING' };
    result = { provider: 'test-esign', reference: body.providerRef, ...state };
  } else if (url.pathname.endsWith('/v1/envelopes')) {
    const reference = `envelope-${++envelopeSequence}`;
    signatureStates.set(reference, { status: 'PENDING' });
    result = { provider: 'test-esign', reference };
  } else if (url.pathname.endsWith('/v1/submissions')) {
    result = { provider: 'test-filing', reference: `filing-${body.manifestHash.slice(0, 12)}` };
  } else {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
};

const authRoutes = require('../src/routes/auth');
const damageClaimRoutes = require('../src/routes/damageClaims');
const { disconnectAuthPrisma } = require('../src/middleware/auth');

function request(baseUrl, path, { method = 'GET', token, body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (response) => ({ status: response.status, headers: response.headers, body: await response.json() }));
}

test('damage claim journey enforces provenance, review, signature, export, revocation, and retention', async (t) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = 'Strong!Claim123';
  const passwordHash = await bcrypt.hash(password, 4);
  const customer = await prisma.customer.create({
    data: { email: `customer-${suffix}@example.test`, firstName: 'Case', lastName: 'Customer', passwordHash },
  });
  const admin = await prisma.staff.create({
    data: { email: `admin-${suffix}@example.test`, firstName: 'Ada', lastName: 'Admin', passwordHash, role: 'ADMIN' },
  });
  const reviewer = await prisma.staff.create({
    data: { email: `reviewer-${suffix}@example.test`, firstName: 'Rae', lastName: 'Reviewer', passwordHash, role: 'LEGAL_REVIEWER' },
  });
  const viewer = await prisma.staff.create({
    data: { email: `viewer-${suffix}@example.test`, firstName: 'Vic', lastName: 'Viewer', passwordHash, role: 'CLERK' },
  });
  const order = await prisma.order.create({ data: { orderNumber: `ORD-${suffix}`, customerId: customer.id } });

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/damage-claims', damageClaimRoutes);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([prisma.$disconnect(), authRoutes.close(), damageClaimRoutes.close(), disconnectAuthPrisma()]);
  });

  const login = async (kind, email) => {
    const response = await request(baseUrl, `/api/auth/${kind === 'staff' ? 'staff/' : ''}login`, { method: 'POST', body: { email, password } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.token;
  };
  const adminToken = await login('staff', admin.email);
  const reviewerToken = await login('staff', reviewer.email);
  const viewerToken = await login('staff', viewer.email);
  const customerToken = await login('customer', customer.email);

  let response = await request(baseUrl, '/api/damage-claims/templates/import', {
    method: 'POST', token: adminToken, body: { jurisdiction: 'NY', asOf: '2019-05-10T00:00:00.000Z' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.contentHash, templateHash);

  const createBody = {
    orderId: order.id, jurisdiction: 'NY', incidentDate: '2019-05-10T12:00:00.000Z', title: 'Damaged wool coat', idempotencyKey: `claim:${suffix}`,
  };
  response = await request(baseUrl, '/api/damage-claims', { method: 'POST', token: adminToken, body: createBody });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const claimId = response.body.id;
  const replay = await request(baseUrl, '/api/damage-claims', { method: 'POST', token: adminToken, body: createBody });
  assert.equal(replay.status, 201);
  assert.equal(replay.body.id, claimId);
  const replayConflict = await request(baseUrl, '/api/damage-claims', { method: 'POST', token: adminToken, body: { ...createBody, title: 'Different claim' } });
  assert.equal(replayConflict.status, 409);

  for (const grant of [
    { actorType: 'staff', actorId: reviewer.id, permission: 'REVIEWER' },
    { actorType: 'staff', actorId: viewer.id, permission: 'VIEWER' },
  ]) {
    response = await request(baseUrl, `/api/damage-claims/${claimId}/access`, { method: 'POST', token: adminToken, body: grant });
    assert.equal(response.status, 201, JSON.stringify(response.body));
  }

  const original = Buffer.from('Customer account 9988; coat has a torn sleeve').toString('base64');
  const redacted = Buffer.from('Customer account [REDACTED]; coat has a torn sleeve').toString('base64');
  const evidenceBody = {
    name: 'Damage intake', kind: 'CUSTOMER_EVIDENCE', privileged: true, contentBase64: original,
    redactedContentBase64: redacted, sourceReference: 'laundry-order-intake', idempotencyKey: `evidence:${suffix}:1`,
  };
  response = await request(baseUrl, `/api/damage-claims/${claimId}/evidence`, { method: 'POST', token: adminToken, body: evidenceBody });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const documentId = response.body.document.id;
  const originalStorageRef = response.body.version.storageRef;
  const redactedStorageRef = response.body.version.redactedStorageRef;
  assert.notEqual(originalStorageRef, redactedStorageRef);
  const evidenceReplay = await request(baseUrl, `/api/damage-claims/${claimId}/evidence`, { method: 'POST', token: adminToken, body: evidenceBody });
  assert.equal(evidenceReplay.body.version.id, response.body.version.id);

  const versionBody = {
    ...evidenceBody, contentBase64: Buffer.from('Corrected original evidence').toString('base64'),
    redactedContentBase64: Buffer.from('Corrected redacted evidence').toString('base64'), documentId,
    expectedVersion: 9, idempotencyKey: `evidence:${suffix}:2`,
  };
  const versionConflict = await request(baseUrl, `/api/damage-claims/${claimId}/evidence`, { method: 'POST', token: adminToken, body: versionBody });
  assert.equal(versionConflict.status, 409);
  response = await request(baseUrl, `/api/damage-claims/${claimId}/evidence`, { method: 'POST', token: adminToken, body: { ...versionBody, expectedVersion: 1 } });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.version.version, 2);
  const latestOriginalStorageRef = response.body.version.storageRef;
  const latestRedactedStorageRef = response.body.version.redactedStorageRef;

  response = await request(baseUrl, `/api/damage-claims/${claimId}`, { token: customerToken });
  assert.equal(response.status, 200);
  const customerDocument = response.body.documents.find((document) => document.id === documentId);
  assert.equal(customerDocument.versions[0].redacted, true);
  assert.equal(customerDocument.versions[0].storageRef, latestRedactedStorageRef);
  assert.notEqual(customerDocument.versions[0].storageRef, latestOriginalStorageRef);
  assert.equal(customerDocument.versions[0].extractedText, null);

  response = await request(baseUrl, '/api/damage-claims', { token: customerToken });
  assert.equal(response.status, 200);
  assert.ok(response.body.items.some((claim) => claim.id === claimId));

  response = await request(baseUrl, `/api/damage-claims/${claimId}/access/revoke`, {
    method: 'POST', token: adminToken, body: { actorType: 'staff', actorId: viewer.id, reason: 'Assignment ended' },
  });
  assert.equal(response.status, 200);
  response = await request(baseUrl, `/api/damage-claims/${claimId}`, { token: viewerToken });
  assert.equal(response.status, 403);
  await prisma.staff.update({ where: { id: viewer.id }, data: { authVersion: { increment: 1 } } });
  response = await request(baseUrl, '/api/damage-claims', { token: viewerToken });
  assert.equal(response.status, 401);

  response = await request(baseUrl, `/api/damage-claims/${claimId}/template-draft`, { method: 'POST', token: adminToken, body: {} });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  response = await request(baseUrl, `/api/damage-claims/${claimId}/submit-review`, { method: 'POST', token: adminToken, body: {} });
  assert.equal(response.status, 200);
  const invalidReview = await request(baseUrl, `/api/damage-claims/${claimId}/reviews`, {
    method: 'POST', token: reviewerToken, body: { decision: 'APPROVE', jurisdictionChecked: false, effectiveDateChecked: true, notes: 'Not validated' },
  });
  assert.equal(invalidReview.status, 422);
  response = await request(baseUrl, `/api/damage-claims/${claimId}/reviews`, {
    method: 'POST', token: reviewerToken, body: { decision: 'APPROVE', jurisdictionChecked: true, effectiveDateChecked: true, notes: 'Reviewed against New York template and incident date.' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  response = await request(baseUrl, `/api/damage-claims/${claimId}/signatures`, {
    method: 'POST', token: adminToken, body: { signerEmail: customer.email, idempotencyKey: `sign:${suffix}:1` },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  signatureStates.set(response.body.providerRef, { status: 'FAILED', failureCode: 'SIGNER_DECLINED' });
  response = await request(baseUrl, `/api/damage-claims/${claimId}/signatures/reconcile`, {
    method: 'POST', token: adminToken, body: { providerRef: response.body.providerRef },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'FAILED');

  response = await request(baseUrl, `/api/damage-claims/${claimId}/signatures`, {
    method: 'POST', token: adminToken, body: { signerEmail: customer.email, idempotencyKey: `sign:${suffix}:2` },
  });
  assert.equal(response.status, 201);
  const successfulEnvelope = response.body.providerRef;
  signatureStates.set(successfulEnvelope, { status: 'SIGNED', signedAt: '2026-01-15T12:00:00.000Z' });
  response = await request(baseUrl, `/api/damage-claims/${claimId}/signatures/reconcile`, {
    method: 'POST', token: adminToken, body: { providerRef: successfulEnvelope },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'SIGNED');

  response = await request(baseUrl, `/api/damage-claims/${claimId}/file`, {
    method: 'POST', token: adminToken, body: { idempotencyKey: `file:${suffix}` },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'FILED');

  response = await request(baseUrl, `/api/damage-claims/${claimId}/exports`, {
    method: 'POST', token: customerToken, body: { includePrivileged: false, idempotencyKey: `export:${suffix}` },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const exportObject = storedObjects.get(response.body.storageRef);
  const exportedManifest = JSON.parse(Buffer.from(exportObject.contentBase64, 'base64').toString());
  const exportedPrivileged = exportedManifest.documents.filter((document) => document.privileged);
  assert.ok(exportedPrivileged.length >= 1);
  assert.ok(exportedPrivileged.every((document) => document.redacted));
  const exportedEvidence = exportedManifest.documents.find((document) => document.id === documentId);
  assert.equal(exportedEvidence.storageRef, latestRedactedStorageRef);
  assert.notEqual(exportedEvidence.storageRef, latestOriginalStorageRef);

  response = await request(baseUrl, `/api/damage-claims/${claimId}/legal-hold`, {
    method: 'POST', token: adminToken, body: { active: true, reason: 'Customer appeal received' },
  });
  assert.equal(response.status, 200);
  const heldDisposition = await request(baseUrl, `/api/damage-claims/${claimId}/retention/dispose`, {
    method: 'POST', token: adminToken, body: { reason: 'Scheduled retention run' },
  });
  assert.equal(heldDisposition.status, 409);
  response = await request(baseUrl, `/api/damage-claims/${claimId}/legal-hold`, {
    method: 'POST', token: adminToken, body: { active: false, reason: 'Appeal resolved' },
  });
  assert.equal(response.status, 200);
  response = await request(baseUrl, `/api/damage-claims/${claimId}/retention/dispose`, {
    method: 'POST', token: adminToken, body: { reason: 'Retention period elapsed' },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body.disposedAt);
  assert.equal(dispositionCalls, 1);

  response = await request(baseUrl, `/api/damage-claims/${claimId}/audit/verify`, { token: adminToken });
  assert.equal(response.status, 200);
  assert.equal(response.body.valid, true);
  assert.ok(response.body.checked >= 15);

  const event = await prisma.claimAuditEvent.findFirst({ where: { claimId } });
  await assert.rejects(() => prisma.claimAuditEvent.update({ where: { id: event.id }, data: { action: 'TAMPERED' } }), /append-only/);
  const version = await prisma.claimDocumentVersion.findFirst({ where: { document: { claimId } } });
  await assert.rejects(() => prisma.claimDocumentVersion.delete({ where: { id: version.id } }), /append-only/);
});
