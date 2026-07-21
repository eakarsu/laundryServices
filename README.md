# Laundry claim governance

This repository’s production boundary is one complete laundry damage/loss claim journey. A claim starts from an existing laundry order, captures append-only evidence and OCR provenance, uses an authoritative jurisdiction/effective-date template, requires an independent staff reviewer, reconciles e-sign evidence with the provider, files the signed record, exports a permission-aware package, and enforces legal hold and retention disposition.

The older broad laundry and experimental AI source remains available for reference, but it is not mounted by default and cannot be enabled in `production`. In development it requires `ENABLE_LEGACY_ROUTES=true`. Generated gap routes are not mounted.

## Trust boundary

- Customers may open claims only for their own orders. Staff and customers see only matters with a current `ClaimAccess` grant.
- Only an active `LEGAL_REVIEWER` account can receive matter `REVIEWER` access. The claim creator cannot approve their own claim.
- JWTs require a 32-character secret, `HS256`, issuer, and audience. Every request reloads the account and its `authVersion`, so deactivation and password changes revoke existing sessions.
- Evidence versions are content-hashed, provider-referenced, idempotent, and optimistic-concurrency controlled. Privileged evidence requires a separately stored redacted rendition.
- Audit events form a per-claim SHA-256 chain. PostgreSQL triggers reject audit-event and evidence-version update/delete operations.
- Provider calls require HTTPS, bearer credentials, typed provenance, 15-second timeouts, and stable idempotency keys. There are no mock or AI fallbacks in product paths.
- Application startup does not install packages, migrate, seed, reset data, kill unrelated processes, or write secrets.

See [the workflow contract](docs/CLAIM_WORKFLOW.md), [provider contracts](docs/PROVIDER_CONTRACTS.md), and [operations runbook](docs/RUNBOOK.md).

## Local verification

Prerequisites are Node.js 22+, PostgreSQL 14+, and npm. Copy `.env.example` to `.env` and replace every placeholder; never commit `.env`.

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run prisma:generate
npm --prefix backend run migrate
npm --prefix backend run migrate
npm --prefix backend test
npm --prefix backend audit --audit-level=moderate
npm --prefix frontend audit --audit-level=moderate
npm --prefix frontend run build
./start.sh
```

Migrations and seeding are explicit operator actions. `seed:demo` is never called by startup and must not be used against shared or production data.

## Deployment

Build the immutable application image with `docker build -t laundry-claims .`. Run the migration job once before rolling out the application:

```bash
docker compose --profile tools run --rm migrate
docker compose up -d app
```

The application serves the built claim console and `/api` from port 3001. `/api/health` returns 200 only when the database is reachable. `compose.yaml` uses a read-only application filesystem, drops Linux capabilities, and does not automatically mutate the schema.

Production remains blocked until real template, storage, OCR, e-sign, and filing endpoints and secret-manager credentials are configured, qualified legal reviewers are assigned, jurisdiction-specific retention policy is approved, and backup/restore plus provider-failure drills pass in the target environment.
