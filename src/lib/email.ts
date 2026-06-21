import { Resend } from "resend";
import { formatPrice } from "@/lib/money";

const apiKey = process.env.RESEND_API_KEY;

// Lazy: the app builds/runs without email configured (emails simply no-op).
const resend = apiKey ? new Resend(apiKey) : null;

// Verified sender. Until a domain is verified in Resend, only `onboarding@resend.dev`
// works and it can only deliver to the Resend account owner's own address.
const FROM = process.env.EMAIL_FROM || "Comet Tail Crafts <onboarding@resend.dev>";

type OrderForEmail = {
  id: string;
  email: string;
  customerName: string;
  totalCents: number;
  shippingAddress: string; // JSON snapshot from Stripe
  items: { nameSnapshot: string; priceCents: number; quantity: number }[];
};

type EmailSettings = { shopName: string; contactEmail: string };

function renderAddress(raw: string): string {
  try {
    const s = JSON.parse(raw || "{}");
    const a = s.address ?? {};
    const lines = [
      s.name,
      a.line1,
      a.line2,
      [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean);
    return lines.join("<br>");
  } catch {
    return "";
  }
}

function itemsTable(order: OrderForEmail): string {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0">${i.nameSnapshot} × ${i.quantity}</td>` +
        `<td style="padding:4px 0;text-align:right">${formatPrice(i.priceCents * i.quantity)}</td></tr>`,
    )
    .join("");
  return (
    `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}` +
    `<tr><td style="padding-top:8px;border-top:1px solid #ddd;font-weight:700">Total</td>` +
    `<td style="padding-top:8px;border-top:1px solid #ddd;text-align:right;font-weight:700">${formatPrice(order.totalCents)}</td></tr>` +
    `</table>`
  );
}

/**
 * Send the customer confirmation + owner notification for a paid order.
 * Never throws — email failures are logged and swallowed so they can't break
 * (or cause Stripe to retry) order fulfillment.
 */
export async function sendOrderEmails(
  order: OrderForEmail,
  settings: EmailSettings,
): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping order emails.");
    return;
  }

  const shop = settings.shopName || "Comet Tail Crafts";
  const addr = renderAddress(order.shippingAddress);
  const items = itemsTable(order);
  const shortId = order.id.slice(-8).toUpperCase();

  // Customer confirmation
  if (order.email) {
    try {
      await resend.emails.send({
        from: FROM,
        to: order.email,
        subject: `Your ${shop} order is confirmed 🎉`,
        html:
          `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#08172b">` +
          `<h1 style="font-size:22px">Thank you${order.customerName ? `, ${order.customerName}` : ""}! 🎉</h1>` +
          `<p>We received your order <strong>#${shortId}</strong> and we’re packing it up. ` +
          `You’ll get a note when it ships.</p>` +
          `<h3 style="margin-top:24px">Your order</h3>${items}` +
          (addr ? `<h3 style="margin-top:24px">Shipping to</h3><p style="font-size:14px">${addr}</p>` : "") +
          `<p style="margin-top:24px;color:#666;font-size:13px">— ${shop}</p>` +
          `</div>`,
      });
    } catch (err) {
      console.error("[email] customer confirmation failed:", err);
    }
  }

  // Owner notification
  const owner = settings.contactEmail || process.env.ADMIN_EMAIL || "";
  if (owner) {
    try {
      await resend.emails.send({
        from: FROM,
        to: owner,
        subject: `New order #${shortId} — ${formatPrice(order.totalCents)}`,
        html:
          `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#08172b">` +
          `<h2>New order #${shortId}</h2>` +
          `<p><strong>Customer:</strong> ${order.customerName || "—"} &lt;${order.email || "—"}&gt;</p>` +
          items +
          (addr ? `<h3 style="margin-top:24px">Ship to</h3><p style="font-size:14px">${addr}</p>` : "") +
          `</div>`,
      });
    } catch (err) {
      console.error("[email] owner notification failed:", err);
    }
  }
}
