import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getFeaturedProducts } from "@/lib/queries";

export default async function HomePage() {
  const featured = await getFeaturedProducts();

  return (
    <div className="space-y-14">
      <section className="stars relative overflow-hidden rounded-[2rem] border-2 border-ink bg-space p-10 text-center shadow-[6px_6px_0_0_var(--color-ink)] sm:p-16">
        {/* cosmic decorations */}
        <span className="absolute -left-6 -top-6 h-24 w-24 rounded-full border-2 border-ink bg-sun" />
        <span className="absolute right-10 top-10 text-4xl">🪐</span>
        <span className="absolute bottom-8 left-10 text-3xl">✨</span>
        <span className="absolute -bottom-8 right-8 h-20 w-20 rounded-full border-2 border-ink bg-grape" />

        <div className="relative">
          <span className="inline-block rounded-full border-2 border-ink bg-white px-4 py-1 text-sm font-bold">
            🐱 handmade across the galaxy ☄️
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold leading-tight text-white drop-shadow-[2px_2px_0_var(--color-ink)] sm:text-6xl">
            Cozy blankets &amp; crochet,
            <span className="text-brand"> from the stars</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-white/90">
            One-of-a-kind handmade pieces. Warm enough for deep space, cute
            enough for your cat. 🚀
          </p>
          <Link href="/products" className="btn-primary mt-8 text-base">
            Explore the shop →
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-bold">
            Featured <span className="text-brand">picks</span> ✦
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} accent={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
