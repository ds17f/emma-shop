import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { productSummary } from "@/lib/queries";
import { deleteProduct } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const products = await prisma.product.findMany({
    include: { variants: true, category: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          + New product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-stone-500">No products yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full overflow-hidden rounded-lg border border-stone-200 bg-white text-sm">
          <thead className="bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {products.map((p) => {
              const { minPrice, totalStock } = productSummary(p);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-stone-500">
                    {p.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2">{formatPrice(minPrice)}</td>
                  <td className="px-4 py-2">{totalStock}</td>
                  <td className="px-4 py-2">
                    {p.active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-stone-400">Hidden</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="text-stone-600 underline"
                    >
                      Edit
                    </Link>
                    <form action={deleteProduct} className="ml-3 inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="text-stone-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
