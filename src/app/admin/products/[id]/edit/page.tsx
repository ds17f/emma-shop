import { notFound } from "next/navigation";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";
import { prisma } from "@/lib/db";
import { getCategories } from "@/lib/queries";
import { updateProduct } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
    }),
    getCategories(),
  ]);
  if (!product) notFound();

  const initial: ProductFormData = {
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    active: product.active,
    featured: product.featured,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: v.label,
      priceDollars: (v.priceCents / 100).toFixed(2),
      stock: String(v.stock),
    })),
    images: product.images.map((img) => ({ url: img.url, alt: img.alt })),
  };

  const action = updateProduct.bind(null, product.id);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Edit product</h1>
      <ProductForm action={action} categories={categories} initial={initial} />
    </div>
  );
}
