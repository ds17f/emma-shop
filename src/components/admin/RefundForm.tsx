"use client";

import { useState } from "react";
import { refundOrder } from "@/app/admin/actions";
import { formatPrice } from "@/lib/money";

/**
 * Refund control for the order detail page. Defaults to a full refund of the
 * remaining amount; the admin can enter a smaller amount for a partial refund.
 * Confirms (with the resolved dollar amount) before hitting Stripe.
 */
export function RefundForm({
  orderId,
  remainingCents,
}: {
  orderId: string;
  remainingCents: number;
}) {
  const [amount, setAmount] = useState("");

  const dollars = amount.trim()
    ? Math.round(parseFloat(amount) * 100)
    : remainingCents;
  const valid = Number.isFinite(dollars) && dollars > 0 && dollars <= remainingCents;

  return (
    <form action={refundOrder} className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
      <input type="hidden" name="id" value={orderId} />
      <p className="text-sm font-semibold text-red-800">Refund</p>
      <p className="text-xs text-stone-500">
        Up to {formatPrice(remainingCents)} refundable. Leave the amount blank for a
        full refund.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">Amount ($)</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            max={(remainingCents / 100).toFixed(2)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={(remainingCents / 100).toFixed(2)}
            className="input w-32"
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="restock" defaultChecked />
          Return items to stock
        </label>
        <button
          type="submit"
          disabled={!valid}
          onClick={(e) => {
            const msg = `Refund ${formatPrice(dollars)} to the customer via Stripe? This cannot be undone.`;
            if (!window.confirm(msg)) e.preventDefault();
          }}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          Refund {valid ? formatPrice(dollars) : ""}
        </button>
      </div>
    </form>
  );
}
