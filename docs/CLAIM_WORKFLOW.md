# Damage/loss claim workflow contract

## Acceptance journey

1. An administrator imports an authoritative template resolved by jurisdiction and incident date. The source URL, effective range, version, and content digest must agree with the provider. An existing template version cannot be replaced with different content.
2. An authenticated customer opens a claim only for their own laundry order, or staff opens it for that order’s customer. A replay key returns the original claim; reusing the key for different input returns 409.
3. An owner grants matter-scoped `EDITOR`, `REVIEWER`, or `VIEWER` access to an active account. Reviewer grants are limited to staff provisioned with the distinct `LEGAL_REVIEWER` role. Revocation is checked on every claim request.
4. An owner/editor uploads evidence. Storage and OCR must return provenance. Updating a document requires its current version; stale writers receive 409. Privileged evidence requires a redacted rendition stored under a separate reference.
5. The service renders only the selected authoritative template’s fixed placeholders (`claimId`, `orderId`, `jurisdiction`, and `incidentDate`). It does not generate legal language with an LLM.
6. An owner/editor submits the exact evidence manifest for review. A different reviewer with matter `REVIEWER` access must attest to jurisdiction and effective-date checks before approval.
7. An owner/editor requests e-signature using an idempotency key. Provider failure becomes `SIGNER_FAILED` and supports an explicit retry. Reconciliation polls the provider; request body claims are not accepted as proof of signature.
8. Only a provider-reconciled `SIGNED` claim may be filed. Filing evidence and the document-manifest hash are written to the audit chain.
9. Exports contain the privileged original only for staff owners/reviewers who explicitly request it. Other exports contain the stored redacted reference and digest, never the original reference or OCR text.
10. Retention disposition is allowed only for a terminal claim after `retentionUntil` and while no legal hold is active. Storage disposition completes before the database records the immutable event.

## State transitions

`EVIDENCE_PENDING → LEGAL_REVIEW → APPROVED → SIGNATURE_PENDING → SIGNED → FILED → CLOSED`

Failure branches are `LEGAL_REVIEW → REJECTED` and `SIGNATURE_PENDING → SIGNER_FAILED → SIGNATURE_PENDING`. New evidence is rejected after signing starts. A legal hold does not change state; it blocks disposition.

## HTTP surface

All routes below require a current Bearer token except login.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/staff/login`, `POST /api/auth/login` | Staff/customer session |
| `GET /api/damage-claims` | Assigned active matters only |
| `POST /api/damage-claims/templates/import` | Import immutable authoritative version |
| `POST /api/damage-claims` | Open order-linked claim |
| `GET /api/damage-claims/:id` | Permission-filtered matter; privileged content is redacted |
| `POST /api/damage-claims/:id/access` | Grant scoped access |
| `POST /api/damage-claims/:id/access/revoke` | Revoke scoped access immediately |
| `POST /api/damage-claims/:id/evidence` | Store/OCR a new immutable version |
| `POST /api/damage-claims/:id/template-draft` | Render authoritative fixed template |
| `POST /api/damage-claims/:id/submit-review` | Freeze manifest for review |
| `POST /api/damage-claims/:id/reviews` | Independent approve/reject decision |
| `POST /api/damage-claims/:id/signatures` | Request/retry e-signature |
| `POST /api/damage-claims/:id/signatures/reconcile` | Poll provider-signed evidence |
| `POST /api/damage-claims/:id/file` | Submit signed manifest for filing |
| `POST /api/damage-claims/:id/exports` | Produce scoped export package |
| `POST /api/damage-claims/:id/legal-hold` | Place/release hold with reason |
| `POST /api/damage-claims/:id/retention/dispose` | Execute due disposition |
| `GET /api/damage-claims/:id/audit/verify` | Recompute audit chain |

Mutation bodies reject unknown fields. IDs are UUIDs, timestamps require an explicit ISO-8601 offset, and request-specific idempotency keys are 8–120 restricted characters.
