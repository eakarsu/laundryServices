# Operations runbook

## Release order

1. Confirm a recent restorable backup and provider status.
2. Build one immutable image and scan it.
3. Run `npm --prefix backend run migrate` as a separate, single migration job.
4. Run the migration command a second time; it must report no pending migrations.
5. Roll out the application, then require `/api/health` 200 and verify disallowed-origin CORS rejection.
6. Complete a non-production journey through evidence, review, signer failure/retry, filing, export, legal hold, and disposition.

The application process never migrates, resets, seeds, or repairs schema automatically. A failed migration stops the release; do not use `db push`, `--force-reset`, or `--accept-data-loss`.

## Backup and restore

Create a PostgreSQL custom-format backup:

```bash
DATABASE_URL=... ./ops/backup.sh
```

The script validates the archive and writes a SHA-256 sidecar without printing the connection string. Restore only into a separately created empty database:

```bash
RESTORE_DATABASE_URL=... ./ops/restore.sh backups/laundry-claims-....dump
```

Restore refuses a non-empty target, verifies the checksum when present, checks migration status, and recomputes every claim audit chain. Quarterly drills must also verify a redacted export and legal-hold block.

## Incident controls

- Deactivate a compromised account or increment its `authVersion`; every request performs a live check.
- Revoke its per-claim access grants and verify 403 responses with the old assignment.
- Rotate `JWT_SECRET` to revoke every session when scope is uncertain.
- Preserve the database and provider objects under legal hold. Never edit an audit row; the database rejects mutation.
- If a provider is degraded, stop the affected action. Do not manually invent a success reference. Signature reconciliation and filing must remain fail-closed.

## Monitoring

Alert on readiness 503, login/rate-limit spikes, provider non-2xx/timeout rates, repeated version conflicts, signature failures, audit verification failure, overdue retention blocked without a documented hold, and any attempt to update/delete `claim_audit_events` or `claim_document_versions`.
