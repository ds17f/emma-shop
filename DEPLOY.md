# Deploying Comet Tail Crafts to Hetzner (alongside deadly)

Run the shop on the existing Hetzner box, fronted by deadly's Caddy (which handles
TLS via Let's Encrypt automatically). The two projects stay **decoupled**: emma-shop
has its own image, compose stack, and deploy. The only change in the deadly repo is
one Caddy site block + attaching Caddy to a shared network.

## Architecture

```
                       Hetzner box
  ┌──────────────────────────────────────────────────────────┐
  │  Caddy (deadly's image, owns :80/:443, auto Let's Encrypt) │
  │    ├── deadly site(s)        → deadly ui/api               │
  │    └── shop.<domain>         → emma-shop:3000   ◄── new    │
  │                                                            │
  │  emma-shop (Next.js standalone server, :3000)              │
  │    ├── volume emma_db      → SQLite file (persists)        │
  │    └── volume emma_uploads → /app/public/uploads           │
  │                                                            │
  │  shared docker network "web"  (Caddy + emma-shop joined)   │
  └──────────────────────────────────────────────────────────┘
```

- emma-shop never binds 80/443 — Caddy reverse-proxies to it by service name.
- Certs live in deadly's existing `caddy_data` volume; issued + renewed automatically.

---

## Part A — Changes in THIS repo (emma-shop) ✅ BUILT

Status: implemented and verified locally (image builds, container migrates,
creates the admin, serves, and admin login works). Files: `Dockerfile`,
`docker-compose.yml`, `docker-entrypoint.sh`, `.dockerignore`,
`prisma/ensure-admin.ts`.

### 1. Dynamic rendering (not standalone)
`src/app/layout.tsx` sets `export const dynamic = "force-dynamic"`. The storefront
is data-driven (products + settings from SQLite), so we render at request time
rather than prerendering at build (which would need a database during the build).
We deliberately **did not** use `output: "standalone"` — the runtime needs the
`better-sqlite3` native binding *and* the Prisma CLI + tsx for migrations, so a
full (production-installed) `node_modules` running `next start` is simpler and
more reliable than tracing those into a standalone bundle.

### 2. Dockerfile (multi-stage)
- **build stage** (`node:22-bookworm-slim` + python3/make/g++/openssl): `npm ci`,
  `prisma generate`, `npm run build`. The build tools compile `better-sqlite3`.
- **runtime stage** (`node:22-bookworm-slim` + openssl): copies `node_modules`
  (with the compiled binding, Prisma CLI, and tsx), `.next`, `public`,
  `src/generated`, `prisma/`, and configs. Creates `/app/data` + uploads dirs.
- Entry point: `docker-entrypoint.sh` runs `prisma migrate deploy`, then
  `tsx prisma/ensure-admin.ts`, then `next start`.
- Image ≈ 305 MB.

### 3. Admin bootstrap — `prisma/ensure-admin.ts`
Idempotent: creates an admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` only if none
with that email exists. Never overwrites an existing password and never touches
product/category data — safe to run on every boot. (The full `prisma/seed.ts`
with sample products stays a dev-only manual step.)

### 4. docker-compose.yml (emma-shop's own)
Already in the repo. Joins the external `web` network, `expose: 3000` (no host
ports), volumes `emma_db:/app/data` (SQLite) and `emma_uploads:/app/public/uploads`.
Secrets via `.env` (`AUTH_SECRET`, `STRIPE_*`, `ADMIN_*`); `DATABASE_URL`,
`AUTH_URL`, `AUTH_TRUST_HOST` set in `environment:`.

### 5. Deploy mechanism (pick one — NOT yet built)
- **CI (recommended, mirrors deadly):** GitHub Action builds + pushes
  `ghcr.io/ds17f/emma-shop` on push to main; a deploy step SSHes to the box and
  `docker compose pull && up -d` (the entrypoint runs migrations automatically).
- **Manual:** SSH + `git pull` + `docker compose up -d --build`.

### Local test (how Part A was verified)
```bash
docker build -t emma-shop:test .
docker run -d --name emma-test -p 3002:3000 \
  -e AUTH_SECRET="$(openssl rand -base64 32)" -e AUTH_URL="http://localhost:3002" \
  -e AUTH_TRUST_HOST=true -e DATABASE_URL="file:/app/data/prod.db" \
  -e ADMIN_EMAIL="you@example.com" -e ADMIN_PASSWORD="change-me-please" \
  -v emma-test-data:/app/data emma-shop:test
# → http://localhost:3002  (admin at /admin)
```

---

## Part B — Changes in the deadly repo (minimal)

### 1. One Caddy site block (in deadly's `Caddyfile`)
```
shop.<domain> {
    reverse_proxy emma-shop:3000
}
```
Commit → deadly CI (`build-images.yml` watches `Caddyfile`) rebuilds the caddy
image → redeploy. Caddy auto-issues the Let's Encrypt cert on first hit.

### 2. Put Caddy on the shared network (deadly's `docker-compose.yml`)
Add to the `caddy` service:
```yaml
    networks:
      - default
      - web
```
and at the bottom:
```yaml
networks:
  web:
    external: true
```

---

## Part C — One-time host + DNS setup

1. **Shared network:** `docker network create web` on the box (idempotent).
2. **DNS (GoDaddy):** add an `A` record `shop.<domain>` → Hetzner IP. (MX/email
   unaffected.) Wait for propagation before the first Caddy hit so LE can validate.
3. **Secrets on the box:** create emma-shop's `.env` (AUTH_SECRET via
   `openssl rand -base64 32`, Stripe live keys, admin creds). Never commit it.
4. **Stripe:** in the dashboard add webhook endpoint
   `https://shop.<domain>/api/webhooks/stripe` (event `checkout.session.completed`)
   and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## First-launch order

1. DNS A record → Hetzner IP (propagate).
2. `docker network create web` on the box.
3. Deploy emma-shop stack; run `migrate deploy` + seed admin once.
4. Add deadly Caddyfile block + network; redeploy deadly's caddy.
5. Hit https://shop.<domain> → Caddy issues the cert → live.

## Backups
- Database = the single file on `emma_db`. Cron a copy off-box.
- Product images = `emma_uploads` volume. Back these up too.

## Why not GoDaddy cPanel
Shared cPanel runs PHP/Apache/MySQL, not a long-running Next.js Node server
(server actions, Stripe webhook, admin) — and no Postgres/Docker. Good only for
the domain/DNS, which is exactly how we're using it here.
```
