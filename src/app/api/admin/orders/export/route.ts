import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

const STATUS_FILTERS = ["ALL", "PAID", "SHIPPED", "FULFILLED", "CANCELLED"];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "ALL";
  const q = url.searchParams.get("q") ?? "";
  const activeStatus = STATUS_FILTERS.includes(status) ? status : "ALL";

  const where: Prisma.OrderWhereInput = {
    status: activeStatus === "ALL" ? { not: "PENDING" } : activeStatus,
    ...(q ? { email: { contains: q } } : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const header = ["Date", "Order ID", "Email", "Customer", "Items", "Total", "Status"];
  const rows = orders.map((o) => [
    o.createdAt.toISOString(),
    o.id,
    o.email,
    o.customerName,
    o._count.items,
    (o.totalCents / 100).toFixed(2),
    o.status,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${date}.csv"`,
    },
  });
}
