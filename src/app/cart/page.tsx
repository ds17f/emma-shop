"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/money";

export default function CartPage() {
  const { items, subtotalCents, setQuantity, removeItem } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <p className="text-5xl">🧺</p>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <Link href="/products" className="btn-primary mt-6">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        Your <span className="text-brand">cart</span>
      </h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.variantId} className="card flex items-center gap-4 p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-cream">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/products/${item.productSlug}`}
                className="font-display font-semibold hover:underline"
              >
                {item.name}
              </Link>
              <p className="text-sm font-semibold text-ink/60">
                {formatPrice(item.priceCents)} each
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={item.maxStock}
              value={item.quantity}
              onChange={(e) =>
                setQuantity(item.variantId, Number(e.target.value) || 1)
              }
              className="input w-16"
            />
            <p className="w-20 text-right font-display font-bold">
              {formatPrice(item.priceCents * item.quantity)}
            </p>
            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white font-bold hover:bg-brand hover:text-white"
              aria-label="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="card flex flex-col items-end gap-3 p-5">
        <p className="text-lg font-semibold">
          Subtotal:{" "}
          <span className="font-display text-2xl font-bold text-brand">
            {formatPrice(subtotalCents)}
          </span>
        </p>
        <p className="text-sm font-semibold text-ink/60">
          Shipping &amp; tax calculated at checkout.
        </p>
        {error && (
          <p className="rounded-xl border-2 border-ink bg-brand/10 px-3 py-2 text-sm font-bold text-brand-dark">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={checkout}
          disabled={loading}
          className="btn-teal text-base"
        >
          {loading ? "Redirecting…" : "Checkout →"}
        </button>
      </div>
    </div>
  );
}
