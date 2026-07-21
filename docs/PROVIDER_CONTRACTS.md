# Claim provider contracts

Each provider base URL must be HTTPS and each token at least 16 characters. Requests are JSON `POST`s with `Authorization: Bearer …`, `Content-Type: application/json`, and `Idempotency-Key`. The client times out after 15 seconds and treats non-2xx or malformed provenance as failure.

## Authoritative templates

`POST {CLAIM_TEMPLATE_URL}/v1/templates/resolve`

Request: `{ jurisdiction, asOf, idempotencyKey }`.

Response: `{ provider, authority, sourceUri, jurisdiction, version, effectiveFrom, effectiveTo|null, body, contentHash }`. `sourceUri` must be HTTPS and `contentHash` must equal SHA-256 of `body`. Effective dates are checked again during human review.

## Storage and disposition

`POST {CLAIM_STORAGE_URL}/v1/objects` receives `{ claimId, name, contentBase64, contentHash, idempotencyKey }` and returns `{ provider, reference }`.

`POST {CLAIM_STORAGE_URL}/v1/dispositions` receives `{ claimId, references[], reason, idempotencyKey }` and returns durable `{ provider, reference }` disposition evidence. Privileged originals and redacted renditions use separate references.

## OCR

`POST {CLAIM_OCR_URL}/v1/extractions` receives `{ storageRef, contentHash, idempotencyKey }` and returns `{ provider, reference, text }`. The API stores the first 200,000 characters and never exposes privileged OCR text to an unprivileged actor.

## E-signature

`POST {CLAIM_ESIGN_URL}/v1/envelopes` receives `{ claimId, signerEmail, idempotencyKey }` and returns `{ provider, reference }`.

`POST {CLAIM_ESIGN_URL}/v1/envelopes/status` receives `{ claimId, providerRef, idempotencyKey }`. It must return the same `reference`, plus either `{ status: "SIGNED", signedAt }` or `{ status: "FAILED", failureCode }`. Pending or ambiguous results do not advance the claim.

## Filing

`POST {CLAIM_FILING_URL}/v1/submissions` receives `{ claimId, manifestHash, jurisdiction, idempotencyKey }` and returns `{ provider, reference }`.

Provider credentials must come from the deployment secret manager. Request/response bodies can contain personal and privileged data; logging them is prohibited. Providers must be covered by approved data-processing, retention, breach-notification, residency, and deletion terms before production use.
