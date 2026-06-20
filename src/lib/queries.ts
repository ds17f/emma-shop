import { prisma } from "@/lib/db";

const productInclude = {
  images: { orderBy: { position: "asc" as const } },
  variants: { orderBy: { createdAt: "asc" as const } },
  category: true,
};

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getFeaturedProducts() {
  return prisma.product.findMany({
    where: { active: true, featured: true },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: 6,
  });
}

export async function getProducts(opts?: { categorySlug?: string; search?: string }) {
  return prisma.product.findMany({
    where: {
      active: true,
      ...(opts?.categorySlug
        ? { category: { slug: opts.categorySlug } }
        : {}),
      ...(opts?.search
        ? {
            OR: [
              { name: { contains: opts.search } },
              { description: { contains: opts.search } },
            ],
          }
        : {}),
    },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
}

export type ProductWithRelations = Awaited<
  ReturnType<typeof getProductBySlug>
>;

/** Lowest variant price and total stock — handy for cards. */
export function productSummary(product: {
  variants: { priceCents: number; stock: number }[];
}) {
  const prices = product.variants.map((v) => v.priceCents);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const totalStock = product.variants.reduce((n, v) => n + v.stock, 0);
  return { minPrice, totalStock, inStock: totalStock > 0 };
}
