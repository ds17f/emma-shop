#!/usr/bin/env bash
#
# Push per-environment app secrets + vars from a gitignored env file to a
# GitHub Actions Environment (beta|prod). Idempotent — re-run any time a value
# rotates. Values live only on disk in .secrets/ (gitignored) + as encrypted
# GitHub secrets; never committed.
#
# Usage:
#   ./scripts/push-env-secrets.sh prod                  # reads .secrets/prod.env
#   ./scripts/push-env-secrets.sh beta .secrets/beta.env
#
# The secret/var split mirrors .github/workflows/deploy.yml. Keys whose value is
# still a <placeholder> (or empty) are skipped, so it's safe to run before every
# value is filled in.
#
# Prereqs: gh CLI installed + authenticated (`gh auth login`).

set -euo pipefail
cd "$(dirname "$0")/.."

ENVIRONMENT="${1:?usage: push-env-secrets.sh <environment> [envfile]}"
ENVFILE="${2:-.secrets/${ENVIRONMENT}.env}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"

# Classification — must match deploy.yml's ${{ secrets.X }} / ${{ vars.X }}.
SECRET_KEYS=" AUTH_SECRET ADMIN_EMAIL ADMIN_PASSWORD STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY "
VAR_KEYS=" AUTH_URL EMAIL_FROM SHOP_ADDRESS GA_MEASUREMENT_ID "

die() { echo "❌ $*" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || die "gh CLI not installed (https://cli.github.com)."
gh auth status >/dev/null 2>&1 || die "gh not authenticated — run: gh auth login"
[ -n "$REPO" ] || die "Could not determine the repo. Set REPO=owner/name."
[ -f "$ENVFILE" ] || die "env file not found: $ENVFILE"

echo "🔐 Pushing ${ENVFILE} → ${REPO} environment '${ENVIRONMENT}'"
echo

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac      # skip blanks + comments
  case "$line" in *=*) ;; *) continue ;; esac    # require KEY=VALUE
  key="$(printf '%s' "${line%%=*}" | tr -d '[:space:]')"
  val="${line#*=}"
  # Skip unfilled placeholders (<...>) and empties so partial files are safe.
  case "$val" in ''|'<'*'>') echo "  – ${key} (skipped: placeholder/empty)"; continue ;; esac

  if [[ " $SECRET_KEYS " == *" $key "* ]]; then
    printf '%s' "$val" | gh secret set "$key" --repo "$REPO" --env "$ENVIRONMENT"
    echo "  ✓ ${key} (secret)"
  elif [[ " $VAR_KEYS " == *" $key "* ]]; then
    gh variable set "$key" --repo "$REPO" --env "$ENVIRONMENT" --body "$val"
    echo "  ✓ ${key} (var) = ${val}"
  else
    echo "  ? ${key} (unknown key — not in deploy.yml; skipped)"
  fi
done < "$ENVFILE"

echo
echo "✅ Done. Verify:"
echo "   gh secret list   --env ${ENVIRONMENT}"
echo "   gh variable list --env ${ENVIRONMENT}"
