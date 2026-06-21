#!/usr/bin/env bash
#
# Push the secrets the Deploy workflow (.github/workflows/deploy.yml) needs to
# GitHub Actions. Idempotent — re-run any time the token or key rotates.
#
#   Secrets set:  HCLOUD_TOKEN, SSH_PRIVATE_KEY
#   Vars set:     HCLOUD_LABEL, SHOP_URL   (only if you provide them)
#
# The secret *values* come from files on disk (never committed). By default it
# reads from this repo's gitignored .secrets/, but you can point it anywhere —
# e.g. straight at the deadly-monorepo copies, which is the canonical source:
#
#   HCLOUD_TOKEN_FILE=../deadly-monorepo/.secrets/hetzner-key.txt \
#   SSH_PRIVATE_KEY_FILE=../deadly-monorepo/ssh-key-2026-03-15.key \
#   ./scripts/setup-github-secrets.sh
#
# Or pass the token value inline, and optionally set repo variables too:
#   HCLOUD_TOKEN=hcloud_xxx SSH_PRIVATE_KEY_FILE=~/.ssh/emma ./scripts/setup-github-secrets.sh
#   SHOP_URL=https://shop.example.com ./scripts/setup-github-secrets.sh
#
# Prereqs: gh CLI installed + authenticated (`gh auth login`).

set -euo pipefail

# Run from the repo root regardless of where it's invoked.
cd "$(dirname "$0")/.."

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"

# Defaults point at this repo's gitignored .secrets/; override via env.
HCLOUD_TOKEN_FILE="${HCLOUD_TOKEN_FILE:-.secrets/hetzner-key.txt}"
SSH_PRIVATE_KEY_FILE="${SSH_PRIVATE_KEY_FILE:-.secrets/ssh-key-2026-03-15.key}"
# GoDaddy creds for the optional DNS step — single line "KEY:SECRET" (deadly's format).
GODADDY_KEY_FILE="${GODADDY_KEY_FILE:-.secrets/godaddy-key.txt}"

die() { echo "❌ $*" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || die "gh CLI not installed (https://cli.github.com)."
gh auth status >/dev/null 2>&1 || die "gh not authenticated — run: gh auth login"
[ -n "$REPO" ] || die "Could not determine the repo. Set REPO=owner/name."

echo "🔐 Pushing Actions secrets to ${REPO}"
echo

# --- HCLOUD_TOKEN: inline value wins, else file -----------------------------
if [ -n "${HCLOUD_TOKEN:-}" ]; then
  printf '%s' "$HCLOUD_TOKEN" | gh secret set HCLOUD_TOKEN --repo "$REPO"
  echo "  ✓ HCLOUD_TOKEN          (from \$HCLOUD_TOKEN)"
elif [ -f "$HCLOUD_TOKEN_FILE" ]; then
  # tr strips any trailing newline/whitespace so the token stays exact.
  tr -d '[:space:]' < "$HCLOUD_TOKEN_FILE" | gh secret set HCLOUD_TOKEN --repo "$REPO"
  echo "  ✓ HCLOUD_TOKEN          (from ${HCLOUD_TOKEN_FILE})"
else
  die "No HCLOUD_TOKEN: set \$HCLOUD_TOKEN or HCLOUD_TOKEN_FILE (missing: ${HCLOUD_TOKEN_FILE})."
fi

# --- SSH_PRIVATE_KEY: file only (preserve exact bytes/newlines) --------------
if [ -f "$SSH_PRIVATE_KEY_FILE" ]; then
  gh secret set SSH_PRIVATE_KEY --repo "$REPO" < "$SSH_PRIVATE_KEY_FILE"
  echo "  ✓ SSH_PRIVATE_KEY       (from ${SSH_PRIVATE_KEY_FILE})"
else
  die "No SSH key: set SSH_PRIVATE_KEY_FILE (missing: ${SSH_PRIVATE_KEY_FILE})."
fi

# --- GODADDY_KEY/SECRET: optional, for the DNS step (file is "KEY:SECRET") ----
if [ -f "$GODADDY_KEY_FILE" ]; then
  GD=$(tr -d '[:space:]' < "$GODADDY_KEY_FILE")
  printf '%s' "${GD%%:*}" | gh secret set GODADDY_KEY --repo "$REPO"
  printf '%s' "${GD#*:}"  | gh secret set GODADDY_SECRET --repo "$REPO"
  echo "  ✓ GODADDY_KEY/SECRET    (from ${GODADDY_KEY_FILE})"
else
  echo "  – GODADDY_KEY/SECRET    (skipped — ${GODADDY_KEY_FILE} not found; needed only for update_dns)"
fi

# --- Optional repo variables (only when provided) ---------------------------
if [ -n "${SHOP_ADDRESS:-}" ]; then
  gh variable set SHOP_ADDRESS --repo "$REPO" --body "$SHOP_ADDRESS"
  echo "  ✓ SHOP_ADDRESS (var)    = ${SHOP_ADDRESS}"
fi
if [ -n "${HCLOUD_LABEL:-}" ]; then
  gh variable set HCLOUD_LABEL --repo "$REPO" --body "$HCLOUD_LABEL"
  echo "  ✓ HCLOUD_LABEL (var)    = ${HCLOUD_LABEL}"
fi
if [ -n "${SHOP_URL:-}" ]; then
  gh variable set SHOP_URL --repo "$REPO" --body "$SHOP_URL"
  echo "  ✓ SHOP_URL (var)        = ${SHOP_URL}"
fi

# --- Resend email DNS (repo vars, domain-global) — only when provided --------
# RESEND_DKIM_VALUE is the resend._domainkey TXT value from Resend's Add-Domain
# screen; setting it enables the "Update email DNS" step in deploy.yml.
if [ -n "${RESEND_DKIM_VALUE:-}" ]; then
  gh variable set RESEND_DKIM_VALUE --repo "$REPO" --body "$RESEND_DKIM_VALUE"
  echo "  ✓ RESEND_DKIM_VALUE (var) set"
fi
if [ -n "${RESEND_MX_HOST:-}" ]; then
  gh variable set RESEND_MX_HOST --repo "$REPO" --body "$RESEND_MX_HOST"
  echo "  ✓ RESEND_MX_HOST (var)  = ${RESEND_MX_HOST}"
fi

echo
echo "✅ Done. Verify: gh secret list --repo ${REPO}"
