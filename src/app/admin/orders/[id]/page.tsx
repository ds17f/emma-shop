import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { updateOrderStatus } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { RefundForm } from "@/components/admin/RefundForm";

export const dynamic = "force-dynamic";

const STATUSES = ["PAID", "SHIPPED", "FULFILLED", "CANCELLED", "REFUNDED"];

const REFUND_MESSAGES: Record<string, string> = {
  refunded: "Refund issued.",
  amount: "Invalid refund amount.",
  nopayment: "No Stripe payment found for this order.",
  stripe: "Stripe refused the refund — check the dashboard.",
  notfound: "Order not found.",
};

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const banner = ok
    ? { good: true, text: REFUND_MESSAGES[ok] ?? "Done." }
    : error
      ? { good: false, text: REFUND_MESSAGES[error] ?? "Something went wrong." }
      : null;
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

  // Refundable only once money was actually collected, and only what's left.
  const remaining = order.totalCents - order.refundedCents;
  const paid = ["PAID", "SHIPPED", "FULFILLED", "REFUNDED"].includes(order.status);
  const canRefund =
    paid && remaining > 0 && !!(order.stripePaymentIntentId || order.stripeSessionId);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/orders" className="text-sm text-stone-500 hover:text-stone-900">
        ← All orders
      </Link>

      {banner && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            banner.good
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.text}
        </p>
      )}

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
            {order.refundedCents > 0 && (
              <tr className="text-red-700">
                <td className="px-4 py-3" colSpan={2}>
                  Refunded
                </td>
                <td className="px-4 py-3 text-right">
                  −{formatPrice(order.refundedCents)}
                </td>
              </tr>
            )}
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
        <ConfirmButton
          message="Change this order's status?"
          className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Save
        </ConfirmButton>
      </form>

      {canRefund && <RefundForm orderId={order.id} remainingCents={remaining} />}
    </div>
  );
}
