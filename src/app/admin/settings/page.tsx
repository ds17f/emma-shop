import { getSettings } from "@/lib/settings";
import { updateSettings } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const s = await getSettings();
  const freeEnabled = s.freeShippingThresholdCents != null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings ⚙️</h1>
      {ok && (
        <p className="rounded-xl border-2 border-ink bg-secondary/15 px-3 py-2 text-sm font-bold text-secondary-hover">
          Settings saved!
        </p>
      )}

      <form action={updateSettings} className="space-y-6">
        <fieldset className="card space-y-4 p-5">
          <legend className="px-2 font-display text-lg font-bold">Store</legend>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/70">Shop name</span>
            <input name="shopName" defaultValue={s.shopName} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/70">Tagline</span>
            <input name="tagline" defaultValue={s.tagline} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/70">
              Contact email
            </span>
            <input
              name="contactEmail"
              type="email"
              defaultValue={s.contactEmail}
              placeholder="hello@example.com"
              className="input"
            />
          </label>
        </fieldset>

        <fieldset className="card space-y-4 p-5">
          <legend className="px-2 font-display text-lg font-bold">Shipping</legend>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/70">
              Flat shipping rate ($)
            </span>
            <input
              name="shippingFlat"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(s.shippingFlatCents / 100).toFixed(2)}
              className="input w-40"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              name="freeShippingEnabled"
              defaultChecked={freeEnabled}
            />
            Offer free shipping over a threshold
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/70">
              Free shipping when subtotal ≥ ($)
            </span>
            <input
              name="freeShippingThreshold"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                s.freeShippingThresholdCents != null
                  ? (s.freeShippingThresholdCents / 100).toFixed(2)
                  : "75.00"
              }
              className="input w-40"
            />
          </label>
        </fieldset>

        <button type="submit" className="btn-primary">
          Save settings
        </button>
      </form>
    </div>
  );
}
