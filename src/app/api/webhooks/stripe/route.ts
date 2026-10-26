import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { sendOrderEmails } from "@/lib/email";
import { getSettings } from "@/lib/settings";

// Stripe needs the raw request body to verify the signature.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let stripe;
  try {
    stripe = requireStripe();
  } catch {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${err instanceof Error ? err.message : ""}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId) {
      await fulfillOrder(orderId, session);
    }
  }

  return NextResponse.json({ received: true });
}

async function fulfillOrder(orderId: string, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  // Idempotency: only fulfill a still-pending order once.
  if (!order || order.status !== "PENDING" || order.stripeSessionId !== session.id) return;

  const shipping =
    session.collected_information?.shipping_details ??
    session.customer_details;

  const email = session.customer_details?.email ?? "";
  const customerName = session.customer_details?.name ?? "";
  const shippingAddress = JSON.stringify(shipping ?? {});
  const totalCents = session.amount_total ?? order.totalCents;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const fulfilled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING", stripeSessionId: session.id },
      data: {
        status: "PAID",
        email,
        customerName,
        shippingAddress,
        totalCents,
        stripePaymentIntentId: paymentIntentId,
      },
    });
    if (claimed.count !== 1) return false;
    for (const item of order.items) {
      if (!item.variantId) continue;
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }
    return true;
  });
  if (!fulfilled) return;

  // Fire confirmation emails after the order is committed PAID. sendOrderEmails
  // never throws, so a mail outage can't fail the webhook or trigger a Stripe
  // retry (which would no-op here anyway, since the order is no longer PENDING).
  const settings = await getSettings();
  await sendOrderEmails(
    { id: order.id, email, customerName, totalCents, shippingAddress, items: order.items },
    settings,
  );
}
