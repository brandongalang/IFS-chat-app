#!/usr/bin/env bash
set -euo pipefail

# Push migrations to linked Supabase project (production)
# Reads password from .env.local automatically

HERE_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$HERE_DIR/../.." && pwd)

# Load .env.local if it exists
ENV_FILE="$REPO_ROOT/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  # Extract SUPABASE_PROD_DB_PASSWORD from .env.local
  if grep -q "SUPABASE_PROD_DB_PASSWORD" "$ENV_FILE"; then
    export SUPABASE_PROD_DB_PASSWORD=$(grep "SUPABASE_PROD_DB_PASSWORD=" "$ENV_FILE" | cut -d '=' -f2)
    
    if [[ "$SUPABASE_PROD_DB_PASSWORD" == "your_production_password_here" ]] || [[ -z "$SUPABASE_PROD_DB_PASSWORD" ]]; then
      echo "❌ Error: SUPABASE_PROD_DB_PASSWORD not set in .env.local"
      echo ""
      echo "Steps to fix:"
      echo "1. Go to Supabase Dashboard → Project Settings → Database"
      echo "2. Copy or reset your database password"
      echo "3. Update SUPABASE_PROD_DB_PASSWORD in .env.local"
      exit 1
    fi
  else
    echo "❌ Error: SUPABASE_PROD_DB_PASSWORD not found in .env.local"
    exit 1
  fi
else
  echo "❌ Error: .env.local not found"
  exit 1
fi

echo "🔗 Pushing migrations to linked project (pegclbtzfaccnhmkviqb)..."
echo ""

# Push with the password from env
cd "$REPO_ROOT"
npx supabase db push --linked -p "$SUPABASE_PROD_DB_PASSWORD"

echo ""
echo "✅ Migrations pushed successfully!"
