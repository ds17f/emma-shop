"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function OrderSuccessPage() {
  const { clear } = useCart();

  // Payment succeeded — empty the cart.
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-teal text-4xl text-white">
        ✓
      </div>
      <h1 className="mt-6 text-3xl font-bold">Thank you! 🎉</h1>
      <p className="mt-3 font-semibold text-ink/70">
        Your payment was successful. A receipt is on its way to your email, and
        we’ll get your handmade goods packed up and shipped soon.
      </p>
      <Link href="/products" className="btn-primary mt-6">
        Continue shopping
      </Link>
    </div>
  );
}
