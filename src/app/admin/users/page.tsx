import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { formatPrice } from "@/lib/money";
import {
  changeOwnPassword,
  createAdminUser,
  deleteAdminUser,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { ok?: boolean; text: string }> = {
  password: { ok: true, text: "Password updated." },
  created: { ok: true, text: "Admin user added." },
  deleted: { ok: true, text: "Admin user removed." },
  length: { text: "New password must be at least 8 characters." },
  current: { text: "Current password is incorrect." },
  invalid: { text: "Enter a valid email and an 8+ character password." },
  exists: { text: "An admin with that email already exists." },
  self: { text: "You can’t delete your own account." },
  last: { text: "Can’t delete the last remaining admin." },
};

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const session = await auth();
  const myEmail = session?.user?.email ?? "";

  const [admins, customers] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.order.groupBy({
      by: ["email"],
      where: { status: { not: "PENDING" }, email: { not: "" } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
  ]);

  const banner = MESSAGES[ok ?? ""] ?? MESSAGES[error ?? ""];

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Users 👤</h1>

      {banner && (
        <p
          className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold ${
            banner.ok ? "bg-teal/15 text-teal-dark" : "bg-brand/10 text-brand-dark"
          }`}
        >
          {banner.text}
        </p>
      )}

      {/* Change own password */}
      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Change my password</h2>
        <p className="text-sm font-semibold text-ink/60">
          Signed in as {myEmail}
        </p>
        <form action={changeOwnPassword} className="space-y-3">
          <input
            name="currentPassword"
            type="password"
            required
            placeholder="Current password"
            className="input"
          />
          <input
            name="newPassword"
            type="password"
            required
            placeholder="New password (min 8 chars)"
            className="input"
          />
          <button type="submit" className="btn-primary btn-sm">
            Update password
          </button>
        </form>
      </section>

      {/* Admin users */}
      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Admin users</h2>
        <ul className="divide-y divide-ink/10">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 break-all font-semibold">
                {a.email}
                {a.email === myEmail && (
                  <span className="ml-2 rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-xs">
                    you
                  </span>
                )}
              </span>
              {a.email !== myEmail && admins.length > 1 && (
                <form action={deleteAdminUser}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="font-bold text-ink/40 hover:text-brand"
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form action={createAdminUser} className="space-y-3 border-t-2 border-ink/10 pt-4">
          <p className="text-sm font-bold text-ink/70">Add an admin</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="email" type="email" required placeholder="Email" className="input" />
            <input name="name" placeholder="Name (optional)" className="input" />
          </div>
          <input
            name="password"
            type="password"
            required
            placeholder="Password (min 8 chars)"
            className="input"
          />
          <button type="submit" className="btn-teal btn-sm">
            Add admin
          </button>
        </form>
      </section>

      {/* Customers (read-only) */}
      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Customers</h2>
        {customers.length === 0 ? (
          <p className="text-sm font-semibold text-ink/60">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/50">
              <tr>
                <th className="py-1 font-bold">Email</th>
                <th className="py-1 font-bold">Orders</th>
                <th className="py-1 font-bold">Total spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {customers
                .sort((a, b) => (b._sum.totalCents ?? 0) - (a._sum.totalCents ?? 0))
                .map((c) => (
                  <tr key={c.email}>
                    <td className="py-1.5 font-semibold">{c.email}</td>
                    <td className="py-1.5">{c._count._all}</td>
                    <td className="py-1.5">{formatPrice(c._sum.totalCents ?? 0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
