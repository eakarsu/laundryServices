CREATE TYPE "ClaimStatus" AS ENUM (
  'DRAFT', 'EVIDENCE_PENDING', 'LEGAL_REVIEW', 'APPROVED',
  'SIGNATURE_PENDING', 'SIGNER_FAILED', 'SIGNED', 'FILED', 'CLOSED', 'REJECTED'
);

ALTER TABLE "Customer" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Staff" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Driver" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TYPE "StaffRole" ADD VALUE 'LEGAL_REVIEWER';

CREATE TABLE "claim_templates" (
  "id" TEXT PRIMARY KEY,
  "authority" TEXT NOT NULL,
  "sourceUri" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "contentHash" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "claim_templates_authority_jurisdiction_version_key" UNIQUE ("authority", "jurisdiction", "version")
);

CREATE INDEX "claim_templates_jurisdiction_effective_idx" ON "claim_templates" ("jurisdiction", "effectiveFrom", "effectiveTo");

CREATE TABLE "damage_claims" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdById" TEXT NOT NULL,
  "createdByType" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "incidentDate" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
  "templateId" TEXT NOT NULL REFERENCES "claim_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "templateVersion" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "legalHold" BOOLEAN NOT NULL DEFAULT FALSE,
  "retentionUntil" TIMESTAMP(3) NOT NULL,
  "storageRef" TEXT,
  "filingRef" TEXT,
  "filingIdempotencyKey" TEXT UNIQUE,
  "filedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "disposedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "damage_claims_customer_created_idx" ON "damage_claims" ("customerId", "createdAt");
CREATE INDEX "damage_claims_order_idx" ON "damage_claims" ("orderId");

CREATE TABLE "claim_access" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "damage_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "permission" TEXT NOT NULL CHECK ("permission" IN ('OWNER','EDITOR','REVIEWER','VIEWER')),
  "grantedBy" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "reason" TEXT,
  CONSTRAINT "claim_access_claim_actor_key" UNIQUE ("claimId", "actorType", "actorId")
);
CREATE INDEX "claim_access_actor_revoked_idx" ON "claim_access" ("actorType", "actorId", "revokedAt");

CREATE TABLE "claim_documents" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "damage_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "privileged" BOOLEAN NOT NULL DEFAULT FALSE,
  "currentVersion" INTEGER NOT NULL DEFAULT 1 CHECK ("currentVersion" > 0),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "claim_documents_claim_created_idx" ON "claim_documents" ("claimId", "createdAt");

CREATE TABLE "claim_document_versions" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "claim_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "contentHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "storageRef" TEXT NOT NULL,
  "redactedContentHash" TEXT,
  "redactedStorageRef" TEXT,
  "sourceProvider" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "ocrProvider" TEXT,
  "ocrReference" TEXT,
  "extractedText" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "claim_document_versions_document_version_key" UNIQUE ("documentId", "version"),
  CONSTRAINT "claim_document_versions_document_hash_key" UNIQUE ("documentId", "contentHash")
);

CREATE TABLE "claim_reviews" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "damage_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reviewerId" TEXT NOT NULL,
  "decision" TEXT NOT NULL CHECK ("decision" IN ('APPROVE','REJECT')),
  "jurisdictionChecked" BOOLEAN NOT NULL,
  "effectiveDateChecked" BOOLEAN NOT NULL,
  "documentHash" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "claim_reviews_claim_created_idx" ON "claim_reviews" ("claimId", "createdAt");

CREATE TABLE "claim_signatures" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "damage_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider" TEXT NOT NULL,
  "providerRef" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "signerEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING','FAILED','SIGNED')),
  "failureCode" TEXT,
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "claim_signatures_claim_created_idx" ON "claim_signatures" ("claimId", "createdAt");

CREATE TABLE "claim_audit_events" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "damage_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "previousHash" TEXT NOT NULL,
  "eventHash" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "claim_audit_events_claim_sequence_key" UNIQUE ("claimId", "sequence")
);
CREATE INDEX "claim_audit_events_claim_created_idx" ON "claim_audit_events" ("claimId", "createdAt");

CREATE TABLE "claim_exports" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "damage_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestedBy" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "privileged" BOOLEAN NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "storageRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "claim_exports_claim_created_idx" ON "claim_exports" ("claimId", "createdAt");

CREATE OR REPLACE FUNCTION reject_claim_evidence_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'claim evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_audit_events_immutable
BEFORE UPDATE OR DELETE ON "claim_audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_claim_evidence_mutation();

CREATE TRIGGER claim_document_versions_immutable
BEFORE UPDATE OR DELETE ON "claim_document_versions"
FOR EACH ROW EXECUTE FUNCTION reject_claim_evidence_mutation();
