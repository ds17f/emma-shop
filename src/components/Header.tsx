"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { SHOP_LOGO } from "@/lib/brand";

export function Header({
  shopName,
  logoUrl,
}: {
  shopName: string;
  logoUrl?: string | null;
}) {
  const { count } = useCart();
  const [logoOk, setLogoOk] = useState(true);
  const logoSrc = logoUrl || SHOP_LOGO;

  // Color the last word of the shop name as a playful accent.
  const words = shopName.trim().split(" ");
  const lastWord = words.length > 1 ? words.pop() : "";
  const leadWords = words.join(" ");

  return (
    <header className="stars sticky top-0 z-20 border-b-2 border-ink bg-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          {logoOk && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              onError={() => setLogoOk(false)}
              className="h-10 w-10 rounded-full border-2 border-ink bg-white object-cover"
            />
          )}
          <span className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
            {leadWords}{" "}
            {lastWord && <span className="text-primary">{lastWord}</span>}
            <span className="text-secondary"> ☄️</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold">
          <Link
            href="/products"
            className="rounded-full px-3 py-1.5 text-white hover:bg-white/15"
          >
            Shop
          </Link>
          <Link href="/cart" className="btn-white btn-sm relative">
            Cart 🛒
            {count > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-primary px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
