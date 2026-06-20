import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Not signed in (e.g. the login page) — render bare.
  if (!session?.user) return <>{children}</>;

  return (
    <div className="grid gap-8 md:grid-cols-[180px_1fr]">
      <aside className="space-y-1">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Admin
        </p>
        {[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/products", label: "Products" },
          { href: "/admin/categories", label: "Categories" },
          { href: "/admin/orders", label: "Orders" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/settings", label: "Settings" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            {l.label}
          </Link>
        ))}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
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
      <div>{children}</div>
    </div>
  );
}
