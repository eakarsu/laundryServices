const crypto = require('crypto');

class ClaimWorkflowError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertActor(actor) {
  if (!actor || !actor.id || !['customer', 'staff'].includes(actor.type)) {
    throw new ClaimWorkflowError('INVALID_ACTOR', 'A current customer or staff identity is required', 401);
  }
}

function assertText(name, value, maximum = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new ClaimWorkflowError('INVALID_INPUT', `${name} is required and must be at most ${maximum} characters`);
  }
  return value.trim();
}

function decodeBase64(name, value, maximum = 5 * 1024 * 1024) {
  if (typeof value !== 'string' || !value.length || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new ClaimWorkflowError('INVALID_CONTENT', `${name} must be canonical base64`);
  }
  const content = Buffer.from(value, 'base64');
  if (!content.length || content.length > maximum || content.toString('base64') !== value) {
    throw new ClaimWorkflowError('INVALID_CONTENT', `${name} must be between 1 byte and ${maximum} bytes`);
  }
  return content;
}

class DamageClaimWorkflow {
  constructor(prisma, providers, options = {}) {
    this.prisma = prisma;
    this.providers = providers;
    this.retentionYears = options.retentionYears || 6;
  }

  async importAuthoritativeTemplate(actor, { jurisdiction, asOf }) {
    assertActor(actor);
    if (actor.type !== 'staff' || !['ADMIN', 'MANAGER'].includes(actor.role)) {
      throw new ClaimWorkflowError('FORBIDDEN', 'Template import requires an administrator or manager', 403);
    }
    jurisdiction = assertText('jurisdiction', jurisdiction, 20).toUpperCase();
    const effectiveAt = new Date(asOf || Date.now());
    if (Number.isNaN(effectiveAt.getTime())) throw new ClaimWorkflowError('INVALID_DATE', 'asOf is invalid');
    const result = await this.providers.templates.fetch({
      jurisdiction,
      asOf: effectiveAt.toISOString(),
      idempotencyKey: `template:${jurisdiction}:${effectiveAt.toISOString().slice(0, 10)}`,
    });
    const body = assertText('template body', result.body, 200_000);
    const contentHash = sha256(body);
    if (contentHash !== result.contentHash || !String(result.sourceUri || '').startsWith('https://')) {
      throw new ClaimWorkflowError('UNTRUSTED_TEMPLATE', 'Template source URI or content digest is invalid', 422);
    }
    const from = new Date(result.effectiveFrom);
    const to = result.effectiveTo ? new Date(result.effectiveTo) : null;
    if (Number.isNaN(from.getTime()) || (to && Number.isNaN(to.getTime()))) {
      throw new ClaimWorkflowError('INVALID_TEMPLATE_DATES', 'Template effective dates are invalid', 422);
    }
    const authority = assertText('authority', result.authority, 120);
    const version = assertText('version', result.version, 80);
    const existing = await this.prisma.claimTemplate.findUnique({
      where: { authority_jurisdiction_version: { authority, jurisdiction, version } },
    });
    if (existing) {
      if (existing.contentHash !== contentHash || existing.sourceUri !== result.sourceUri
        || existing.effectiveFrom.getTime() !== from.getTime()
        || (existing.effectiveTo?.getTime() || null) !== (to?.getTime() || null)) {
        throw new ClaimWorkflowError('TEMPLATE_VERSION_CONFLICT', 'An authoritative template version cannot be replaced with different content or dates', 409);
      }
      return existing;
    }
    return this.prisma.claimTemplate.create({
      data: { authority, sourceUri: result.sourceUri, jurisdiction, version, effectiveFrom: from, effectiveTo: to, contentHash, body },
    });
  }

  async createClaim(actor, input) {
    assertActor(actor);
    const idempotencyKey = assertText('idempotencyKey', input.idempotencyKey, 120);
    const existing = await this.prisma.damageClaim.findUnique({ where: { idempotencyKey } });
    if (existing) {
      const replayIncidentDate = new Date(input.incidentDate);
      if (existing.orderId !== input.orderId || existing.jurisdiction !== String(input.jurisdiction || '').trim().toUpperCase()
        || existing.title !== String(input.title || '').trim() || existing.incidentDate.getTime() !== replayIncidentDate.getTime()) {
        throw new ClaimWorkflowError('IDEMPOTENCY_CONFLICT', 'Idempotency key was used for a different claim request', 409);
      }
      await this.prisma.$transaction((tx) => this._authorize(tx, existing.id, actor, ['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER']));
      return existing;
    }
    const jurisdiction = assertText('jurisdiction', input.jurisdiction, 20).toUpperCase();
    const title = assertText('title', input.title, 160);
    const incidentDate = new Date(input.incidentDate);
    if (Number.isNaN(incidentDate.getTime()) || incidentDate > new Date()) {
      throw new ClaimWorkflowError('INVALID_INCIDENT_DATE', 'Incident date must be valid and not in the future');
    }
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { id: true, customerId: true } });
      if (!order) throw new ClaimWorkflowError('ORDER_NOT_FOUND', 'Order not found', 404);
      if (actor.type === 'customer' && actor.id !== order.customerId) {
        throw new ClaimWorkflowError('FORBIDDEN', 'Customers may only create claims for their own orders', 403);
      }
      const template = await tx.claimTemplate.findFirst({
        where: {
          jurisdiction,
          active: true,
          effectiveFrom: { lte: incidentDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: incidentDate } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!template) {
        throw new ClaimWorkflowError('TEMPLATE_NOT_FOUND', 'No authoritative template covers this jurisdiction and incident date', 409);
      }
      const retentionUntil = new Date(incidentDate);
      retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + this.retentionYears);
      const claim = await tx.damageClaim.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          createdById: actor.id,
          createdByType: actor.type,
          jurisdiction,
          incidentDate,
          title,
          idempotencyKey,
          status: 'EVIDENCE_PENDING',
          templateId: template.id,
          templateVersion: template.version,
          retentionUntil,
        },
      });
      await tx.claimAccess.create({
        data: {
          claimId: claim.id,
          actorType: actor.type,
          actorId: actor.id,
          permission: 'OWNER',
          grantedBy: actor.id,
        },
      });
      if (actor.type === 'staff') {
        await tx.claimAccess.create({
          data: {
            claimId: claim.id,
            actorType: 'customer',
            actorId: order.customerId,
            permission: 'OWNER',
            grantedBy: actor.id,
          },
        });
      }
      await this._audit(tx, claim.id, actor, 'CLAIM_CREATED', {
        orderId: order.id,
        jurisdiction,
        templateId: template.id,
        templateVersion: template.version,
        retentionUntil: retentionUntil.toISOString(),
      });
      return claim;
    });
  }

  async grantAccess(actor, claimId, input) {
    assertActor(actor);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER']);
      if (!['staff', 'customer'].includes(input.actorType) || !input.actorId) {
        throw new ClaimWorkflowError('INVALID_GRANTEE', 'A valid actor type and id are required');
      }
      if (!['EDITOR', 'REVIEWER', 'VIEWER'].includes(input.permission)) {
        throw new ClaimWorkflowError('INVALID_PERMISSION', 'Permission is invalid');
      }
      const grantee = input.actorType === 'staff'
        ? await tx.staff.findUnique({ where: { id: input.actorId }, select: { isActive: true, role: true } })
        : await tx.customer.findUnique({ where: { id: input.actorId }, select: { isActive: true } });
      if (!grantee?.isActive) throw new ClaimWorkflowError('INVALID_GRANTEE', 'The grantee does not exist or is inactive', 422);
      if (input.permission === 'REVIEWER' && (input.actorType !== 'staff' || grantee.role !== 'LEGAL_REVIEWER')) {
        throw new ClaimWorkflowError('INVALID_REVIEWER', 'Reviewer access requires an active legal-reviewer account', 422);
      }
      const access = await tx.claimAccess.upsert({
        where: { claimId_actorType_actorId: { claimId, actorType: input.actorType, actorId: input.actorId } },
        update: { permission: input.permission, revokedAt: null, reason: null, grantedBy: actor.id, grantedAt: new Date() },
        create: { claimId, actorType: input.actorType, actorId: input.actorId, permission: input.permission, grantedBy: actor.id },
      });
      await this._audit(tx, claimId, actor, 'ACCESS_GRANTED', {
        actorType: input.actorType,
        actorId: input.actorId,
        permission: input.permission,
      });
      return access;
    });
  }

  async revokeAccess(actor, claimId, { actorType, actorId, reason }) {
    assertActor(actor);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER']);
      if (actorType === actor.type && actorId === actor.id) {
        throw new ClaimWorkflowError('OWNER_SELF_REVOCATION', 'The acting owner cannot revoke their own access');
      }
      const access = await tx.claimAccess.findUnique({ where: { claimId_actorType_actorId: { claimId, actorType, actorId } } });
      if (!access || access.revokedAt) throw new ClaimWorkflowError('ACCESS_NOT_FOUND', 'Active access grant not found', 404);
      const revoked = await tx.claimAccess.update({
        where: { id: access.id },
        data: { revokedAt: new Date(), reason: assertText('reason', reason, 500) },
      });
      await this._audit(tx, claimId, actor, 'ACCESS_REVOKED', { actorType, actorId, reason: revoked.reason });
      return revoked;
    });
  }

  async addEvidence(actor, claimId, input) {
    assertActor(actor);
    const name = assertText('name', input.name, 180);
    const kind = assertText('kind', input.kind, 60).toUpperCase();
    const content = decodeBase64('contentBase64', input.contentBase64);
    const idempotencyKey = assertText('idempotencyKey', input.idempotencyKey, 120);
    if (input.privileged && actor.type !== 'staff') {
      throw new ClaimWorkflowError('PRIVILEGED_RESTRICTED', 'Only staff can mark evidence privileged', 403);
    }
    const redactedContent = input.privileged ? decodeBase64('redactedContentBase64', input.redactedContentBase64) : null;
    const contentHash = sha256(content);
    const redactedContentHash = redactedContent ? sha256(redactedContent) : null;
    const replay = await this.prisma.claimDocumentVersion.findUnique({
      where: { idempotencyKey },
      include: { document: true },
    });
    if (replay) {
      if (replay.document.claimId !== claimId || replay.contentHash !== contentHash) {
        throw new ClaimWorkflowError('IDEMPOTENCY_CONFLICT', 'Idempotency key was used for different evidence', 409);
      }
      await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']));
      return { document: replay.document, version: replay };
    }

    const expected = await this.prisma.$transaction(async (tx) => {
      const claim = await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']);
      if (['SIGNATURE_PENDING', 'SIGNED', 'FILED', 'CLOSED'].includes(claim.status)) {
        throw new ClaimWorkflowError('INVALID_STATE', 'Evidence cannot change after signature begins', 409);
      }
      if (!input.documentId) return null;
      if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
        throw new ClaimWorkflowError('EXPECTED_VERSION_REQUIRED', 'expectedVersion is required for a new document version', 422);
      }
      const document = await tx.claimDocument.findFirst({ where: { id: input.documentId, claimId } });
      if (!document) throw new ClaimWorkflowError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
      if (document.currentVersion !== input.expectedVersion) {
        throw new ClaimWorkflowError('VERSION_CONFLICT', 'Document has changed; reload before adding a version', 409);
      }
      return document.currentVersion;
    });

    const stored = await this.providers.storage.put({
      claimId,
      name,
      contentBase64: content.toString('base64'),
      contentHash,
      idempotencyKey,
    });
    if (!stored.reference || !stored.provider) throw new ClaimWorkflowError('STORAGE_EVIDENCE_INVALID', 'Storage provider returned no provenance', 502);
    let redactedStored = null;
    if (redactedContent) {
      redactedStored = await this.providers.storage.put({
        claimId,
        name: `${name}.redacted`,
        contentBase64: redactedContent.toString('base64'),
        contentHash: redactedContentHash,
        idempotencyKey: `${idempotencyKey}:redacted`,
      });
      if (!redactedStored.reference || !redactedStored.provider) {
        throw new ClaimWorkflowError('REDACTION_EVIDENCE_INVALID', 'Storage provider returned no redacted-object provenance', 502);
      }
    }
    const ocr = await this.providers.ocr.extract({
      storageRef: stored.reference,
      contentHash,
      idempotencyKey: `ocr:${contentHash}`,
    });
    if (!ocr.provider || !ocr.reference || typeof ocr.text !== 'string') {
      throw new ClaimWorkflowError('OCR_EVIDENCE_INVALID', 'OCR provider returned incomplete provenance', 502);
    }
    return this.prisma.$transaction(async (tx) => {
      const claim = await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']);
      let document;
      let version;
      if (input.documentId) {
        document = await tx.claimDocument.findFirst({ where: { id: input.documentId, claimId } });
        if (!document) throw new ClaimWorkflowError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
        version = expected + 1;
        const updated = await tx.claimDocument.updateMany({ where: { id: document.id, currentVersion: expected }, data: { currentVersion: version } });
        if (updated.count !== 1) throw new ClaimWorkflowError('VERSION_CONFLICT', 'Document changed while evidence was stored; retry with the current version', 409);
      } else {
        document = await tx.claimDocument.create({
          data: { claimId, name, kind, privileged: Boolean(input.privileged), createdById: actor.id },
        });
        version = 1;
      }
      const created = await tx.claimDocumentVersion.create({
        data: {
          documentId: document.id,
          version,
          contentHash,
          idempotencyKey,
          storageRef: stored.reference,
          redactedContentHash,
          redactedStorageRef: redactedStored?.reference,
          sourceProvider: stored.provider,
          sourceReference: input.sourceReference || stored.reference,
          ocrProvider: ocr.provider,
          ocrReference: ocr.reference,
          extractedText: ocr.text.slice(0, 200_000),
          createdById: actor.id,
        },
      });
      if (claim.status !== 'EVIDENCE_PENDING') {
        await tx.damageClaim.update({
          where: { id: claimId },
          data: { status: 'LEGAL_REVIEW', version: { increment: 1 } },
        });
      }
      await this._audit(tx, claimId, actor, 'DOCUMENT_VERSION_ADDED', {
        documentId: document.id,
        version,
        kind,
        privileged: document.privileged,
        contentHash,
        storageProvider: stored.provider,
        ocrProvider: ocr.provider,
      });
      return { document, version: created };
    });
  }

  async createTemplateDraft(actor, claimId) {
    assertActor(actor);
    const claim = await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR'], { includeTemplate: true }));
    const body = claim.template.body
      .replaceAll('{{claimId}}', claim.id)
      .replaceAll('{{orderId}}', claim.orderId)
      .replaceAll('{{jurisdiction}}', claim.jurisdiction)
      .replaceAll('{{incidentDate}}', claim.incidentDate.toISOString().slice(0, 10));
    return this.addEvidence(actor, claimId, {
      name: `Claim form ${claim.templateVersion}`,
      kind: 'AUTHORITATIVE_FORM_DRAFT',
      privileged: actor.type === 'staff',
      contentBase64: Buffer.from(body).toString('base64'),
      redactedContentBase64: actor.type === 'staff'
        ? Buffer.from('[Privileged claim form withheld pending authorized legal access]').toString('base64')
        : undefined,
      sourceReference: claim.template.sourceUri,
      idempotencyKey: `template-draft:${claim.id}:${claim.version}:${claim.template.contentHash}`,
    });
  }

  async submitForLegalReview(actor, claimId) {
    assertActor(actor);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']);
      const documents = await tx.claimDocument.count({ where: { claimId } });
      if (!documents) throw new ClaimWorkflowError('EVIDENCE_REQUIRED', 'At least one evidence document is required', 409);
      const claim = await tx.damageClaim.update({ where: { id: claimId }, data: { status: 'LEGAL_REVIEW', version: { increment: 1 } } });
      await this._audit(tx, claimId, actor, 'LEGAL_REVIEW_REQUESTED', { claimVersion: claim.version });
      return claim;
    });
  }

  async reviewClaim(actor, claimId, input) {
    assertActor(actor);
    if (actor.type !== 'staff' || actor.role !== 'LEGAL_REVIEWER') {
      throw new ClaimWorkflowError('LEGAL_REVIEWER_REQUIRED', 'A qualified legal reviewer with claim reviewer access is required', 403);
    }
    return this.prisma.$transaction(async (tx) => {
      const claim = await this._authorize(tx, claimId, actor, ['REVIEWER'], { includeTemplate: true });
      if (claim.createdById === actor.id) {
        throw new ClaimWorkflowError('INDEPENDENCE_REQUIRED', 'The claim creator cannot perform legal review', 409);
      }
      if (claim.status !== 'LEGAL_REVIEW') throw new ClaimWorkflowError('INVALID_STATE', 'Claim is not awaiting legal review', 409);
      if (!input.jurisdictionChecked || !input.effectiveDateChecked) {
        throw new ClaimWorkflowError('VALIDATION_REQUIRED', 'Jurisdiction and effective date checks are mandatory', 422);
      }
      const now = claim.incidentDate;
      if (claim.template.jurisdiction !== claim.jurisdiction || claim.template.effectiveFrom > now || (claim.template.effectiveTo && claim.template.effectiveTo <= now)) {
        throw new ClaimWorkflowError('TEMPLATE_OUT_OF_SCOPE', 'The authoritative template is not effective for this claim', 422);
      }
      const documentHash = await this._currentDocumentManifestHash(tx, claimId);
      const decision = input.decision === 'APPROVE' ? 'APPROVE' : input.decision === 'REJECT' ? 'REJECT' : null;
      if (!decision) throw new ClaimWorkflowError('INVALID_DECISION', 'Decision must be APPROVE or REJECT');
      const review = await tx.claimReview.create({
        data: {
          claimId,
          reviewerId: actor.id,
          decision,
          jurisdictionChecked: true,
          effectiveDateChecked: true,
          documentHash,
          notes: assertText('notes', input.notes, 2_000),
        },
      });
      await tx.damageClaim.update({
        where: { id: claimId },
        data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', version: { increment: 1 } },
      });
      await this._audit(tx, claimId, actor, 'LEGAL_REVIEW_RECORDED', { decision, documentHash, reviewId: review.id });
      return review;
    });
  }

  async requestSignature(actor, claimId, { signerEmail, idempotencyKey }) {
    assertActor(actor);
    signerEmail = assertText('signerEmail', signerEmail, 254).toLowerCase();
    idempotencyKey = assertText('idempotencyKey', idempotencyKey, 120);
    const existing = await this.prisma.claimSignature.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.claimId !== claimId || existing.signerEmail !== signerEmail) {
        throw new ClaimWorkflowError('IDEMPOTENCY_CONFLICT', 'Idempotency key was used for a different signature request', 409);
      }
      await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']));
      return existing;
    }
    const claim = await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']));
    if (claim.status !== 'APPROVED' && claim.status !== 'SIGNER_FAILED') {
      throw new ClaimWorkflowError('LEGAL_APPROVAL_REQUIRED', 'Legal approval is required before signature', 409);
    }
    let providerResult;
    let providerError;
    try {
      providerResult = await this.providers.signature.request({ claimId, signerEmail, idempotencyKey });
      if (!providerResult.provider || !providerResult.reference) throw new Error('Signature provider returned no provenance');
    } catch (error) {
      providerError = error;
    }
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']);
      const signature = await tx.claimSignature.create({
        data: {
          claimId,
          provider: providerResult?.provider || 'unavailable',
          providerRef: providerResult?.reference,
          idempotencyKey,
          signerEmail,
          status: providerError ? 'FAILED' : 'PENDING',
          failureCode: providerError?.code || (providerError ? 'PROVIDER_FAILURE' : null),
        },
      });
      await tx.damageClaim.update({ where: { id: claimId }, data: { status: providerError ? 'SIGNER_FAILED' : 'SIGNATURE_PENDING' } });
      await this._audit(tx, claimId, actor, providerError ? 'SIGNATURE_REQUEST_FAILED' : 'SIGNATURE_REQUESTED', {
        signatureId: signature.id,
        provider: signature.provider,
        failureCode: signature.failureCode,
      });
      return signature;
    });
  }

  async recordSigned(actor, claimId, { providerRef }) {
    assertActor(actor);
    if (actor.type !== 'staff') throw new ClaimWorkflowError('FORBIDDEN', 'Only staff can reconcile signature evidence', 403);
    providerRef = assertText('providerRef', providerRef, 300);
    await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']));
    const providerEvidence = await this.providers.signature.status({ claimId, providerRef, idempotencyKey: `signature-status:${claimId}:${providerRef}` });
    if (!providerEvidence?.provider || providerEvidence.reference !== providerRef || !['SIGNED', 'FAILED'].includes(providerEvidence.status)) {
      throw new ClaimWorkflowError('SIGNATURE_EVIDENCE_INVALID', 'Signature provider returned invalid status evidence', 502);
    }
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']);
      const signature = await tx.claimSignature.findFirst({ where: { claimId, providerRef, status: 'PENDING' } });
      if (!signature) throw new ClaimWorkflowError('SIGNATURE_NOT_FOUND', 'Pending signature not found', 404);
      if (providerEvidence.status === 'FAILED') {
        const failureCode = assertText('provider failure code', providerEvidence.failureCode, 120);
        const updated = await tx.claimSignature.update({ where: { id: signature.id }, data: { status: 'FAILED', failureCode } });
        await tx.damageClaim.update({ where: { id: claimId }, data: { status: 'SIGNER_FAILED', version: { increment: 1 } } });
        await this._audit(tx, claimId, actor, 'SIGNATURE_FAILED', { signatureId: signature.id, providerRef, failureCode });
        return updated;
      }
      const at = new Date(providerEvidence.signedAt);
      if (Number.isNaN(at.getTime()) || at > new Date()) throw new ClaimWorkflowError('SIGNATURE_EVIDENCE_INVALID', 'Provider signedAt is invalid', 502);
      const updated = await tx.claimSignature.update({ where: { id: signature.id }, data: { status: 'SIGNED', signedAt: at } });
      await tx.damageClaim.update({ where: { id: claimId }, data: { status: 'SIGNED', version: { increment: 1 } } });
      await this._audit(tx, claimId, actor, 'SIGNATURE_RECONCILED', { signatureId: signature.id, provider: providerEvidence.provider, providerRef, signedAt: at.toISOString() });
      return updated;
    });
  }

  async fileClaim(actor, claimId, { idempotencyKey }) {
    assertActor(actor);
    idempotencyKey = assertText('idempotencyKey', idempotencyKey, 120);
    const claim = await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']));
    if (claim.status === 'FILED' && claim.filingIdempotencyKey === idempotencyKey) return claim;
    if (claim.filingIdempotencyKey && claim.filingIdempotencyKey !== idempotencyKey) {
      throw new ClaimWorkflowError('IDEMPOTENCY_CONFLICT', 'Claim was filed with a different idempotency key', 409);
    }
    if (claim.status !== 'SIGNED') throw new ClaimWorkflowError('SIGNATURE_REQUIRED', 'A reconciled signature is required before filing', 409);
    const manifestHash = await this.prisma.$transaction((tx) => this._currentDocumentManifestHash(tx, claimId));
    const result = await this.providers.filing.submit({ claimId, manifestHash, jurisdiction: claim.jurisdiction, idempotencyKey });
    if (!result.provider || !result.reference) throw new ClaimWorkflowError('FILING_EVIDENCE_INVALID', 'Filing provider returned no provenance', 502);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR']);
      const updated = await tx.damageClaim.update({
        where: { id: claimId },
        data: { status: 'FILED', filingRef: `${result.provider}:${result.reference}`, filingIdempotencyKey: idempotencyKey, filedAt: new Date(), version: { increment: 1 } },
      });
      await this._audit(tx, claimId, actor, 'CLAIM_FILED', { provider: result.provider, reference: result.reference, manifestHash });
      return updated;
    });
  }

  async setLegalHold(actor, claimId, { active, reason }) {
    assertActor(actor);
    if (actor.type !== 'staff') throw new ClaimWorkflowError('FORBIDDEN', 'Only staff can change legal hold', 403);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'REVIEWER']);
      const updated = await tx.damageClaim.update({ where: { id: claimId }, data: { legalHold: Boolean(active), version: { increment: 1 } } });
      await this._audit(tx, claimId, actor, active ? 'LEGAL_HOLD_PLACED' : 'LEGAL_HOLD_RELEASED', { reason: assertText('reason', reason, 500) });
      return updated;
    });
  }

  async exportClaim(actor, claimId, { includePrivileged = false, idempotencyKey }) {
    assertActor(actor);
    idempotencyKey = assertText('idempotencyKey', idempotencyKey, 120);
    const replay = await this.prisma.claimExport.findUnique({ where: { idempotencyKey } });
    if (replay) {
      if (replay.claimId !== claimId || replay.privileged !== Boolean(includePrivileged)) {
        throw new ClaimWorkflowError('IDEMPOTENCY_CONFLICT', 'Idempotency key was used for a different export', 409);
      }
      await this.prisma.$transaction((tx) => this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER']));
      return replay;
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER']);
      const access = await tx.claimAccess.findUnique({ where: { claimId_actorType_actorId: { claimId, actorType: actor.type, actorId: actor.id } } });
      const maySeePrivileged = actor.type === 'staff' && ['OWNER', 'REVIEWER'].includes(access.permission);
      if (includePrivileged && !maySeePrivileged) {
        throw new ClaimWorkflowError('PRIVILEGED_EXPORT_FORBIDDEN', 'Privileged documents require owner or reviewer access', 403);
      }
      const documents = await tx.claimDocument.findMany({
        where: { claimId },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        claim: { id: claim.id, orderId: claim.orderId, jurisdiction: claim.jurisdiction, status: claim.status, version: claim.version },
        documents: documents.map((document) => {
          const version = document.versions[0];
          const redacted = document.privileged && !includePrivileged;
          if (redacted && (!version?.redactedStorageRef || !version?.redactedContentHash)) {
            throw new ClaimWorkflowError('REDACTION_REQUIRED', 'Privileged evidence has no approved redacted rendition', 409);
          }
          return {
            id: document.id,
            name: document.name,
            kind: document.kind,
            privileged: document.privileged,
            redacted,
            version: version?.version,
            contentHash: redacted ? version.redactedContentHash : version?.contentHash,
            storageRef: redacted ? version.redactedStorageRef : version?.storageRef,
          };
        }),
      };
    });
    const body = canonical(result);
    const manifestHash = sha256(body);
    const stored = await this.providers.storage.put({ claimId, name: 'claim-export.json', contentBase64: Buffer.from(body).toString('base64'), contentHash: manifestHash, idempotencyKey });
    if (!stored.provider || !stored.reference) throw new ClaimWorkflowError('STORAGE_EVIDENCE_INVALID', 'Storage provider returned no provenance', 502);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER']);
      const exported = await tx.claimExport.create({ data: { claimId, requestedBy: actor.id, idempotencyKey, privileged: Boolean(includePrivileged), manifestHash, storageRef: stored.reference } });
      await this._audit(tx, claimId, actor, 'CLAIM_EXPORTED', { exportId: exported.id, privileged: Boolean(includePrivileged), manifestHash });
      return exported;
    });
  }

  async enforceRetention(actor, claimId, { asOf, reason }) {
    assertActor(actor);
    if (actor.type !== 'staff') throw new ClaimWorkflowError('FORBIDDEN', 'Only staff can execute retention disposition', 403);
    const at = new Date(asOf || Date.now());
    if (Number.isNaN(at.getTime()) || at > new Date(Date.now() + 60_000)) {
      throw new ClaimWorkflowError('INVALID_DATE', 'Retention asOf must be a valid current or past date');
    }
    const claim = await this.prisma.$transaction(async (tx) => {
      const authorized = await this._authorize(tx, claimId, actor, ['OWNER']);
      if (authorized.legalHold) throw new ClaimWorkflowError('LEGAL_HOLD_ACTIVE', 'Retention is blocked by legal hold', 409);
      if (authorized.retentionUntil > at) throw new ClaimWorkflowError('RETENTION_NOT_DUE', 'Retention period has not elapsed', 409);
      if (!['FILED', 'CLOSED', 'REJECTED'].includes(authorized.status)) {
        throw new ClaimWorkflowError('INVALID_STATE', 'Only terminal claims can be disposed', 409);
      }
      const versions = await tx.claimDocumentVersion.findMany({
        where: { document: { claimId } },
        select: { storageRef: true, redactedStorageRef: true, contentHash: true },
      });
      return { ...authorized, versions };
    });
    const disposition = await this.providers.storage.dispose({
      claimId,
      references: claim.versions.flatMap((version) => [version.storageRef, version.redactedStorageRef].filter(Boolean)),
      reason: assertText('reason', reason, 500),
      idempotencyKey: `retention:${claimId}:${claim.version}`,
    });
    if (!disposition.provider || !disposition.reference) {
      throw new ClaimWorkflowError('DISPOSITION_EVIDENCE_INVALID', 'Storage provider returned no disposition evidence', 502);
    }
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER']);
      const updated = await tx.damageClaim.update({
        where: { id: claimId },
        data: {
          status: 'CLOSED',
          closedAt: at,
          disposedAt: at,
          storageRef: `disposed:${disposition.provider}:${disposition.reference}`,
          version: { increment: 1 },
        },
      });
      await this._audit(tx, claimId, actor, 'RETENTION_DISPOSITION_COMPLETED', {
        provider: disposition.provider,
        reference: disposition.reference,
        disposedObjectCount: claim.versions.reduce((count, version) => count + 1 + (version.redactedStorageRef ? 1 : 0), 0),
        reason,
      });
      return updated;
    });
  }

  async _authorize(tx, claimId, actor, permissions, options = {}) {
    const claim = await tx.damageClaim.findUnique({ where: { id: claimId }, include: options.includeTemplate ? { template: true } : undefined });
    if (!claim) throw new ClaimWorkflowError('CLAIM_NOT_FOUND', 'Claim not found', 404);
    const access = await tx.claimAccess.findUnique({ where: { claimId_actorType_actorId: { claimId, actorType: actor.type, actorId: actor.id } } });
    if (!access || access.revokedAt || !permissions.includes(access.permission)) {
      throw new ClaimWorkflowError('FORBIDDEN', 'Active claim-scoped permission is required', 403);
    }
    return claim;
  }

  async _currentDocumentManifestHash(tx, claimId) {
    const documents = await tx.claimDocument.findMany({
      where: { claimId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { id: 'asc' },
    });
    if (!documents.length) throw new ClaimWorkflowError('EVIDENCE_REQUIRED', 'At least one document is required', 409);
    return sha256(canonical(documents.map((document) => ({ id: document.id, version: document.versions[0]?.version, contentHash: document.versions[0]?.contentHash }))));
  }

  async verifyAudit(actor, claimId) {
    assertActor(actor);
    return this.prisma.$transaction(async (tx) => {
      await this._authorize(tx, claimId, actor, ['OWNER', 'REVIEWER']);
      const events = await tx.claimAuditEvent.findMany({ where: { claimId }, orderBy: { sequence: 'asc' } });
      let previousHash = 'GENESIS';
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        const expectedSequence = index + 1;
        const expectedHash = sha256(canonical({
          claimId,
          sequence: expectedSequence,
          actorType: event.actorType,
          actorId: event.actorId,
          action: event.action,
          payload: event.payload,
          previousHash,
        }));
        if (event.sequence !== expectedSequence || event.previousHash !== previousHash || event.eventHash !== expectedHash) {
          return { valid: false, checked: index, failedEventId: event.id };
        }
        previousHash = event.eventHash;
      }
      return { valid: true, checked: events.length, head: previousHash };
    });
  }

  async _audit(tx, claimId, actor, action, payload) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${claimId}))`;
    const previous = await tx.claimAuditEvent.findFirst({ where: { claimId }, orderBy: { sequence: 'desc' } });
    const sequence = (previous?.sequence || 0) + 1;
    const previousHash = previous?.eventHash || 'GENESIS';
    const eventHash = sha256(canonical({ claimId, sequence, actorType: actor.type, actorId: actor.id, action, payload, previousHash }));
    return tx.claimAuditEvent.create({
      data: { claimId, sequence, actorType: actor.type, actorId: actor.id, action, payload, previousHash, eventHash },
    });
  }
}

module.exports = { DamageClaimWorkflow, ClaimWorkflowError, canonical, sha256 };
