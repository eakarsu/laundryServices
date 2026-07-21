const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { DamageClaimWorkflow, ClaimWorkflowError } = require('../services/damageClaimWorkflow');
const { providersFromEnvironment } = require('../services/claimProviders');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

function unavailableProviders(error) {
  const reject = async () => { throw new ClaimWorkflowError('PROVIDER_NOT_CONFIGURED', error.message, 503); };
  return {
    storage: { put: reject, dispose: reject },
    ocr: { extract: reject },
    signature: { request: reject, status: reject },
    filing: { submit: reject },
    templates: { fetch: reject },
  };
}

let providers;
try {
  providers = providersFromEnvironment();
} catch (error) {
  if (process.env.NODE_ENV === 'production') throw error;
  providers = unavailableProviders(error);
}
const workflow = new DamageClaimWorkflow(prisma, providers);

const key = z.string().min(8).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);
const id = z.string().uuid();
const shortText = (maximum) => z.string().trim().min(1).max(maximum);
const timestamp = z.string().datetime({ offset: true });
const schemas = {
  template: z.object({ jurisdiction: shortText(20), asOf: timestamp.optional() }).strict(),
  claim: z.object({ orderId: id, jurisdiction: shortText(20), incidentDate: timestamp, title: shortText(160), idempotencyKey: key }).strict(),
  access: z.object({ actorType: z.enum(['staff', 'customer']), actorId: id, permission: z.enum(['EDITOR', 'REVIEWER', 'VIEWER']) }).strict(),
  revoke: z.object({ actorType: z.enum(['staff', 'customer']), actorId: id, reason: shortText(500) }).strict(),
  evidence: z.object({
    name: shortText(180),
    kind: shortText(60),
    contentBase64: z.string().min(4).max(7_000_000),
    redactedContentBase64: z.string().min(4).max(7_000_000).optional(),
    privileged: z.boolean().default(false),
    documentId: id.optional(),
    expectedVersion: z.number().int().positive().optional(),
    sourceReference: shortText(1_000).optional(),
    idempotencyKey: key,
  }).strict(),
  empty: z.object({}).strict(),
  review: z.object({ decision: z.enum(['APPROVE', 'REJECT']), jurisdictionChecked: z.boolean(), effectiveDateChecked: z.boolean(), notes: shortText(2_000) }).strict(),
  signature: z.object({ signerEmail: z.string().email().max(254), idempotencyKey: key }).strict(),
  reconcile: z.object({ providerRef: shortText(300) }).strict(),
  keyed: z.object({ idempotencyKey: key }).strict(),
  hold: z.object({ active: z.boolean(), reason: shortText(500) }).strict(),
  export: z.object({ includePrivileged: z.boolean().default(false), idempotencyKey: key }).strict(),
  retention: z.object({ asOf: timestamp.optional(), reason: shortText(500) }).strict(),
};

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: 'INVALID_INPUT',
      message: 'Request body failed validation',
      fields: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  req.body = result.data;
  return next();
};

const actorFrom = (req) => ({
  id: req.user.id,
  type: req.user.type,
  role: req.user.role,
});

const handle = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const status = error instanceof ClaimWorkflowError ? error.status : 500;
    res.status(status).json({
      error: error instanceof ClaimWorkflowError ? error.code : 'INTERNAL_ERROR',
      message: status === 500 ? 'Claim workflow failed' : error.message,
    });
  }
};

router.use(authenticateToken);

router.get('/', handle(async (req, res) => {
  const actor = actorFrom(req);
  const claims = await prisma.damageClaim.findMany({
    where: {
      access: { some: { actorType: actor.type, actorId: actor.id, revokedAt: null } },
      disposedAt: null,
    },
    select: {
      id: true, title: true, status: true, jurisdiction: true, incidentDate: true,
      retentionUntil: true, legalHold: true, orderId: true, version: true, updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ items: claims });
}));

router.post('/templates/import', validateBody(schemas.template), handle(async (req, res) => {
  const template = await workflow.importAuthoritativeTemplate(actorFrom(req), req.body);
  res.status(201).json(template);
}));

router.post('/', validateBody(schemas.claim), handle(async (req, res) => {
  const claim = await workflow.createClaim(actorFrom(req), req.body);
  res.status(201).json(claim);
}));

router.get('/:claimId', handle(async (req, res) => {
  const actor = actorFrom(req);
  const result = await prisma.$transaction(async (tx) => {
    const authorized = await workflow._authorize(tx, req.params.claimId, actor, ['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER']);
    const access = await tx.claimAccess.findUnique({
      where: { claimId_actorType_actorId: { claimId: authorized.id, actorType: actor.type, actorId: actor.id } },
    });
    const claim = await tx.damageClaim.findUnique({
      where: { id: authorized.id },
      include: {
        template: { select: { authority: true, sourceUri: true, jurisdiction: true, version: true, effectiveFrom: true, effectiveTo: true, contentHash: true } },
        documents: { include: { versions: { orderBy: { version: 'desc' } } } },
        reviews: { orderBy: { createdAt: 'desc' } },
        signatures: { orderBy: { createdAt: 'desc' } },
        audits: { select: { sequence: true, action: true, actorType: true, actorId: true, previousHash: true, eventHash: true, createdAt: true }, orderBy: { sequence: 'asc' } },
      },
    });
    return { claim, permission: access.permission };
  });
  const { claim } = result;
  const maySeePrivileged = actor.type === 'staff' && ['OWNER', 'REVIEWER'].includes(result.permission);
  claim.documents = claim.documents.map((document) => ({
    ...document,
    versions: document.versions.map((version) => document.privileged && !maySeePrivileged
      ? {
          id: version.id,
          documentId: version.documentId,
          version: version.version,
          contentHash: version.redactedContentHash,
          storageRef: version.redactedStorageRef,
          sourceProvider: version.sourceProvider,
          sourceReference: '[redacted]',
          ocrProvider: null,
          ocrReference: null,
          extractedText: null,
          createdById: version.createdById,
          createdAt: version.createdAt,
          redacted: true,
        }
      : { ...version, redacted: false }),
  }));
  res.json(claim);
}));

router.post('/:claimId/access', validateBody(schemas.access), handle(async (req, res) => {
  res.status(201).json(await workflow.grantAccess(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/access/revoke', validateBody(schemas.revoke), handle(async (req, res) => {
  res.json(await workflow.revokeAccess(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/evidence', validateBody(schemas.evidence), handle(async (req, res) => {
  res.status(201).json(await workflow.addEvidence(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/template-draft', validateBody(schemas.empty), handle(async (req, res) => {
  res.status(201).json(await workflow.createTemplateDraft(actorFrom(req), req.params.claimId));
}));

router.post('/:claimId/submit-review', validateBody(schemas.empty), handle(async (req, res) => {
  res.json(await workflow.submitForLegalReview(actorFrom(req), req.params.claimId));
}));

router.post('/:claimId/reviews', validateBody(schemas.review), handle(async (req, res) => {
  res.status(201).json(await workflow.reviewClaim(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/signatures', validateBody(schemas.signature), handle(async (req, res) => {
  res.status(201).json(await workflow.requestSignature(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/signatures/reconcile', validateBody(schemas.reconcile), handle(async (req, res) => {
  res.json(await workflow.recordSigned(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/file', validateBody(schemas.keyed), handle(async (req, res) => {
  res.json(await workflow.fileClaim(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/legal-hold', validateBody(schemas.hold), handle(async (req, res) => {
  res.json(await workflow.setLegalHold(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/exports', validateBody(schemas.export), handle(async (req, res) => {
  res.status(201).json(await workflow.exportClaim(actorFrom(req), req.params.claimId, req.body));
}));

router.post('/:claimId/retention/dispose', validateBody(schemas.retention), handle(async (req, res) => {
  res.json(await workflow.enforceRetention(actorFrom(req), req.params.claimId, req.body));
}));

router.get('/:claimId/audit/verify', handle(async (req, res) => {
  res.json(await workflow.verifyAudit(actorFrom(req), req.params.claimId));
}));

router.close = () => prisma.$disconnect();

module.exports = router;
