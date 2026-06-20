# Emma Shop — Build Plan / Spec

A custom e-commerce site for selling handmade goods (blankets, crochet, etc.).
Small catalog (<50 items), Stripe payments, self-owned codebase.

## Stack (decided)

- **Next.js (App Router, React, TypeScript)** — storefront, admin, and API routes in one app
- **SQLite + Prisma** — data layer (products, variants, inventory, orders). Single file, trivial backups; fine for a small shop. Easy to migrate to Postgres later if needed.
- **Stripe Checkout** — payments, receipts, Apple/Google Pay
- **Tailwind CSS** — responsive styling
- **NextAuth (credentials)** — protects the admin area
- **Image uploads** — product photos stored on disk (local in dev; on the server volume in prod)
- **Deploy target** — single cheap box: **Hetzner VPS (~€4/mo)** or **Fly.io**. SQLite file lives on the server's disk. Commercial-use is fine on a VPS. (Decide exact host at deploy time.)

## Data model (Prisma)

- **Product** — name, slug, description, category, images[], active flag
- **Variant** — belongs to Product; label (e.g. "Large / Blue"), price (cents), SKU, `stock` count
- **Category** — name, slug (Blankets, Crochet, Accessories, …)
- **Order** — customer email/name, shipping address, status, total, Stripe session id
- **OrderItem** — belongs to Order; variant snapshot (name/price at purchase), qty
- **AdminUser** — email, password hash

Inventory: each Variant has a `stock` count. Decremented when an order is paid.
"Sold out" shown when stock = 0. (Works for one-of-a-kind items too — stock 1.)

## Storefront (public)

1. **Home** — featured/recent products, category nav
2. **Catalog** (`/products`) — grid, filter by category, search by name
3. **Product detail** (`/products/[slug]`) — image gallery, variant picker, price, stock status, add-to-cart
4. **Cart** — line items, qty adjust, remove, subtotal (persisted in localStorage)
5. **Checkout** — redirect to Stripe Checkout; collects shipping + payment
6. **Confirmation** (`/order/success`) — order summary; Stripe emails the receipt

## Admin (`/admin`, login-protected)

1. **Login**
2. **Dashboard** — recent orders, low-stock alerts
3. **Products** — list / create / edit / delete, manage variants, upload images, set price & stock, toggle active
4. **Categories** — manage categories
5. **Orders** — list, view detail, update status (new → paid → shipped → fulfilled)

## Payments & inventory flow

1. Customer checks out → server creates a Stripe Checkout Session from cart
2. Stripe handles payment + collects shipping address
3. **Stripe webhook** on success → create `Order`, decrement variant `stock`
4. Customer redirected to confirmation page

## Shipping & tax (launch-simple)

- **Shipping**: flat-rate option(s) configured in Stripe Checkout
- **Tax**: Stripe Tax (automatic) or a simple flat rate — start simple, expand later

## Out of scope for v1 (easy to add later)

- Discount/coupon codes
- Customer accounts / order history login
- Multi-currency, reviews, wishlists, blog

## Build order

1. Scaffold Next.js + Tailwind + Prisma; define schema; run first migration
2. Seed sample categories + a few placeholder products
3. Storefront: catalog → product detail → cart
4. Stripe Checkout + success page + webhook + inventory decrement
5. Admin auth + product/category/order management + image upload
6. Polish: responsive styling, low-stock alerts, empty/error states
7. Deployment notes (env vars, Stripe keys, hosting)
