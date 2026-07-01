"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/money";

export type VariantOption = {
  id: string;
  label: string;
  priceCents: number;
  stock: number;
};

type Props = {
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  variants: VariantOption[];
};

export function AddToCart({ productName, productSlug, imageUrl, variants }: Props) {
  const { addItem } = useCart();
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId) ?? firstAvailable;
  if (!selected) return <p className="font-bold text-ink/60">Unavailable.</p>;

  const soldOut = selected.stock <= 0;

  function handleAdd() {
    if (!selected || soldOut) return;
    addItem(
      {
        variantId: selected.id,
        productSlug,
        name:
          variants.length > 1
            ? `${productName} — ${selected.label}`
            : productName,
        priceCents: selected.priceCents,
        imageUrl,
        maxStock: selected.stock,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="space-y-4">
      <p className="font-display text-3xl font-bold text-primary">
        {formatPrice(selected.priceCents)}
      </p>

      {variants.length > 1 && (
        <div>
          <label className="mb-1 block text-sm font-bold text-ink/70">Option</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = v.stock <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  onClick={() => {
                    setSelectedId(v.id);
                    setQty(1);
                  }}
                  className={`chip ${
                    v.id === selectedId
                      ? "bg-accent1 text-white"
                      : "bg-white text-ink"
                  } ${out ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {soldOut ? (
        <p className="inline-block rounded-full border-2 border-ink bg-white px-4 py-2 font-bold">
          Sold out 😢
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-ink/70">Qty</label>
            <input
              type="number"
              min={1}
              max={selected.stock}
              value={qty}
              onChange={(e) =>
                setQty(
                  Math.max(
                    1,
                    Math.min(selected.stock, Number(e.target.value) || 1),
                  ),
                )
              }
              className="input w-20"
            />
            <span className="text-sm font-semibold text-ink/60">
              {selected.stock} in stock
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleAdd} className="btn-primary text-base">
              Add to cart 🛒
            </button>
            {added && (
              <Link href="/cart" className="font-bold text-secondary underline">
                Added! View cart →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
