"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- Categories ----------

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const slug = slugify(String(formData.get("slug") || name));
  await prisma.category.create({ data: { name, slug } });
  revalidatePath("/admin/categories");
  revalidatePath("/products");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
}

// ---------- Products ----------

const variantSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
});

const imageSchema = z.object({ url: z.string().min(1), alt: z.string().default("") });

const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  categoryId: z.string().optional().nullable(),
  active: z.boolean(),
  featured: z.boolean(),
  variants: z.array(variantSchema).min(1),
  images: z.array(imageSchema),
});

function parseProductForm(formData: FormData) {
  const rawVariants = JSON.parse(String(formData.get("variants") || "[]"));
  const rawImages = JSON.parse(String(formData.get("images") || "[]"));
  const name = String(formData.get("name") ?? "").trim();
  return productSchema.parse({
    name,
    slug: slugify(String(formData.get("slug") || name)),
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") || "") || null,
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
    variants: rawVariants,
    images: rawImages,
  });
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const data = parseProductForm(formData);
  await prisma.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      categoryId: data.categoryId,
      active: data.active,
      featured: data.featured,
      variants: {
        create: data.variants.map((v) => ({
          label: v.label,
          priceCents: v.priceCents,
          stock: v.stock,
        })),
      },
      images: {
        create: data.images.map((img, i) => ({
          url: img.url,
          alt: img.alt,
          position: i,
        })),
      },
    },
  });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function updateProduct(productId: string, formData: FormData) {
  await requireAdmin();
  const data = parseProductForm(formData);

  const existing = await prisma.variant.findMany({
    where: { productId },
    select: { id: true },
  });
  const submittedIds = new Set(
    data.variants.filter((v) => v.id).map((v) => v.id as string),
  );
  const toDelete = existing.filter((v) => !submittedIds.has(v.id)).map((v) => v.id);

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        categoryId: data.categoryId,
        active: data.active,
        featured: data.featured,
      },
    }),
    // Remove variants the admin deleted (order line items keep their snapshot).
    prisma.variant.deleteMany({ where: { id: { in: toDelete } } }),
    // Upsert remaining/new variants.
    ...data.variants.map((v) =>
      v.id
        ? prisma.variant.update({
            where: { id: v.id },
            data: { label: v.label, priceCents: v.priceCents, stock: v.stock },
          })
        : prisma.variant.create({
            data: {
              productId,
              label: v.label,
              priceCents: v.priceCents,
              stock: v.stock,
            },
          }),
    ),
    // Replace images wholesale.
    prisma.productImage.deleteMany({ where: { productId } }),
    ...data.images.map((img, i) =>
      prisma.productImage.create({
        data: { productId, url: img.url, alt: img.alt, position: i },
      }),
    ),
  ]);

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

// ---------- Orders ----------

const ORDER_STATUSES = ["PENDING", "PAID", "SHIPPED", "FULFILLED", "CANCELLED"];

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!ORDER_STATUSES.includes(status)) return;
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}
