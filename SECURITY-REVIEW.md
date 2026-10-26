# Security review — October 26, 2026

Scope: this repository's application code, npm dependency tree, Dockerfile, and
build/deployment configuration. No production host, running production image,
reverse proxy, account access logs, or external service configuration was inspected.
This is a targeted review, not a penetration test or a guarantee of no vulnerabilities.

## Brotli / CVE-2026-111497

This is a Next.js/Node application; no Python application dependency manifests or
Brotli Python packages were found. Node bundles the affected decoder, and HTTP
clients can decode Brotli responses implicitly. Absence of a direct Brotli import
does not establish safety.

The [Node.js security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
fixes this issue in Node 22.23.4, 24.22.1, and 26.12.1. The local runtime is
24.22.1. Both Docker stages now use `node:24.22.1-bookworm-slim`, replacing a
floating `node:22-bookworm-slim` reference whose previously built contents could
not be established. `.nvmrc` and package engine constraints specify patched
versions. The image build now explicitly pulls its base image.

Node backported the fix: `process.versions.brotli` still reports `1.2.0` in the
patched Node 24 runtime. Use the Node security release version to assess official
Node binaries, rather than treating the embedded Brotli version alone as proof
of vulnerability. Distribution-provided Node builds require vendor confirmation.

## Changes made

| Finding | Change |
| --- | --- |
| npm audit reported 22 affected packages: 3 critical, 13 high, 6 moderate | Updated Next.js and its ESLint config to 16.4.3, React/React DOM to 19.3.1, Auth.js to beta.32, and compatible direct/transitive packages; regenerated the lockfile. Both full and production-only npm audits report zero known vulnerabilities. |
| Admin pages relied on middleware for access control | Every protected page now checks authorization before querying data. Server actions and admin APIs retain their own checks. |
| JWT sessions outlived admin deletion or password changes | Server-side JWT validation checks the current admin account and password hash version. Existing sessions without this version must sign in again. |
| Upload MIME type was client-controlled and extension came from the filename, allowing same-origin HTML/SVG content | Reject new SVG uploads, detect supported raster signatures, derive the extension from content, require the configured request origin, and add restrictive upload CSP plus `nosniff`. Headers cover existing static uploads as well as dynamic serving. |
| Checkout trusted arbitrary request Origin for payment redirects and image URLs | Use the configured AUTH_URL origin and reject mismatched request origins. Bound cart size and quantities; reject duplicate variant IDs that previously bypassed per-line stock checks. |
| Concurrent Stripe deliveries could each decrement inventory; completed-but-unpaid sessions could be fulfilled | Require a paid session matching the order's stored Stripe session, handle asynchronous payment success, and atomically claim PENDING orders with inventory changes in one transaction. |
| Customer-controlled names/addresses were inserted into HTML emails | Escape dynamic HTML text. |
| Customer-controlled CSV fields could execute spreadsheet formulas | Neutralize formula prefixes and quote carriage returns, newlines, quotes, and commas. |
| Seed command created a known default admin password and logged passwords | Require explicit bootstrap credentials and remove password logging. |

Added weekly dependency update proposals and a security workflow that runs npm
audit, lint, build, and the security regression tests. Updates remain within
compatible release lines; major migrations such as Stripe 23, ESLint 10, and
TypeScript 7 were not bundled into this security patch. Auth.js remains on the
existing v5 beta release line.

## Validation

- Prisma client generation, production build, ESLint, TypeScript, and diff checks.
- Full and production-only npm dependency audits.
- Seven regression tests against a local production server and a disposable
  SQLite database. Coverage includes unauthenticated admin access, forged
  checkout origins, duplicate/excessive cart quantities, disguised image uploads,
  CSV formulas, session revocation, unpaid/mismatched/invalid-signature webhooks,
  and concurrent duplicate payment fulfillment. Tests use synthetic Stripe
  credentials and locally signed events; they do not make payment API calls.
- Local Docker image build with a freshly pulled base; the resulting
  `emma-shop:security-review` image reports Node `v24.22.1`. No image was
  published or deployed.

Run application checks with:

```sh
npm ci
npx prisma generate
npm audit
npm run lint
npm run build
npm run test:security
```

## Remaining findings and deployment work

1. **Deploy the rebuilt image and verify the running workload.** Source changes
   do not patch an already running container. Build/publish through the existing
   image workflow, deploy the resulting SHA to beta, verify checkout and signed
   Stripe deliveries, then promote to production. Confirm the configured AUTH_URL
   exactly matches the public shop origin. Existing admin sessions will require
   a fresh login. New SVG uploads are intentionally rejected; existing uploads
   receive a restrictive CSP and should be inspected if their provenance is unknown.
2. **Verify production's runtime and infrastructure.** Run
   `docker compose exec emma-shop node --version` on each deployment. Check the
   reverse proxy, host packages, CI/runtime images, and other services against
   their own vendor advisories; this repository review does not establish their
   Brotli patch status. No full operating-system container vulnerability scan
   was performed.
3. **Add persistent or proxy-enforced abuse controls.** No application login or
   checkout rate limiter was found. Credential guessing, automated checkout
   session creation, and PENDING-order accumulation remain possible. Enforce
   limits at the trusted proxy or with a shared durable store, including limits
   on request body size. Upload size is checked after multipart parsing, and
   checkout/webhook bodies are buffered before validation, so application checks
   alone do not bound memory used by oversized requests.
4. **Harden refund concurrency and restocking.** Concurrent admin refund actions
   read the same refundable balance before contacting Stripe; they lack a durable
   operation identifier/idempotency key. Repeated partial refunds with restocking
   can also return the full item quantity repeatedly. Use a persisted refund
   operation and explicit per-item restock accounting before supporting concurrent
   operators. This requires a separate data-model/payment workflow change.
5. **Reduce container privileges.** The runtime still runs as root and includes
   build/development tooling used for Prisma migrations and admin bootstrap.
   A non-root runtime requires planning ownership changes for existing database
   and upload volumes. No existing production volume permissions were changed.

No production data or credentials were modified by this review. No finding here
establishes that exploitation has occurred; production compromise assessment
requires host and service evidence beyond this repository.
