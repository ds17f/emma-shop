import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { getProductBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const mainImage = product.images[0] ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-block font-bold text-ink/60 hover:text-ink"
      >
        ← Back to shop
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-3xl border-2 border-ink bg-page shadow-[5px_5px_0_0_var(--color-ink)]">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainImage.url}
                alt={mainImage.alt || product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center font-bold text-ink/40">
                No image
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt || product.name}
                  className="aspect-square w-full rounded-xl border-2 border-ink object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {product.category && (
            <Link
              href={`/products?category=${product.category.slug}`}
              className="inline-block rounded-full border-2 border-ink bg-highlight px-3 py-1 text-sm font-bold"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="text-4xl font-bold leading-tight">{product.name}</h1>

          <AddToCart
            productName={product.name}
            productSlug={product.slug}
            imageUrl={mainImage?.url ?? null}
            variants={product.variants.map((v) => ({
              id: v.id,
              label: v.label,
              priceCents: v.priceCents,
              stock: v.stock,
            }))}
          />

          {product.description && (
            <p className="whitespace-pre-line pt-2 font-medium leading-relaxed text-ink/80">
              {product.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
