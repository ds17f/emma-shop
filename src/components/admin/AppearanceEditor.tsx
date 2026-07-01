"use client";

import { useMemo, useState } from "react";
import {
  TOKENS,
  TOKEN_KEYS,
  DEFAULT_COLORS,
  PRESETS,
  cssVarsFor,
  normalizeHex,
  type TokenKey,
} from "@/lib/theme";
import { SHOP_LOGO } from "@/lib/brand";

type Colors = Record<TokenKey, string>;

const GROUPS = ["Backgrounds", "Text", "Accents", "Decorative"] as const;

export function AppearanceEditor({
  initialColors,
  initialLogo,
  action,
}: {
  initialColors: Colors;
  initialLogo: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  // `colors` holds raw text so the hex field can be typed freely; everything
  // that consumes a color reads the validated `safe` version.
  const [colors, setColors] = useState<Colors>(initialColors);
  const [logo, setLogo] = useState(initialLogo);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safe = useMemo<Colors>(() => {
    const out = {} as Colors;
    for (const key of TOKEN_KEYS) out[key] = normalizeHex(colors[key]) ?? DEFAULT_COLORS[key];
    return out;
  }, [colors]);

  const previewVars = useMemo(() => cssVarsFor(safe), [safe]);
  const logoSrc = logo || SHOP_LOGO;

  function setColor(key: TokenKey, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }
  function applyPreset(preset: Colors) {
    setColors({ ...preset });
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setLogo(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,340px)]">
      {/* Controls carry state into the server action via hidden inputs. */}
      {TOKEN_KEYS.map((key) => (
        <input key={key} type="hidden" name={`color_${key}`} value={safe[key]} />
      ))}
      <input type="hidden" name="logoUrl" value={logo} />

      <div className="space-y-6">
        {/* Presets */}
        <fieldset className="card space-y-3 p-5">
          <legend className="px-2 font-display text-lg font-bold">Presets</legend>
          <p className="text-sm text-stone-500">
            A starting point — pick one, then fine-tune below.
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.colors)}
                className="chip flex items-center gap-2 bg-white"
              >
                <span className="flex">
                  {(["space", "brand", "teal", "sun"] as TokenKey[]).map((k) => (
                    <span
                      key={k}
                      className="h-4 w-4 rounded-full border border-ink/30"
                      style={{ backgroundColor: p.colors[k], marginLeft: k === "space" ? 0 : -6 }}
                    />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Logo */}
        <fieldset className="card space-y-3 p-5">
          <legend className="px-2 font-display text-lg font-bold">Logo</legend>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Logo preview"
              className="h-14 w-14 rounded-full border-2 border-ink bg-white object-cover"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-white btn-sm cursor-pointer">
                {uploading ? "Uploading…" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogo}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo("")}
                  className="btn-white btn-sm"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm font-bold text-brand">{error}</p>}
        </fieldset>

        {/* Colors, grouped */}
        {GROUPS.map((group) => {
          const tokens = TOKENS.filter((t) => t.group === group);
          return (
            <fieldset key={group} className="card space-y-3 p-5">
              <legend className="px-2 font-display text-lg font-bold">{group}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {tokens.map((t) => (
                  <label key={t.key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={safe[t.key]}
                      onChange={(e) => setColor(t.key, e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border-2 border-ink bg-white"
                      aria-label={t.label}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink/70">{t.label}</span>
                      <input
                        type="text"
                        value={colors[t.key]}
                        onChange={(e) => setColor(t.key, e.target.value)}
                        spellCheck={false}
                        className="mt-0.5 w-28 rounded-lg border-2 border-ink/20 bg-white px-2 py-1 font-mono text-xs focus:border-ink focus:outline-none"
                      />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Save appearance
          </button>
          <button
            type="button"
            onClick={() => {
              applyPreset(DEFAULT_COLORS);
              setLogo("");
            }}
            className="btn-white"
          >
            Reset all
          </button>
        </div>
      </div>

      {/* Live preview — CSS vars are scoped to this panel so it re-themes as you
          edit without touching the admin chrome. */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Live preview
        </p>
        <div
          style={previewVars}
          className="overflow-hidden rounded-3xl border-2 border-ink shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          <div className="stars flex items-center gap-2 border-b-2 border-ink bg-space px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              className="h-8 w-8 rounded-full border-2 border-ink bg-white object-cover"
            />
            <span className="font-display text-lg font-bold text-white">
              Comet <span className="text-brand">Tail</span>
              <span className="text-teal"> ☄️</span>
            </span>
          </div>
          <div className="space-y-3 bg-cream p-4">
            <div className="card space-y-2 p-3">
              <p className="font-display font-bold text-ink">Handmade Blanket</p>
              <p className="text-sm text-ink/70">Cozy, cosmic, one-of-a-kind.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="btn-primary btn-sm">Add to cart</span>
                <span className="btn-teal btn-sm">Details</span>
                <span className="btn-sun btn-sm">Sale</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="chip bg-white text-ink">Blankets</span>
              <span className="chip bg-white text-ink">Crochet</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
