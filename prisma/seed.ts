import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Admin user ---
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, name: "Shop Owner" },
  });
  console.log(`Admin user ready: ${adminEmail} (password: ${adminPassword})`);

  // --- Categories ---
  const categories = [
    { name: "Blankets", slug: "blankets" },
    { name: "Crochet", slug: "crochet" },
    { name: "Accessories", slug: "accessories" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }
  const blankets = await prisma.category.findUniqueOrThrow({
    where: { slug: "blankets" },
  });
  const crochet = await prisma.category.findUniqueOrThrow({
    where: { slug: "crochet" },
  });
  const accessories = await prisma.category.findUniqueOrThrow({
    where: { slug: "accessories" },
  });

  // --- Products ---
  type SeedProduct = {
    slug: string;
    name: string;
    description: string;
    categoryId: string;
    featured?: boolean;
    image: { url: string; alt: string };
    variants: { label: string; priceCents: number; stock: number }[];
  };

  const products: SeedProduct[] = [
    {
      slug: "chunky-knit-throw",
      name: "Chunky Knit Throw Blanket",
      description:
        "Hand-knit chunky throw in soft merino wool. Cozy, warm, and perfect for the couch.",
      categoryId: blankets.id,
      featured: true,
      image: { url: "/uploads/sample-blanket.svg", alt: "Chunky knit throw" },
      variants: [
        { label: "Cream", priceCents: 8500, stock: 3 },
        { label: "Slate Grey", priceCents: 8500, stock: 2 },
      ],
    },
    {
      slug: "granny-square-baby-blanket",
      name: "Granny Square Baby Blanket",
      description:
        "Classic crocheted granny-square blanket sized for a crib. Machine washable cotton.",
      categoryId: crochet.id,
      featured: true,
      image: { url: "/uploads/sample-crochet.svg", alt: "Granny square blanket" },
      variants: [{ label: "One size", priceCents: 4500, stock: 5 }],
    },
    {
      slug: "crochet-beanie",
      name: "Crochet Beanie",
      description: "Warm ribbed beanie with a faux-fur pom. Stretchy, one-size-fits-most.",
      categoryId: accessories.id,
      image: { url: "/uploads/sample-beanie.svg", alt: "Crochet beanie" },
      variants: [
        { label: "Mustard", priceCents: 2200, stock: 4 },
        { label: "Forest Green", priceCents: 2200, stock: 0 },
      ],
    },
    {
      slug: "one-of-a-kind-patchwork-quilt",
      name: "One-of-a-Kind Patchwork Quilt",
      description:
        "A unique patchwork quilt sewn from reclaimed fabrics. There is only one!",
      categoryId: blankets.id,
      image: { url: "/uploads/sample-quilt.svg", alt: "Patchwork quilt" },
      variants: [{ label: "Unique piece", priceCents: 14000, stock: 1 }],
    },
  ];

  for (const p of products) {
    const { image, variants, ...data } = p;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...data,
        images: { create: { url: image.url, alt: image.alt } },
        variants: { create: variants },
      },
    });
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
