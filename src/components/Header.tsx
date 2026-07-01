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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {logoOk && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              onError={() => setLogoOk(false)}
              className="h-9 w-9 shrink-0 rounded-full border-2 border-ink bg-white object-cover sm:h-10 sm:w-10"
            />
          )}
          <span className="truncate font-display text-lg font-bold tracking-tight text-white sm:text-2xl">
            {leadWords}{" "}
            {lastWord && <span className="text-primary">{lastWord}</span>}
            <span className="hidden text-secondary sm:inline"> ☄️</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 text-sm font-bold">
          <Link
            href="/products"
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-white hover:bg-white/15"
          >
            Shop
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="btn-white btn-sm relative whitespace-nowrap"
          >
            <span className="hidden sm:inline">Cart </span>🛒
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
