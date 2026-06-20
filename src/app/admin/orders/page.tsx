import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Orders</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-stone-500">No paid orders yet.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-stone-200 bg-white text-sm">
          <thead className="bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-stone-50">
                <td className="px-4 py-2">
                  <Link href={`/admin/orders/${o.id}`} className="block">
                    {o.createdAt.toLocaleDateString()}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.email || "—"}</td>
                <td className="px-4 py-2">{o._count.items}</td>
                <td className="px-4 py-2">{formatPrice(o.totalCents)}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
