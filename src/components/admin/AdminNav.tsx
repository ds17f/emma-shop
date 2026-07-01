"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

export function AdminNav({
  links,
  signOutAction,
}: {
  links: NavLink[];
  signOutAction: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      {/* Mobile top bar */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-ink bg-white px-3 py-2">
        <span className="font-display font-bold">Admin</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="btn-white btn-sm"
        >
          ☰ Menu
        </button>
      </div>

      {/* Slide-in drawer */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 flex h-full w-64 max-w-[82%] flex-col gap-1 overflow-y-auto border-r-2 border-ink bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2">
              <span className="font-display text-lg font-bold">Admin</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="btn-white btn-sm"
              >
                ✕
              </button>
            </div>
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded px-3 py-2 text-sm ${
                    active ? "bg-ink font-bold text-white" : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <form action={signOutAction}>
              <button
                type="submit"
                className="mt-3 block w-full rounded px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-100"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
            >
              View shop →
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
