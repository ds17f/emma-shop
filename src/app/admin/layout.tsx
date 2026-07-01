import Link from "next/link";
import { auth, signOut } from "@/auth";
import { AdminNav } from "@/components/admin/AdminNav";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/appearance", label: "Appearance" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Not signed in (e.g. the login page) — render bare.
  if (!session?.user) return <>{children}</>;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div>
      {/* Mobile: hamburger + slide-in drawer (hidden on md+). */}
      <AdminNav links={LINKS} signOutAction={signOutAction} />

      <div className="md:grid md:grid-cols-[190px_1fr] md:gap-8">
        {/* Desktop sidebar (hidden on mobile). */}
        <aside className="hidden space-y-1 md:block">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Admin
          </p>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              {l.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-4 block w-full rounded px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-100"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/"
            className="block rounded px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            View shop →
          </Link>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
