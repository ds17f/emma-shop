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

### 5. Deploy mechanism — BUILT (two paths, same seam)

Both resolve the box's IP **live from the Hetzner Cloud API** (`label_selector`,
default `env=prod`) rather than hardcoding it or reading deadly's Terraform state.
The only cross-project assumption is "that box exists and Caddy routes
`shop.<domain>` here." A recreated box just works; deadly's repo is never touched.

- **CI (recommended) — two workflows, mirroring deadly:**
  - **`build-images.yml`** builds + pushes `ghcr.io/ds17f/emma-shop:<sha>` (+ `latest`)
    on push to `main` (when app/image files change) or manual dispatch. The GHCR
    package must be **public** so the box can pull it (no registry auth, like deadly).
  - **`deploy.yml`** (`workflow_dispatch`) promotes a pre-built SHA to an
    **environment**: `environment` (beta|prod) → Hetzner label `env=<environment>`,
    `ref` (the built SHA, default `main`), `update_dns`. It verifies the image
    exists, resolves the IP, writes `/opt/emma-shop/.env` from the env's secrets,
    `docker compose pull && up -d`, probes the container, optionally updates DNS.

  Config via **GitHub Environments** (`beta`/`prod`):
  - env **secrets:** `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
    `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (optional — empty = checkout off)
  - env **vars:** `SHOP_ADDRESS` (e.g. `beta.comettail.shop`), `AUTH_URL`

  **Repo-level secrets** (shared): `HCLOUD_TOKEN`, `SSH_PRIVATE_KEY`, and
  `GODADDY_KEY`/`GODADDY_SECRET` (for `update_dns`). Push them with
  [`scripts/setup-github-secrets.sh`](./scripts/setup-github-secrets.sh) (reads
  from files — point it at the deadly-monorepo copies; re-run on rotation).

- **Manual — `make deploy`:** builds + pushes the image, resolves the IP from the
  Hetzner API, then SSHes in to pull + restart. Needs `HCLOUD_TOKEN` exported
  (same token), and an SSH key reachable via your ssh-agent / `~/.ssh/config`
  (or `SSH_KEY=/path/to/key`). Override auto-resolution with `REMOTE_HOST=<alias>`.
  `make server-ip` prints the resolved IP for sanity-checking.

  ```bash
  export HCLOUD_TOKEN=...           # Hetzner API token
  make deploy                       # auto-resolves the box, builds, pushes, deploys
  make deploy REMOTE_HOST=emma-box  # or target an explicit host/ssh-config alias
  ```

> The deploy SSH key is **never** vendored into this repo — keep it in your
> ssh-agent / `~/.ssh/config` locally, or as the `SSH_PRIVATE_KEY` CI secret.
> On the box, emma-shop's stack lives at `/opt/emma-shop` (compose + the prod
> `.env` from Part C); deploy only injects `IMAGE_TAG`, never app secrets.

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

## Part B — Built into deadly's deploy (additive, idempotent, beta + prod safe)

deadly's Caddy is the only thing on the box that binds `:80`/`:443` and terminates
TLS, so the shop is published *through* it. This is **wired into deadly's normal
`web-deploy`** — running a beta or prod deploy of deadly prepares everything on its
side, idempotently, without affecting deadly's own sites. The full rationale lives
in the deadly repo: **`docs/docs/developer/hosting-emma-shop.md`** (both repos stay
aware). The changes there:

1. **`Caddyfile`** — one additive block, env-driven so one baked image serves both
   environments:
   ```caddyfile
   {$SHOP_ADDRESS} {
       reverse_proxy emma-shop:3000
   }
   ```
2. **`docker-compose.yml`** — caddy joins the shared `web` network (keeping
   `default`) and gets a **never-empty** shop host:
   ```yaml
   caddy:
     environment:
       - SHOP_ADDRESS=${SHOP_ADDRESS:-shop.localhost}  # real domain on prod; inert default elsewhere
     networks: [default, web]
   networks:
     web: { external: true }
   ```
3. **`web-deploy.yml`** — `docker network create web 2>/dev/null || true` before
   `compose up` (idempotent, every deploy), and writes `SHOP_ADDRESS` from the
   per-env GitHub variable into the box `.env`.

**Why it's safe on both envs:** the shop host is a per-environment variable
(`SHOP_ADDRESS`), set only where the shop runs (**prod** = real domain). Where it's
unset (**beta**), compose's `:-shop.localhost` default kicks in — `*.localhost` is
an inert internal-cert host, so Caddy never requests a public cert and nothing
routes to it. Because compose always passes a non-empty value, the `{$SHOP_ADDRESS}`
block can never collapse to an empty (fatal) site address.

### Guardrails (each is a way to hurt deadly — all already handled)
1. **Network exists first** — the deploy's idempotent `docker network create web`
   runs before `compose up`; without it, `external: web` makes `compose up` fail.
2. **Never drop `default`** from the caddy service, or Caddy can't reach
   `api`/`ui`/`ws` and **deadly 502s**.
3. **Keep the shop host env-driven *with* the `:-shop.localhost` default** — a
   hardcoded domain breaks the other env; removing the default lets an unset var
   become a fatal empty site address.
4. emma-shop binds **no host ports** (`expose: 3000`) and uses its **own**
   volumes/db — if it's down, Caddy returns 502 only for `{$SHOP_ADDRESS}`.

> A deadly deploy prepares the *hosting* side; it does **not** start the shop
> container. emma-shop is deployed by its own pipeline (Part A / the GitHub Action)
> and joins the same `web` network. Until then `{$SHOP_ADDRESS}` just 502s.

---

## Part C — One-time host + DNS setup

1. **Shared network:** auto-created by deadly's deploy
   (`docker network create web || true`). Run it manually only if you deploy
   emma-shop before deadly has redeployed once.
2. **`SHOP_ADDRESS` (prod):** set the GitHub Actions **variable** `SHOP_ADDRESS`
   = `shop.<domain>` on deadly's **prod** environment, so deadly's Caddy serves
   that host. Leave it unset on beta (compose falls back to the inert default).
3. **DNS (GoDaddy):** add an `A` record `shop.<domain>` → Hetzner IP. (MX/email
   unaffected.) Wait for propagation before the first Caddy hit so LE can validate.
4. **Secrets on the box:** create emma-shop's `.env` (AUTH_SECRET via
   `openssl rand -base64 32`, Stripe live keys, admin creds). Never commit it.
5. **Stripe:** in the dashboard add webhook endpoint
   `https://shop.<domain>/api/webhooks/stripe` (event `checkout.session.completed`)
   and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## First-launch order

1. DNS A record `shop.<domain>` → Hetzner IP (propagate).
2. Set deadly's prod `SHOP_ADDRESS` variable = `shop.<domain>`.
3. Deploy deadly (prod) — creates the `web` network + adds the shop Caddy route.
4. Deploy emma-shop stack (joins `web`); it migrates + seeds admin on boot.
5. Hit https://shop.<domain> → Caddy issues the cert → live.

## Backups
- Database = the single file on `emma_db`. Cron a copy off-box.
- Product images = `emma_uploads` volume. Back these up too.

## Why not GoDaddy cPanel
Shared cPanel runs PHP/Apache/MySQL, not a long-running Next.js Node server
(server actions, Stripe webhook, admin) — and no Postgres/Docker. Good only for
the domain/DNS, which is exactly how we're using it here.
```
