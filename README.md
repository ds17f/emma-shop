# The Shop — handmade goods e-commerce

A small, self-owned e-commerce site for selling handmade goods (blankets, crochet, etc.).
Storefront + CMS/admin + cart + Stripe checkout + inventory, all in one codebase.

**Stack:** Next.js (App Router, TypeScript) · SQLite + Prisma · Stripe Checkout · Tailwind CSS · NextAuth (Auth.js).

See [`PLAN.md`](./PLAN.md) for the full feature spec.

## Features

- **Storefront** — home, catalog with category filter + search, product detail with image gallery and variant picker, cart (localStorage), Stripe checkout, order confirmation.
- **Admin** (`/admin`, login-protected) — dashboard with low-stock alerts, product/variant/category management with image upload, order list + detail with status updates.
- **Inventory** — per-variant stock; auto-decrements when an order is paid (via Stripe webhook); shows "Sold out" at zero (handles one-of-a-kind items).

## Local setup

```bash
npm install
cp .env.example .env          # then fill in values (see below)
npx prisma migrate dev        # create the SQLite database
npm run db:seed               # sample categories, products, and an admin user
npm run dev                   # http://localhost:3000
```

The seed prints the admin login (default `admin@example.com` / `changeme123`).
Sign in at **`/admin`**. Change these via `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding.

### Environment variables

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | SQLite file path, e.g. `file:./dev.db` |
| `AUTH_SECRET` | NextAuth signing secret. Generate: `npx auth secret` |
| `STRIPE_SECRET_KEY` | Stripe API key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin account created by the seed |

## Stripe (test mode)

1. Create a free Stripe account → copy your **test** secret key into `STRIPE_SECRET_KEY`.
2. Forward webhooks to your local app with the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
3. Checkout uses Stripe-hosted Checkout. Test card: `4242 4242 4242 4242`, any future expiry/CVC.
4. On successful payment Stripe calls the webhook, which marks the order **PAID** and decrements inventory.

Shipping is a flat rate (`FLAT_SHIPPING_CENTS` in `src/lib/stripe.ts`). For automatic sales tax, enable Stripe Tax and add `automatic_tax` to the Checkout session in `src/app/api/checkout/route.ts`.

## Deployment (Hetzner / any small VPS)

This runs as a single Node process with a SQLite file on disk — ideal for one cheap box (~€4/mo).

```bash
# on the server (Node 20+ installed)
git clone <repo> && cd emma-shop
npm ci
cp .env.example .env          # set DATABASE_URL, AUTH_SECRET, Stripe keys, admin creds
npx prisma migrate deploy     # apply migrations (npm run db:deploy)
npm run db:seed               # first time only — creates admin user
npm run build
npm start                     # serves on :3000
```

Then:
- Put **Caddy** or **Nginx** in front for HTTPS (Caddy auto-provisions TLS — easiest).
- Run the app under a process manager (`pm2`, a `systemd` unit, or Docker) so it restarts on reboot/crash.
- In the Stripe Dashboard, add a **webhook endpoint** → `https://yourdomain/api/webhooks/stripe` (event: `checkout.session.completed`) and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

### Backups & notes

- The whole database is the single SQLite file (`DATABASE_URL`). Back it up by copying that file (cron + offsite copy).
- Uploaded product images live in `public/uploads/` — back these up too (they're git-ignored). On a single VPS this is fine; if you ever move to multi-server or serverless hosting, switch uploads to object storage (S3/R2) and the DB to Postgres (the Prisma schema ports over with minimal changes).

## Project layout

```
prisma/schema.prisma        data model
prisma/seed.ts              sample data + admin user
src/lib/db.ts               Prisma client (SQLite adapter)
src/lib/queries.ts          storefront data access
src/lib/cart.tsx            client cart (localStorage)
src/lib/stripe.ts           Stripe client + shipping config
src/auth.ts, auth.config.ts NextAuth setup (admin login)
src/app/page.tsx, products/, cart/, order/  storefront pages
src/app/admin/*             admin dashboard, products, categories, orders
src/app/admin/actions.ts    admin server actions (CRUD)
src/app/api/checkout        creates Stripe Checkout session
src/app/api/webhooks/stripe payment → order + inventory
src/app/api/admin/upload    product image upload
```
