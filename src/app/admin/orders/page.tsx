import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["ALL", "PAID", "SHIPPED", "FULFILLED", "CANCELLED"];

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const activeStatus = status && STATUS_FILTERS.includes(status) ? status : "ALL";

  const where: Prisma.OrderWhereInput = {
    status: activeStatus === "ALL" ? { not: "PENDING" } : activeStatus,
    ...(q ? { email: { contains: q } } : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const exportHref = `/api/admin/orders/export?status=${activeStatus}${
    q ? `&q=${encodeURIComponent(q)}` : ""
  }`;

  function tabHref(s: string) {
    const p = new URLSearchParams();
    if (s !== "ALL") p.set("status", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders 📦</h1>
        <a href={exportHref} className="btn-white btn-sm">
          ⬇ Export CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={tabHref(s)}
              className={`chip ${
                activeStatus === s ? "bg-ink text-white" : "bg-white text-ink"
              }`}
            >
              {s === "ALL" ? "All" : s}
            </Link>
          ))}
        </div>
        <form action="/admin/orders" className="flex gap-2">
          {activeStatus !== "ALL" && (
            <input type="hidden" name="status" value={activeStatus} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search email…"
            className="input w-48"
          />
          <button type="submit" className="btn-teal btn-sm">
            Search
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="card p-8 text-center font-semibold text-ink/60">
          No orders found.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] overflow-hidden rounded-2xl border-2 border-ink bg-white text-sm">
          <thead className="bg-cream text-left text-ink/60">
            <tr>
              <th className="px-4 py-2 font-bold">Date</th>
              <th className="px-4 py-2 font-bold">Customer</th>
              <th className="px-4 py-2 font-bold">Items</th>
              <th className="px-4 py-2 font-bold">Total</th>
              <th className="px-4 py-2 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-cream/60">
                <td className="px-4 py-2">
                  <Link href={`/admin/orders/${o.id}`} className="block font-semibold">
                    {o.createdAt.toLocaleDateString()}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.email || "—"}</td>
                <td className="px-4 py-2">{o._count.items}</td>
                <td className="px-4 py-2">{formatPrice(o.totalCents)}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full border-2 border-ink bg-cream px-2 py-0.5 text-xs font-bold">
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
