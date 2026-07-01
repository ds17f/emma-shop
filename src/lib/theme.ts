// Shared theme model for the admin "Appearance" controls.
//
// The storefront palette lives as Tailwind v4 CSS variables (`--color-*`) in
// globals.css. This module lets the shop owner override those variables at
// runtime: saved values are spread onto <html> in the root layout, which beats
// the :root defaults, so every `bg-primary`/`btn-primary`/`card` re-themes with
// no rebuild. Tokens are named by ROLE (primary/secondary/…), never by hue, so
// labels stay honest no matter what color is chosen. Pure/isomorphic — safe to
// import from both server and client code.

export type TokenKey =
  | "page"
  | "header"
  | "ink"
  | "primary"
  | "secondary"
  | "highlight"
  | "sparkle"
  | "accent1"
  | "accent2"
  | "accent3";

export type ThemeColors = Partial<Record<TokenKey, string>>;

type TokenDef = {
  key: TokenKey;
  label: string;
  hint: string;
  group: "Backgrounds" | "Text" | "Buttons" | "Decorative";
  default: string;
};

// Editable tokens, in display order. The button hover shades and readable text
// colors are derived automatically (see cssVarsFor) — the owner never sets them.
export const TOKENS: TokenDef[] = [
  { key: "page", label: "Page background", hint: "Behind everything", group: "Backgrounds", default: "#faeede" },
  { key: "header", label: "Header & footer", hint: "The dark bars", group: "Backgrounds", default: "#061123" },
  { key: "ink", label: "Text & borders", hint: "Body text and outlines", group: "Text", default: "#08172b" },
  { key: "primary", label: "Primary buttons", hint: "Main call-to-action", group: "Buttons", default: "#e26a57" },
  { key: "secondary", label: "Secondary buttons", hint: "Alternate actions", group: "Buttons", default: "#469090" },
  { key: "highlight", label: "Highlight / sale", hint: "Sale tags & emphasis", group: "Buttons", default: "#f0b24a" },
  { key: "sparkle", label: "Sparkle", hint: "Starfield twinkles", group: "Decorative", default: "#f7d29f" },
  { key: "accent1", label: "Accent 1", hint: "Decorative flourishes", group: "Decorative", default: "#6d5a9c" },
  { key: "accent2", label: "Accent 2", hint: "Decorative flourishes", group: "Decorative", default: "#e79f5d" },
  { key: "accent3", label: "Accent 3", hint: "Decorative flourishes", group: "Decorative", default: "#4ba0c6" },
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
      page: "#f3f7ec", header: "#14361f", ink: "#10231a", primary: "#e07a3f",
      secondary: "#3f8f6d", highlight: "#e8c34a", sparkle: "#cfe8b0",
      accent1: "#7a6aa8", accent2: "#d98a4a", accent3: "#5bb0a0",
    },
  },
  {
    name: "Sunset",
    colors: {
      page: "#fdefe4", header: "#2a0f24", ink: "#2b0f1f", primary: "#e8556b",
      secondary: "#c9713f", highlight: "#f2a63c", sparkle: "#ffd9a8",
      accent1: "#9c5a8f", accent2: "#f08a5d", accent3: "#c96a8f",
    },
  },
  {
    name: "Winter",
    colors: {
      page: "#eef4fa", header: "#0a1a30", ink: "#0b1c33", primary: "#4f7bd0",
      secondary: "#3f8fa8", highlight: "#8fb8e0", sparkle: "#cfe0f5",
      accent1: "#6a72b0", accent2: "#7fa8d8", accent3: "#5aa0d0",
    },
  },
];

const HEX3 = /^#([0-9a-fA-F]{3})$/;
const HEX6 = /^#([0-9a-fA-F]{6})$/;

const DARK = "#08172b"; // readable dark text
const LIGHT = "#ffffff"; // readable light text

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

function toRgb(hex: string): [number, number, number] {
  const n = parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Darken a hex color by `amount` (0..1) — used to derive hover shades. */
export function darken(hex: string, amount = 0.14): string {
  const [r, g, b] = toRgb(hex);
  const s = Math.max(0, Math.min(1, 1 - amount));
  const to = (c: number) => Math.round(c * s);
  return `#${((1 << 24) | (to(r) << 16) | (to(g) << 8) | to(b)).toString(16).slice(1)}`;
}

/** WCAG relative luminance (0..1). */
export function luminance(hex: string): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick dark or light text — whichever is more readable on `bg`. */
export function contrastText(bg: string): string {
  return contrastRatio(bg, DARK) >= contrastRatio(bg, LIGHT) ? DARK : LIGHT;
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
 * CSS-variable overrides for a saved theme. Sets only the variables the owner
 * changed (missing tokens fall back to the globals.css defaults), and derives
 * the button hover shades + readable text colors (`--on-*`) so buttons stay
 * legible whatever colors are chosen.
 */
export function cssVarsFor(theme: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of TOKEN_KEYS) {
    const hex = theme[key];
    if (hex) vars[`--color-${key}`] = hex;
  }
  if (theme.primary) {
    vars["--color-primary-hover"] = darken(theme.primary);
    vars["--on-primary"] = contrastText(theme.primary);
  }
  if (theme.secondary) {
    vars["--color-secondary-hover"] = darken(theme.secondary);
    vars["--on-secondary"] = contrastText(theme.secondary);
  }
  if (theme.highlight) vars["--on-highlight"] = contrastText(theme.highlight);
  return vars;
}

/** Merge defaults with saved overrides so every control has a value to show. */
export function resolveColors(theme: ThemeColors): Record<TokenKey, string> {
  return { ...DEFAULT_COLORS, ...theme };
}

export type ContrastWarning = { label: string; ratio: number };

/**
 * Readability checks for pairings the auto text-color can't fix on its own —
 * body text on the page, and the (always-light) header text on the header bar.
 */
export function contrastWarnings(colors: Record<TokenKey, string>): ContrastWarning[] {
  const warnings: ContrastWarning[] = [];
  const bodyText = contrastRatio(colors.ink, colors.page);
  if (bodyText < 4.5) warnings.push({ label: "Body text on the page background", ratio: bodyText });
  const headerText = contrastRatio("#ffffff", colors.header);
  if (headerText < 3) warnings.push({ label: "Header text (white) on the header bar", ratio: headerText });
  return warnings;
}
