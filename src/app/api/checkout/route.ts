import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { getSettings } from "@/lib/settings";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  let stripe;
  try {
    stripe = requireStripe();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe not configured" },
      { status: 500 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }

  // Load variants from the DB — never trust client-supplied prices.
  const variantIds = parsed.data.items.map((i) => i.variantId);
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { include: { images: { orderBy: { position: "asc" } } } } },
  });

  const lineItems: {
    quantity: number;
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string; images?: string[] };
    };
  }[] = [];
  const orderItems: {
    nameSnapshot: string;
    priceCents: number;
    quantity: number;
    variantId: string;
  }[] = [];
  let totalCents = 0;

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  for (const item of parsed.data.items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.product.active) {
      return NextResponse.json(
        { error: "An item is no longer available." },
        { status: 409 },
      );
    }
    if (variant.stock < item.quantity) {
      return NextResponse.json(
        {
          error: `Only ${variant.stock} left of ${variant.product.name}.`,
        },
        { status: 409 },
      );
    }
    const name =
      variant.label && variant.label !== "Default" && variant.label !== "One size"
        ? `${variant.product.name} — ${variant.label}`
        : variant.product.name;
    const image = variant.product.images[0];
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: variant.priceCents,
        product_data: {
          name,
          ...(image ? { images: [`${origin}${image.url}`] } : {}),
        },
      },
    });
    orderItems.push({
      nameSnapshot: name,
      priceCents: variant.priceCents,
      quantity: item.quantity,
      variantId: variant.id,
    });
    totalCents += variant.priceCents * item.quantity;
  }

  // Create a PENDING order so the webhook can reconcile payment → inventory.
  const order = await prisma.order.create({
    data: {
      status: "PENDING",
      email: "",
      totalCents,
      items: { create: orderItems },
    },
  });

  // Shipping from store settings: free over the threshold, otherwise the flat rate.
  const settings = await getSettings();
  const qualifiesFree =
    settings.freeShippingThresholdCents != null &&
    totalCents >= settings.freeShippingThresholdCents;
  const shippingCents = qualifiesFree ? 0 : settings.shippingFlatCents;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
    shipping_address_collection: { allowed_countries: ["US", "CA"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: qualifiesFree ? "Free shipping" : "Standard shipping",
          fixed_amount: { amount: shippingCents, currency: "usd" },
        },
      },
    ],
    client_reference_id: order.id,
    metadata: { orderId: order.id },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
