import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { productSummary } from "@/lib/queries";

type Props = {
  product: {
    slug: string;
    name: string;
    images: { url: string; alt: string }[];
    variants: { priceCents: number; stock: number }[];
  };
  accent?: number;
};

// Rotating playful accent colors for the price tag.
const ACCENTS = ["bg-primary", "bg-secondary", "bg-accent1", "bg-accent2", "bg-accent3"];

export function ProductCard({ product, accent = 0 }: Props) {
  const { minPrice, inStock } = productSummary(product);
  const image = product.images[0];
  const tag = ACCENTS[accent % ACCENTS.length];

  return (
    <Link
      href={`/products/${product.slug}`}
      className="card group block overflow-hidden transition-transform duration-100 hover:-translate-y-1 hover:rotate-[-1deg]"
    >
      <div className="relative aspect-square overflow-hidden border-b-2 border-ink bg-page">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt || product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-bold text-ink/40">
            No image
          </div>
        )}
        {!inStock && (
          <span className="absolute left-2 top-2 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold">
            Sold out 😢
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <h3 className="font-display font-semibold leading-tight text-ink">
          {product.name}
        </h3>
        <span
          className={`shrink-0 rounded-full border-2 border-ink ${tag} px-2.5 py-1 text-xs font-bold text-white`}
        >
          {formatPrice(minPrice)}
        </span>
      </div>
    </Link>
  );
}
