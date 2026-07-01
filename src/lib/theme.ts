// Shared theme model for the admin "Appearance" controls.
//
// The storefront palette lives as Tailwind v4 CSS variables (`--color-*`) in
// globals.css. This module lets the shop owner override those variables at
// runtime: saved values are spread onto <html> in the root layout, which beats
// the :root defaults, so every `bg-brand`/`btn-primary`/`card` re-themes with no
// rebuild. Pure/isomorphic — safe to import from both server and client code.

export type TokenKey =
  | "cream"
  | "space"
  | "space2"
  | "ink"
  | "brand"
  | "teal"
  | "sun"
  | "star"
  | "grape"
  | "tangerine"
  | "sky";

export type ThemeColors = Partial<Record<TokenKey, string>>;

type TokenDef = {
  key: TokenKey;
  label: string;
  group: "Backgrounds" | "Text" | "Accents" | "Decorative";
  default: string;
};

// Editable tokens, in display order. The two hover shades (brand-dark,
// teal-dark) are intentionally NOT here — they're derived from brand/teal so the
// owner never has to keep hover states in sync (see cssVarsFor).
export const TOKENS: TokenDef[] = [
  { key: "cream", label: "Page background", group: "Backgrounds", default: "#faeede" },
  { key: "space", label: "Header & footer", group: "Backgrounds", default: "#061123" },
  { key: "space2", label: "Lifted navy", group: "Backgrounds", default: "#122c44" },
  { key: "ink", label: "Text & borders", group: "Text", default: "#08172b" },
  { key: "brand", label: "Primary buttons", group: "Accents", default: "#e26a57" },
  { key: "teal", label: "Teal accents", group: "Accents", default: "#469090" },
  { key: "sun", label: "Sun / gold", group: "Accents", default: "#f0b24a" },
  { key: "star", label: "Starlight sparkle", group: "Accents", default: "#f7d29f" },
  { key: "grape", label: "Cosmic purple", group: "Decorative", default: "#6d5a9c" },
  { key: "tangerine", label: "Comet orange", group: "Decorative", default: "#e79f5d" },
  { key: "sky", label: "Nebula blue", group: "Decorative", default: "#4ba0c6" },
];

export const TOKEN_KEYS = TOKENS.map((t) => t.key);

/** Full default palette (every editable token). */
export const DEFAULT_COLORS: Record<TokenKey, string> = TOKENS.reduce(
  (acc, t) => ({ ...acc, [t.key]: t.default }),
  {} as Record<TokenKey, string>,
);

// One-click starting points. Each is a full palette so results are predictable.
export const PRESETS: { name: string; colors: Record<TokenKey, string> }[] = [
  { name: "Cosmic", colors: { ...DEFAULT_COLORS } },
  {
    name: "Meadow",
    colors: {
      cream: "#f3f7ec", space: "#14361f", space2: "#1f4a2c", ink: "#10231a",
      brand: "#e07a3f", teal: "#3f8f6d", sun: "#e8c34a", star: "#cfe8b0",
      grape: "#7a6aa8", tangerine: "#d98a4a", sky: "#5bb0a0",
    },
  },
  {
    name: "Sunset",
    colors: {
      cream: "#fdefe4", space: "#2a0f24", space2: "#45183a", ink: "#2b0f1f",
      brand: "#e8556b", teal: "#c9713f", sun: "#f2a63c", star: "#ffd9a8",
      grape: "#9c5a8f", tangerine: "#f08a5d", sky: "#c96a8f",
    },
  },
  {
    name: "Winter",
    colors: {
      cream: "#eef4fa", space: "#0a1a30", space2: "#16304f", ink: "#0b1c33",
      brand: "#4f7bd0", teal: "#3f8fa8", sun: "#8fb8e0", star: "#cfe0f5",
      grape: "#6a72b0", tangerine: "#7fa8d8", sky: "#5aa0d0",
    },
  },
];

const HEX3 = /^#([0-9a-fA-F]{3})$/;
const HEX6 = /^#([0-9a-fA-F]{6})$/;

/** Validate + normalize to a lowercase 6-digit hex, or null if invalid. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (HEX6.test(v)) return v;
  const m = HEX3.exec(v);
  if (m) {
    const [r, g, b] = m[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/** Darken a hex color by `amount` (0..1) — used to derive hover shades. */
export function darken(hex: string, amount = 0.14): string {
  const h = normalizeHex(hex);
  if (!h) return hex;
  const n = parseInt(h.slice(1), 16);
  const scale = Math.max(0, Math.min(1, 1 - amount));
  const r = Math.round(((n >> 16) & 0xff) * scale);
  const g = Math.round(((n >> 8) & 0xff) * scale);
  const b = Math.round((n & 0xff) * scale);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Parse the stored themeJson into a validated subset of known tokens. */
export function parseTheme(json: string | null | undefined): ThemeColors {
  if (!json) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object") return {};
  const out: ThemeColors = {};
  for (const key of TOKEN_KEYS) {
    const hex = normalizeHex((raw as Record<string, unknown>)[key]);
    if (hex) out[key] = hex;
  }
  return out;
}

/**
 * CSS-variable overrides for a saved theme. Only sets variables the owner
 * actually changed (missing tokens fall back to the globals.css defaults), and
 * re-derives the brand/teal hover shades whenever their base is overridden.
 */
export function cssVarsFor(theme: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of TOKEN_KEYS) {
    const hex = theme[key];
    if (hex) vars[`--color-${key}`] = hex;
  }
  if (theme.brand) vars["--color-brand-dark"] = darken(theme.brand);
  if (theme.teal) vars["--color-teal-dark"] = darken(theme.teal);
  return vars;
}

/** Merge defaults with saved overrides so every control has a value to show. */
export function resolveColors(theme: ThemeColors): Record<TokenKey, string> {
  return { ...DEFAULT_COLORS, ...theme };
}
