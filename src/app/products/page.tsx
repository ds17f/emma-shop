import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, getProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ category?: string; q?: string }>;

const CHIP_COLORS = ["bg-brand", "bg-teal", "bg-grape", "bg-tangerine", "bg-sky"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { category, q } = await searchParams;
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug: category, search: q }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">
          The <span className="text-brand">Shop</span> 🛸
        </h1>
        <form className="flex gap-2" action="/products">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search products…"
            className="input w-48"
          />
          <button type="submit" className="btn-teal btn-sm">
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/products"
          className={`chip ${!category ? "bg-ink text-white" : "bg-white text-ink"}`}
        >
          All
        </Link>
        {categories.map((c, i) => {
          const active = category === c.slug;
          const color = CHIP_COLORS[i % CHIP_COLORS.length];
          return (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className={`chip ${active ? `${color} text-white` : "bg-white text-ink"}`}
            >
              {c.name}
            </Link>
          );
        })}
      </div>

      {products.length === 0 ? (
        <p className="card p-10 text-center font-semibold text-ink/60">
          No products found{q ? ` for “${q}”` : ""}. 🧶
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} accent={i} />
          ))}
        </div>
      )}
    </div>
  );
}
