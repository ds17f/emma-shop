import { prisma } from "@/lib/db";
import { createCategory, deleteCategory } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminCategories() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <form action={createCategory} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="New category name"
          className="input"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Add
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-stone-500">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span>
                {c.name}{" "}
                <span className="text-stone-400">
                  ({c._count.products} products)
                </span>
              </span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-stone-400 hover:text-red-600"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
