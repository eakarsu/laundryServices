# Completeness Review: laundryServices

**Review date:** 2026-07-18

## Assessment basis

Static inspection of project-owned source and configuration only; no dependency installation, build, database migration, external-service call, or runtime launch was performed. The scan considered 130 project files (118 source files), 2 manifest(s), 0 test-like file(s), and 0 CI workflow(s), excluding dependency/generated directories.

## Classification

**Functional but incomplete**

This is a substantive but unfinished legal/document workflow application, not just an empty scaffold. Inspection found 118 source files across `frontend/`, `backend/` using Next.js, React, Express, Prisma; however, the checked-in workflow and delivery controls do not yet demonstrate a complete, production-operable product.

## Why it is not complete

- Generated gap/visualization routes describe missing capabilities or simulate recommendations; they do not implement the underlying domain operation.
- Generic LLM calls are used as product behavior without enough typed tools, grounded evidence, deterministic rules, or output evaluation.
- Mock, demo, sample, fixture, or placeholder behavior remains in executable/product paths.
- No recognizable project-owned automated tests were found for the main workflow.
- No checked-in CI workflow proves builds, tests, migrations, and security checks on every change.

## Needed features

1. Add matter-scoped permissions, document provenance, version history, privileged-access controls, and immutable audit events.
2. Integrate OCR, e-signature, filing/storage, retention/legal-hold, and authoritative template sources.
3. Require human legal review and jurisdiction/effective-date validation for generated clauses, forms, or recommendations.
4. Test redaction, conflicting versions, signer failure, access revocation, export, and retention workflows end to end.
5. Add risk-based unit, integration, and end-to-end tests in CI, including migration and failure-path coverage.

## Risks or launch blockers

- Weak/fallback secret patterns can permit forged sessions or accidental insecure deployments.
- Automation contains destructive process, filesystem, or database operations; do not run it on a shared machine without review.
- Startup appears coupled to seed/migration behavior, risking data mutation or non-repeatable launches.
- AI-provider availability, cost, privacy, prompt injection, and unvalidated output are launch risks until bounded and evaluated.

## Evidence inspected

- `README.md`
- `backend/src/routes/auth.js:45`
- `backend/src/index.js:413`
- `backend/prisma/seedDriverRoutes.js`
- `backend/package.json`
- `start.sh`

## Recommended next action

Choose one real legal/document workflow journey, define acceptance criteria and external contracts, then close its persistence, permission, integration, failure, and test gaps before expanding features.

## Implementation progress (2026-07-20)

Implemented one bounded, production-oriented journey that fits this repository’s actual laundry domain: order-linked damage/loss claim resolution. The active boundary now provides matter-scoped grants and immediate revocation; live account/session revocation; immutable, hash-chained audit events; append-only document versions with provenance, optimistic conflict detection, privileged originals, and separately stored redacted renditions; authoritative jurisdiction/effective-date templates; typed HTTPS storage, OCR, e-sign, and filing adapters; a distinct `LEGAL_REVIEWER` role with independent human approval; idempotent claim/evidence/signature/filing/export operations; provider-verified signer failure/retry; scoped export; legal hold; and retention disposition. The default UI is a claim console, while legacy AI/gap routes and legacy socket behavior are disabled by default and cannot be enabled in production.

Delivery controls now include an ordered baseline plus claim migration, schema-drift checking, strict request validation, fail-closed JWT/provider configuration, a non-mutating launcher, readiness and explicit-origin CORS checks, a read-only/capability-dropped Compose deployment, provider/workflow/runbook documentation, checksum-verified backup/empty-target restore scripts, and CI gates for migration replay, drift, backend tests, dependency audits, frontend build, shell/Compose checks, and image build.

Verification completed locally:

- Fresh PostgreSQL migration and repeat deploy passed; Prisma reported no migration-to-schema difference.
- Seven automated tests passed. The HTTP/database/provider E2E journey covers replay conflicts, conflicting evidence versions, redaction without original-reference/OCR leakage, matter and session revocation, independent jurisdiction/effective-date review, signer failure and retry, filing, export, legal-hold blocking, due disposition, audit-chain verification, and database rejection of audit/evidence mutation.
- Backend runtime and development dependency audits and the frontend audit reported zero vulnerabilities; the Vite production build passed. CI enforces the same audits at the low-severity threshold with a fresh JWT secret on every run.
- Production smoke checks returned readiness 200, allowed-origin CORS 200, disallowed-origin 403, legacy AI/auth paths 404, and the claim console 200. The safe launcher performed only migration-status inspection before start and shut down only its owned processes.
- Backup/restore produced matching claim, audit, and version counts; the restored audit chain passed, and a second restore into the non-empty target was refused.
- Source and full Git history secret scans passed, as did `git diff --check`, shell syntax, workflow YAML parsing, and `docker compose config`.

The local Docker daemon was unavailable, so the image itself was not built locally; CI contains that gate. Production launch still requires approved provider endpoints and secret-manager credentials, qualified legal-reviewer assignment, jurisdiction-specific retention approval, target-environment provider/failure drills, and a successful container/restore rehearsal.

## Isolated startup and login verification (2026-07-20)

The launcher now requires distinct assigned backend/frontend ports, refuses occupied ports, binds only to `127.0.0.1`, starts the backend before exposing the Vite UI, and never reads the project `.env` during isolated acceptance. Provider contract variables are test-safe non-contact HTTPS placeholders, migrations remain outside normal startup, broad demo seed is no longer auto-discovered, and initial staff-administrator creation is an acknowledgement-gated non-overwriting command. The API listener itself also rejects missing/default port or non-loopback host configuration.

On disposable PostgreSQL `55665`, the backend and UI used `6138` and `6139`. The first acceptance attempt provisioned a persisted `ADMIN` staff member, completed real `/api/auth/staff/login`, received an issuer/audience-bound bearer token, and passed database-revalidated `/api/auth/me`: `API_VERIFIED/startup_login_session_api`. Backend checks, all 7/7 unit/database/provider-workflow tests, and the Vite production build passed. All assigned ports were released afterward.
