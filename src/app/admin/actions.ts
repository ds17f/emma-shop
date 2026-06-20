"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { SETTINGS_ID } from "@/lib/settings";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

function dollarsToCents(value: FormDataEntryValue | null): number {
  return Math.max(0, Math.round(parseFloat(String(value || "0")) * 100));
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

// ---------- Store & shipping settings ----------

export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const freeShippingEnabled = formData.get("freeShippingEnabled") === "on";
  await prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {
      shopName: String(formData.get("shopName") ?? "").trim() || "Comet Tail Crafts",
      tagline: String(formData.get("tagline") ?? "").trim(),
      contactEmail: String(formData.get("contactEmail") ?? "").trim(),
      shippingFlatCents: dollarsToCents(formData.get("shippingFlat")),
      freeShippingThresholdCents: freeShippingEnabled
        ? dollarsToCents(formData.get("freeShippingThreshold"))
        : null,
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  redirect("/admin/settings?ok=1");
}

// ---------- Admin users & customers ----------

export async function changeOwnPassword(formData: FormData) {
  const session = await requireAdmin();
  const email = session.user?.email ?? "";
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  if (next.length < 8) redirect("/admin/users?error=length");

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
    redirect("/admin/users?error=current");
  }
  await prisma.adminUser.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  redirect("/admin/users?ok=password");
}

export async function createAdminUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) redirect("/admin/users?error=invalid");
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) redirect("/admin/users?error=exists");

  await prisma.adminUser.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?ok=created");
}

export async function deleteAdminUser(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) return;

  // Guard: can't delete yourself or the last remaining admin.
  if (target.email === session.user?.email) redirect("/admin/users?error=self");
  const count = await prisma.adminUser.count();
  if (count <= 1) redirect("/admin/users?error=last");

  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/users");
  redirect("/admin/users?ok=deleted");
}
