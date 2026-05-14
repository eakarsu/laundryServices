# Audit Apply Notes — laundryServices

Source: `_AUDIT/reports/batch_10.md` § Substantive #21 laundryServices

## Original audit recommendations

Audit verdict: **SUBSTANTIVE** — 23 routes, 16 AI endpoints. Strong domain depth (drivers, routes, machines, lockers) with rich AI layer (demand forecasting, churn prediction, quality control, stain identification, route optimization, maintenance prediction). WhatsApp integration shows omnichannel customer engagement.

### What's missing
- Garment damage/loss claims automation
- Fabric care compliance (prevent shrinkage, fading)
- Laundromat/partnership network management
- Delivery to corporate offices (bulk laundry)
- Subscription personalization (detect preferences, adjust schedule)
- Environmental impact tracking (water/chemical usage)

### Custom feature ideas
- Vision-based garment damage assessment
- Subscription optimization agent
- Fabric care advisor
- Driver earnings optimizer
- Corporate B2B agent
- Sustainability dashboard

## Implemented this pass

- `POST /api/ai/subscription-optimize` — added in `routes/ai.js`. Pulls the customer, latest subscription, and last 60 orders, then asks the model for a JSON recommendation `{recommended_frequency, recommended_plan, recommended_add_ons, expected_savings_per_month, expected_revenue_lift_per_month, rationale, warnings}`. Mechanical implementation of "Subscription optimization agent" / "Subscription personalization".

Reuses existing helpers: `callOpenRouter(messages, opts)`, `parseAIJson`, `persistAIResult(prisma, payload)`, `aiRateLimiter`, `DEFAULT_MODEL`, `authenticateToken`. Persists to the existing `aIResult` Prisma model. Syntax-checked with `node --check`.

(Only one mechanical addition this pass because the rest of the audit gaps either need new schema, new vendors, or B2B workflow design — see backlog.)

## Backlog (not implemented)

### Needs schema/data model work
- Garment damage/loss claims — needs claims state machine + evidence storage.
- Laundromat/partnership network — needs partner table + revenue split.
- Corporate B2B (bulk laundry) — needs corporate contract / multi-account model.
- Environmental impact tracking — needs water/chemical metering schema.
- Driver earnings optimizer — needs detailed pay-rule schema and tip ledger.

### Needs creds / external deps
- Vision-based garment damage assessment — already partly possible via `/quality-check`, but a higher-quality model + image storage decision needed.

### Needs product decision
- Fabric care advisor — care label taxonomy + vendor reference (e.g. ASTM/ISO).
- Sustainability dashboard — KPI definition + reporting cadence.

## Categorisation

- MECHANICAL: subscription-optimize (done).
- NEEDS-SCHEMA: claims, partner network, corporate accounts, env metering, driver pay rules.
- NEEDS-CREDS: high-quality vision model selection.
- NEEDS-PRODUCT-DECISION: fabric-care taxonomy, sustainability KPIs.

## Apply pass 3 (frontend)

LEFT-AS-IS. `frontend/src/pages/AISubscriptionOptimize.jsx` already calls `/ai/subscription-optimize` via the shared axios `services/api.js` (JWT Bearer from localStorage), renders the structured recommendation (frequency, plan, add-ons, savings, rationale, warnings), and is registered at `ai/subscription-optimize` in `App.jsx`. 503-no-key flows through `err.response?.data?.error` to a toast. No FE files modified.
