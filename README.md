# Comet Tail Crafts 🐱☄️

A small, self-owned e-commerce site for selling handmade goods (blankets, crochet,
etc.) — storefront + CMS/admin + cart + Stripe checkout + inventory, all in one
codebase. Space/cat theme.

**Stack:** Next.js 16 (App Router, TypeScript) · SQLite + Prisma · Stripe Checkout
· Tailwind CSS v4 · NextAuth (Auth.js v5).

> **Coming back after a while?** Jump to [Returning to this project](#returning-to-this-project)
> for the "get it running again" cheat sheet. Run `make help` to list every command.

---

## What it does

- **Storefront** — home, catalog with category filter + search, product detail
  with image gallery + variant picker + live stock, cart (localStorage), Stripe
  checkout, order confirmation.
- **Admin** (`/admin`, login-protected):
  - Dashboard with low-stock alerts
  - Products: create/edit/delete, multiple variants (price + stock each), image upload
  - Categories
  - Orders: status filter, email search, CSV export, per-order status updates
  - **Users**: change your password, add/remove admins, customers list
  - **Settings**: shop name/tagline/contact email + shipping (flat rate + optional
    free-shipping threshold)
- **Inventory** — per-variant stock; auto-decrements when an order is paid (via the
  Stripe webhook); shows "Sold out" at zero (handles one-of-a-kind items).

See [`PLAN.md`](./PLAN.md) for the original spec and [`DEPLOY.md`](./DEPLOY.md) for
the production/hosting plan.

---

## Quick start (local development)

Requires Node 22+.

```bash
make setup     # installs deps, copies .env, runs migrations, seeds sample data
# → edit .env to set AUTH_SECRET (npx auth secret) and admin creds
make dev       # http://localhost:3000
```

Default seeded admin: **`admin@example.com` / `changeme123`** → sign in at
**`/admin`**. Change `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` before seeding, or
change the password later in the admin Users page.

### Everyday commands (`make help` for all)

| Command | What it does |
|---|---|
| `make dev` | Dev server (hot reload) |
| `make build` / `make start` | Production build / run it locally |
| `make lint` / `make typecheck` | ESLint / TypeScript check |
| `make db-migrate` | Create + apply a new dev migration |
| `make db-seed` | Seed sample data + admin (**dev only**) |
| `make db-studio` | Browse/edit the DB in Prisma Studio |
| `make db-reset` | Wipe local DB, re-migrate, re-seed (**dev only**) |
| `make docker-run` | Build + run the prod image locally on :3002 |
| `make docker-logs` / `make docker-stop` | Tail / stop the local container |

---

## Environment variables

Set in `.env` (copy from `.env.example`). Never commit `.env`.

| Variable | Required | What it's for |
|---|---|---|
| `DATABASE_URL` | yes | SQLite path, e.g. `file:./dev.db` (prod: `file:/app/data/prod.db`) |
| `AUTH_SECRET` | yes | NextAuth signing secret. Generate: `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_URL` | prod | Public URL, e.g. `https://shop.example.com` |
| `AUTH_TRUST_HOST` | prod | `true` for self-hosting (also hard-coded via `trustHost` in `src/auth.config.ts`) |
| `STRIPE_SECRET_KEY` | for checkout | Stripe API key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | for checkout | Signing secret for the Stripe webhook |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first run | Admin account created by the seed / `ensure-admin` |

---

## Stripe checkout (test mode)

1. Create a Stripe account → put your **test** secret key in `STRIPE_SECRET_KEY`.
2. Forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET`.
3. Checkout uses Stripe-hosted Checkout. Test card `4242 4242 4242 4242`, any future
   expiry/CVC.
4. On payment, the webhook marks the order **PAID** and decrements inventory.

Shipping is configured in the admin **Settings** page (flat rate + optional
free-shipping threshold), read at checkout in `src/app/api/checkout/route.ts`.
For sales tax, enable Stripe Tax and add `automatic_tax` to the Checkout session.

---

## Running the production image locally

```bash
make docker-run    # builds the image, runs it on http://localhost:3002
make docker-logs   # watch boot: migrate → ensure-admin → server ready
make docker-stop
```

The image runs `next start` with `node_modules` present so the `better-sqlite3`
native binding + Prisma CLI are available. The entrypoint
(`docker-entrypoint.sh`) runs `prisma migrate deploy`, then `ensure-admin`, then
starts the server.

---

## Deploying to production

Full plan in [`DEPLOY.md`](./DEPLOY.md). Summary: the shop runs as its own
Docker Compose stack on a Hetzner box, behind the existing **deadly** Caddy
(which handles Let's Encrypt TLS automatically). The two projects are
independent — they share only a Docker network and one Caddy route.

**One-time on the box / DNS:**
1. `docker network create web`
2. Point DNS `shop.<domain>` (A record) → the server IP.
3. Put a production `.env` on the box (AUTH_SECRET, **live** Stripe keys, admin creds, `AUTH_URL=https://shop.<domain>`).
4. In the **deadly** repo: add a Caddy block `shop.<domain> { reverse_proxy emma-shop:3000 }` and attach Caddy to the `web` network → its CI redeploys Caddy.
5. Stripe Dashboard: add webhook `https://shop.<domain>/api/webhooks/stripe` (event `checkout.session.completed`).

**Each deploy** (two ways, both resolve the box's IP live from the Hetzner API —
nothing is hardcoded):
```bash
# CI (recommended): push to main → .github/workflows/deploy.yml builds→GHCR→deploys.
#   Needs repo secrets HCLOUD_TOKEN + SSH_PRIVATE_KEY (see DEPLOY.md §5).

# Manual:
export HCLOUD_TOKEN=...                    # Hetzner API token
make deploy                                # builds, pushes to GHCR, pulls + restarts on the box
make deploy REMOTE_HOST=<ssh-alias>        # or target an explicit host instead of auto-resolving
```
The container entrypoint applies migrations automatically. The deploy SSH key is
never stored in the repo — keep it in ssh-agent / `~/.ssh/config` (or the CI
`SSH_PRIVATE_KEY` secret).

### Backups
- **Database** = the single SQLite file on the `emma_db` volume. Cron a copy off-box.
- **Uploaded images** = the `emma_uploads` volume (`/app/public/uploads`). Back these up too.

---

## Project layout

```
prisma/schema.prisma          data model (Product, Variant, Category, Order, AdminUser, StoreSettings)
prisma/seed.ts                sample data + admin (dev only)
prisma/ensure-admin.ts        idempotent admin bootstrap (runs on container start)
src/lib/db.ts                 Prisma client (SQLite driver adapter)
src/lib/queries.ts            storefront data access
src/lib/settings.ts           store settings accessor (singleton)
src/lib/cart.tsx              client cart (localStorage)
src/lib/stripe.ts             Stripe client
src/auth.ts, auth.config.ts   NextAuth setup (admin login; trustHost for prod)
middleware.ts                 gates /admin routes
src/app/                      storefront pages (page.tsx, products/, cart/, order/)
src/app/admin/                admin: dashboard, products, categories, orders, users, settings
src/app/admin/actions.ts      admin server actions (CRUD, settings, users)
src/app/api/checkout/         creates the Stripe Checkout session (reads shipping settings)
src/app/api/webhooks/stripe/  payment → order + inventory decrement
src/app/api/admin/upload/     product image upload
src/app/api/admin/orders/export/  orders CSV export
Dockerfile, docker-compose.yml, docker-entrypoint.sh   containerization
```

---

## Returning to this project

After a long break, to get back up and running locally:

```bash
git pull
make install        # refresh deps
make db-migrate     # apply any new migrations (or `make db-reset` for a clean dev DB)
make dev            # http://localhost:3000  — admin at /admin
```

If something's off, see Troubleshooting below, then `make help` for all commands.
The architecture and deploy details live in [`DEPLOY.md`](./DEPLOY.md).

---

## Troubleshooting / gotchas (learned the hard way)

- **Admin login redirects back / `UntrustedHost` in production.** NextAuth needs a
  trusted host in prod. We set `trustHost: true` in `src/auth.config.ts` and
  `AUTH_TRUST_HOST=true` in the prod env. If you fork the auth setup, keep this.
- **Changes to the app don't show up when testing the prod build.** A stale
  `next start` / container may still own the port. Check: `ss -ltnp | grep :3000`
  (or `:3002` for the container); kill the old PID. The dev server (`make dev`)
  hot-reloads and avoids this.
- **Favicon/logo looks old.** Browsers cache favicons hard — hard-refresh or open
  a new tab. The files live in `src/app/favicon.ico` + `src/app/icon.png`.
- **Docker build fails needing a database.** The root layout is `force-dynamic`
  precisely so the build never touches the DB. Don't remove that without
  providing a DB at build time.
- **`better-sqlite3` errors in the container.** It's a native module compiled in
  the Docker build stage; the runtime stage must keep `node_modules` (we don't use
  Next `standalone` for this reason). Rebuild the image after dependency changes.
- **Empty catalog in production.** Expected — prod starts with only the admin user
  (sample products are dev-only via `make db-seed`). Add real products in `/admin`.
```
