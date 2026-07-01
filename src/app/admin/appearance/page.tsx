import { getSettings } from "@/lib/settings";
import { updateAppearance } from "@/app/admin/actions";
import { parseTheme, resolveColors } from "@/lib/theme";
import { AppearanceEditor } from "@/components/admin/AppearanceEditor";

export const dynamic = "force-dynamic";

export default async function AdminAppearance({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const s = await getSettings();
  const colors = resolveColors(parseTheme(s.themeJson));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appearance 🎨</h1>
        <p className="mt-1 text-sm text-stone-500">
          Change the shop’s colors and logo. Preview updates as you go — nothing
          goes live until you press Save.
        </p>
      </div>
      {ok && (
        <p className="rounded-xl border-2 border-ink bg-secondary/15 px-3 py-2 text-sm font-bold text-secondary-hover">
          Appearance saved!
        </p>
      )}
      <AppearanceEditor
        initialColors={colors}
        initialLogo={s.logoUrl ?? ""}
        action={updateAppearance}
      />
    </div>
  );
}
