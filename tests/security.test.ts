import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { encode } from "next-auth/jwt";
import Stripe from "stripe";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { csvCell, imageExtension } from "../src/lib/security";

const origin = "http://localhost:3317";
const secret = "security-test-only-secret-at-least-32-characters";
const webhookSecret = "whsec_security_test_only";
let directory: string;
let server: ChildProcess;
let db: PrismaClient;
let cookie: string;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "emma-security-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env, DATABASE_URL: databaseUrl, AUTH_URL: origin,
    AUTH_SECRET: secret, STRIPE_SECRET_KEY: "sk_test_security_only",
    STRIPE_WEBHOOK_SECRET: webhookSecret, RESEND_API_KEY: "",
    ADMIN_EMAIL: "", ADMIN_PASSWORD: "", NODE_ENV: "production",
  };
  execFileSync("node_modules/.bin/prisma", ["migrate", "deploy"], { env, stdio: "pipe" });
  db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
  const admin = await db.adminUser.create({ data: {
    email: "security@example.test", passwordHash: "test-password-hash",
  } });
  const token = await encode({ secret, salt: "authjs.session-token", token: {
    sub: admin.id, email: admin.email,
    passwordVersion: createHash("sha256").update(admin.passwordHash).digest("hex"),
  } });
  cookie = `authjs.session-token=${token}`;
  server = spawn("node_modules/.bin/next", ["start", "-p", "3317"], { env, stdio: "pipe" });
  let output = "";
  server.stderr?.on("data", (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(`${origin}/api/auth/session`);
      return;
    } catch {
      if (server.exitCode !== null) throw new Error(output);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Test server did not start: ${output}`);
});

after(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await stopped;
  }
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("CSV export neutralizes formulas and quotes multiline values", () => {
  for (const value of ["=HYPERLINK(\"https://evil.test\")", "+cmd", "-cmd", "@SUM(1)", "\t=1+1"]) {
    assert.ok(csvCell(value).includes("'"));
  }
  assert.equal(csvCell('Alice, "Bob"\r\n'), '"Alice, ""Bob""\r\n"');
  assert.equal(csvCell(12), "12");
});

test("image detection rejects active content and accepts raster signatures", () => {
  for (const value of ["<svg onload='alert(1)'/>", "<html>evil</html>", "", "RIFF"]) {
    assert.equal(imageExtension(Buffer.from(value)), null);
  }
  assert.equal(imageExtension(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "png");
  assert.equal(imageExtension(Buffer.from([255, 216, 255])), "jpg");
  assert.equal(imageExtension(Buffer.from("GIF89a")), "gif");
  assert.equal(imageExtension(Buffer.from("RIFF0000WEBP")), "webp");
});

test("admin pages and APIs reject unauthenticated requests", async () => {
  for (const path of ["/admin", "/admin/orders", "/admin/users", "/admin/products/new"]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.ok([302, 303, 307].includes(response.status), path);
    assert.ok(response.headers.get("location")?.includes("/admin/login"));
  }
  assert.equal((await fetch(`${origin}/api/admin/orders/export`)).status, 401);
  assert.equal((await fetch(`${origin}/api/admin/upload`, { method: "POST" })).status, 401);
});

test("checkout rejects a forged origin and duplicate variants before payment calls", async () => {
  const forged = await fetch(`${origin}/api/checkout`, {
    method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" },
    body: JSON.stringify({ items: [{ variantId: "test", quantity: 1 }] }),
  });
  assert.equal(forged.status, 403);
  for (const items of [
    [{ variantId: "test", quantity: 1 }, { variantId: "test", quantity: 1 }],
    [{ variantId: "test", quantity: 1000 }],
  ]) {
    const response = await fetch(`${origin}/api/checkout`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ items }),
    });
    assert.equal(response.status, 400);
  }
});

test("authenticated uploads reject SVG and HTML disguised as an image", async () => {
  for (const [type, filename] of [["image/svg+xml", "evil.svg"], ["image/png", "evil.html"]]) {
    const form = new FormData();
    form.set("file", new File(["<svg onload='alert(1)'/>"], filename, { type }));
    const response = await fetch(`${origin}/api/admin/upload`, {
      method: "POST", headers: { origin, cookie }, body: form,
    });
    assert.equal(response.status, 400);
  }
});

test("signed webhooks require payment and the correct session, and decrement stock once", async () => {
  const product = await db.product.create({ data: {
    name: "Security test", slug: "security-test",
    variants: { create: { label: "Default", priceCents: 1000, stock: 10 } },
  }, include: { variants: true } });
  const variant = product.variants[0];
  const order = await db.order.create({ data: {
    email: "", totalCents: 1000, stripeSessionId: "cs_test_security",
    items: { create: { variantId: variant.id, nameSnapshot: product.name, quantity: 1, priceCents: 1000 } },
  } });
  async function deliver(paymentStatus: string, sessionId = "cs_test_security") {
    const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: {
      id: sessionId, metadata: { orderId: order.id }, payment_status: paymentStatus,
      amount_total: 1000, customer_details: { email: "buyer@example.test" },
    } } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    return fetch(`${origin}/api/webhooks/stripe`, {
      method: "POST", headers: { "stripe-signature": signature }, body: payload,
    });
  }
  assert.equal((await deliver("unpaid")).status, 200);
  assert.equal((await deliver("paid", "cs_wrong")).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
  const responses = await Promise.all([deliver("paid"), deliver("paid")]);
  for (const response of responses) assert.equal(response.status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock, 9);
  assert.equal((await fetch(`${origin}/api/webhooks/stripe`, {
    method: "POST", headers: { "stripe-signature": "invalid" }, body: "{}",
  })).status, 400);
});

test("password changes revoke existing admin sessions", async () => {
  assert.equal((await fetch(`${origin}/api/admin/orders/export`, { headers: { cookie } })).status, 200);
  await db.adminUser.updateMany({ data: { passwordHash: "changed-hash" } });
  assert.equal((await fetch(`${origin}/api/admin/orders/export`, { headers: { cookie } })).status, 401);
});
