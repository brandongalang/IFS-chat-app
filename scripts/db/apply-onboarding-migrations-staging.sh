#!/usr/bin/env bash
set -euo pipefail

# Applies only the onboarding migrations (009–011) to the staging Supabase database.
# Usage:
#   STAGING_SUPABASE_DB_URL=postgresql://... ./scripts/db/apply-onboarding-migrations-staging.sh
# Optional safety:
#   export EXPECT_PROJECT_REF=pegclbtzfaccnhmkviqb
#   export YES=1   # to skip confirmation prompt for non-interactive use

HERE_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$HERE_DIR/../.." && pwd)
MIG_DIR="$REPO_ROOT/supabase/migrations"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' is required on PATH" >&2; exit 1; }; }
need psql

if [[ -z "${STAGING_SUPABASE_DB_URL:-}" ]]; then
  echo "Error: STAGING_SUPABASE_DB_URL is not set." >&2
  echo "Obtain a non-production connection string from Supabase Dashboard (Project Settings → Database)." >&2
  exit 1
fi

PROJECT_HOST=$(printf %s "$STAGING_SUPABASE_DB_URL" | sed -E 's#.*@([^:/]+).*#\1#')
EXPECTED_REF=${EXPECT_PROJECT_REF:-pegclbtzfaccnhmkviqb}
if [[ "$PROJECT_HOST" != *"$EXPECTED_REF"* ]]; then
  echo "Error: The provided DB URL host '$PROJECT_HOST' does not include expected project ref '$EXPECTED_REF'." >&2
  echo "Refusing to run to avoid accidental production impact." >&2
  exit 1
fi

if [[ -z "${YES:-}" ]]; then
  read -r -p "About to apply onboarding migrations (009–011) to '$PROJECT_HOST'. Continue? [y/N] " ans
  case "$ans" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 1;;
  esac
fi

apply_file() {
  local file="$1"
  echo "Applying $file ..."
  PGPASSWORD="${PGPASSWORD:-}" psql -v ON_ERROR_STOP=1 "$STAGING_SUPABASE_DB_URL" -f "$file"
}

apply_file "$MIG_DIR/009_onboarding_schema.sql"
apply_file "$MIG_DIR/010_onboarding_rls.sql"
apply_file "$MIG_DIR/011_onboarding_seed.sql"

# Refresh PostgREST schema cache (best-effort; may be restricted)
psql "$STAGING_SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';" || true

# Basic verification
psql "$STAGING_SUPABASE_DB_URL" -c "select to_regclass('public.user_onboarding') as exists;"
psql "$STAGING_SUPABASE_DB_URL" -c "select polname from pg_policies where schemaname='public' and tablename='user_onboarding';"

echo "Done. Verify the app /api/onboarding/state no longer returns 500."
