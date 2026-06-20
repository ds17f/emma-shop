import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 2;

export default async function AdminDashboard() {
  const [recentOrders, lowStock, productCount, pendingPaid] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.variant.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      include: { product: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.product.count(),
    prisma.order.count({ where: { status: "PAID" } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Products" value={productCount} />
        <Stat label="Orders to ship" value={pendingPaid} />
        <Stat label="Low-stock items" value={lowStock.length} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-stone-600 underline">
            All orders
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-stone-500">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                >
                  <span className="text-sm">
                    {o.email || "—"}{" "}
                    <span className="text-stone-400">
                      {o.createdAt.toLocaleDateString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                      {o.status}
                    </span>
                    {formatPrice(o.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Low stock</h2>
        {lowStock.length === 0 ? (
          <p className="text-sm text-stone-500">Everything is well stocked.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {lowStock.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>
                  {v.product.name}{" "}
                  <span className="text-stone-400">({v.label})</span>
                </span>
                <span
                  className={
                    v.stock === 0 ? "font-medium text-red-600" : "text-amber-600"
                  }
                >
                  {v.stock} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  );
}
