// Idempotently ensures an admin user exists, from ADMIN_EMAIL / ADMIN_PASSWORD.
// Safe to run on every container start: it never overwrites an existing admin's
// password and never touches product/category data.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("[ensure-admin] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping.");
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`[ensure-admin] Admin already exists: ${email}`);
  } else {
    await prisma.adminUser.create({
      data: {
        email,
        name: "Shop Owner",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`[ensure-admin] Created admin: ${email}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[ensure-admin] failed:", e);
  process.exit(1);
});
