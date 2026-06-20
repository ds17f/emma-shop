import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { updateOrderStatus } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const STATUSES = ["PAID", "SHIPPED", "FULFILLED", "CANCELLED"];

type ShippingSnapshot = {
  name?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) notFound();

  let shipping: ShippingSnapshot = {};
  try {
    shipping = JSON.parse(order.shippingAddress || "{}");
  } catch {
    // ignore
  }
  const addr = shipping.address;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/orders" className="text-sm text-stone-500 hover:text-stone-900">
        ← All orders
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order</h1>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">
          {order.status}
        </span>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <p className="text-stone-500">Placed {order.createdAt.toLocaleString()}</p>
        <p className="mt-2">
          <span className="text-stone-500">Email:</span> {order.email || "—"}
        </p>
        {(shipping.name || addr) && (
          <div className="mt-3">
            <p className="text-stone-500">Ship to:</p>
            {shipping.name && <p>{shipping.name}</p>}
            {addr && (
              <p>
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ""}
                <br />
                {addr.city}, {addr.state} {addr.postal_code}
                <br />
                {addr.country}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-stone-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.nameSnapshot}</td>
                <td className="px-4 py-3 text-stone-500">× {item.quantity}</td>
                <td className="px-4 py-3 text-right">
                  {formatPrice(item.priceCents * item.quantity)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-3" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 text-right">
                {formatPrice(order.totalCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <form action={updateOrderStatus} className="flex items-end gap-2">
        <input type="hidden" name="id" value={order.id} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Update status</span>
          <select name="status" defaultValue={order.status} className="input">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Save
        </button>
      </form>
    </div>
  );
}
