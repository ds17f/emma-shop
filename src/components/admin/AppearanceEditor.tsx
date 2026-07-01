"use client";

import { useEffect, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import {
  TOKENS,
  TOKEN_KEYS,
  DEFAULT_COLORS,
  PRESETS,
  cssVarsFor,
  normalizeHex,
  contrastWarnings,
  type TokenKey,
} from "@/lib/theme";
import { SHOP_LOGO } from "@/lib/brand";

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

type Colors = Record<TokenKey, string>;
const GROUPS = ["Backgrounds", "Text", "Buttons", "Decorative"] as const;

export function AppearanceEditor({
  initialColors,
  initialLogo,
  action,
}: {
  initialColors: Colors;
  initialLogo: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  // `colors` holds raw text so the hex field can be typed freely; anything that
  // consumes a color reads the validated `safe` version.
  const [colors, setColors] = useState<Colors>(initialColors);
  const [logo, setLogo] = useState(initialLogo);
  const [openKey, setOpenKey] = useState<TokenKey | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEyeDropper, setHasEyeDropper] = useState(false);

  useEffect(() => {
    // Detect after mount so SSR and first client render agree (no window on the
    // server); intentional setState in effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasEyeDropper(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  const safe = useMemo<Colors>(() => {
    const out = {} as Colors;
    for (const key of TOKEN_KEYS) out[key] = normalizeHex(colors[key]) ?? DEFAULT_COLORS[key];
    return out;
  }, [colors]);

  const previewVars = useMemo(() => cssVarsFor(safe), [safe]);
  const logoSrc = logo || SHOP_LOGO;

  // Debounce the readability check: recompute only after dragging pauses, so the
  // warning card doesn't flicker on/off (and reflow the page) while a color is
  // being dragged across the contrast threshold. The color preview stays live.
  const [warnColors, setWarnColors] = useState(safe);
  useEffect(() => {
    const t = setTimeout(() => setWarnColors(safe), 200);
    return () => clearTimeout(t);
  }, [safe]);
  const warnings = useMemo(() => contrastWarnings(warnColors), [warnColors]);

  const activePreset = useMemo(
    () => PRESETS.find((p) => TOKEN_KEYS.every((k) => safe[k] === p.colors[k]))?.name ?? null,
    [safe],
  );
  // The last-saved palette (initialColors) counts as "My look" when it isn't
  // just one of the stock presets — that's her own custom she can return to.
  const savedIsCustom = useMemo(
    () => !PRESETS.some((p) => TOKEN_KEYS.every((k) => initialColors[k] === p.colors[k])),
    [initialColors],
  );
  const onSaved = useMemo(
    () => TOKEN_KEYS.every((k) => safe[k] === initialColors[k]),
    [safe, initialColors],
  );
  const dirty = useMemo(
    () => logo !== initialLogo || TOKEN_KEYS.some((k) => safe[k] !== initialColors[k]),
    [safe, logo, initialColors, initialLogo],
  );

  // Preview the draft palette across the WHOLE page (header, footer, buttons) by
  // writing the CSS variables onto <html> live. On unmount (leaving without
  // saving) restore whatever the server rendered, so nothing sticks.
  useEffect(() => {
    const root = document.documentElement;
    const keys = [
      ...TOKEN_KEYS.map((k) => `--color-${k}`),
      "--color-primary-hover",
      "--color-secondary-hover",
      "--on-primary",
      "--on-secondary",
      "--on-highlight",
    ];
    const original: Record<string, string> = {};
    for (const k of keys) original[k] = root.style.getPropertyValue(k);
    return () => {
      for (const k of keys) {
        if (original[k]) root.style.setProperty(k, original[k]);
        else root.style.removeProperty(k);
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(previewVars)) root.style.setProperty(k, v);
  }, [previewVars]);

  function setColor(key: TokenKey, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }
  function applyPreset(preset: Colors) {
    setColors({ ...preset });
    setOpenKey(null);
  }

  async function pickWithEyeDropper(key: TokenKey) {
    if (!window.EyeDropper) return;
    try {
      const res = await new window.EyeDropper().open();
      setColor(key, res.sRGBHex);
    } catch {
      /* user cancelled */
    }
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
      {TOKEN_KEYS.map((key) => (
        <input key={key} type="hidden" name={`color_${key}`} value={safe[key]} />
      ))}
      <input type="hidden" name="logoUrl" value={logo} />

      <div className="space-y-6">
        {/* Presets */}
        <fieldset className="card space-y-3 p-5">
          <legend className="px-2 font-display text-lg font-bold">Presets</legend>
          <p className="text-sm text-stone-500">
            {activePreset
              ? `Current look: ${activePreset}`
              : savedIsCustom && onSaved
                ? "Current look: My look (your saved custom)"
                : "Custom look — pick a preset to start over, or Save to keep it."}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ...PRESETS.map((p) => ({ name: p.name, colors: p.colors, selected: activePreset === p.name })),
              ...(savedIsCustom
                ? [{ name: "My look", colors: initialColors, selected: !activePreset && onSaved }]
                : []),
            ].map((chip) => (
              <button
                key={chip.name}
                type="button"
                onClick={() => applyPreset(chip.colors)}
                aria-pressed={chip.selected}
                className={`chip flex items-center gap-2 ${
                  chip.selected
                    ? "bg-ink text-white ring-2 ring-ink ring-offset-2 ring-offset-page"
                    : "bg-white"
                }`}
              >
                <span className="flex">
                  {(["header", "primary", "secondary", "highlight"] as TokenKey[]).map((k) => (
                    <span
                      key={k}
                      className="h-4 w-4 rounded-full border border-ink/30"
                      style={{ backgroundColor: chip.colors[k], marginLeft: k === "header" ? 0 : -6 }}
                    />
                  ))}
                </span>
                {chip.name}
                {chip.selected && <span aria-hidden>✓</span>}
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
                <input type="file" accept="image/*" onChange={handleLogo} className="hidden" disabled={uploading} />
              </label>
              {logo && (
                <button type="button" onClick={() => setLogo("")} className="btn-white btn-sm">
                  Reset to default
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm font-bold text-primary">{error}</p>}
        </fieldset>

        {/* Readability warnings */}
        {warnings.length > 0 && (
          <div className="rounded-2xl border-2 border-ink bg-highlight/20 p-4 text-sm">
            <p className="font-bold">⚠️ Hard to read</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {warnings.map((w) => (
                <li key={w.label}>
                  {w.label} — contrast {w.ratio.toFixed(1)}:1 (aim for 4.5:1+)
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Colors, grouped, each with a rich picker */}
        {GROUPS.map((group) => {
          const tokens = TOKENS.filter((t) => t.group === group);
          return (
            <fieldset key={group} className="card space-y-2 p-5">
              <legend className="px-2 font-display text-lg font-bold">{group}</legend>
              {tokens.map((t) => {
                const open = openKey === t.key;
                return (
                  <div key={t.key} className="rounded-xl px-1 py-1.5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : t.key)}
                        aria-label={`Edit ${t.label}`}
                        aria-expanded={open}
                        className="h-9 w-9 shrink-0 rounded-lg border-2 border-ink"
                        style={{ backgroundColor: safe[t.key] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink/80">{t.label}</span>
                        <span className="block text-xs text-stone-400">{t.hint}</span>
                      </span>
                      <input
                        type="text"
                        value={colors[t.key]}
                        onChange={(e) => setColor(t.key, e.target.value)}
                        onFocus={() => setOpenKey(t.key)}
                        spellCheck={false}
                        className="w-24 rounded-lg border-2 border-ink/20 bg-white px-2 py-1 font-mono text-xs focus:border-ink focus:outline-none"
                      />
                    </div>
                    {open && (
                      <div className="mt-3 flex flex-col items-start gap-3 pl-12 sm:flex-row sm:items-center">
                        <HexColorPicker
                          color={safe[t.key]}
                          onChange={(hex) => setColor(t.key, hex)}
                        />
                        <div className="flex gap-2">
                          {hasEyeDropper && (
                            <button
                              type="button"
                              onClick={() => pickWithEyeDropper(t.key)}
                              className="btn-white btn-sm"
                            >
                              💧 Pick
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setColor(t.key, DEFAULT_COLORS[t.key])}
                            className="btn-white btn-sm"
                          >
                            Reset
                          </button>
                          <button type="button" onClick={() => setOpenKey(null)} className="btn-white btn-sm">
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
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
            Reset to default
          </button>
          {dirty && (
            <span className="text-sm font-bold text-ink/50">● Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Live storefront sample (the whole page also previews live). */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Live preview
        </p>
        <div
          style={previewVars}
          className="overflow-hidden rounded-3xl border-2 border-ink shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          <div className="stars flex items-center gap-2 border-b-2 border-ink bg-header px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              className="h-8 w-8 rounded-full border-2 border-ink bg-white object-cover"
            />
            <span className="font-display text-lg font-bold text-white">
              Comet <span className="text-primary">Tail</span>
              <span className="text-secondary"> ☄️</span>
            </span>
          </div>
          <div className="space-y-3 bg-page p-4">
            <div className="card space-y-2 p-3">
              <p className="font-display font-bold text-ink">Handmade Blanket</p>
              <p className="text-sm text-ink/70">Cozy, cosmic, one-of-a-kind.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="btn-primary btn-sm">Add to cart</span>
                <span className="btn-secondary btn-sm">Details</span>
                <span className="btn-highlight btn-sm">Sale</span>
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
