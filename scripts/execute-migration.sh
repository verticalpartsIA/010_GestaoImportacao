#!/bin/bash
# Execute Supabase migrations via REST API
# Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/execute-migration.sh

set -e

SUPABASE_URL="${SUPABASE_URL:-https://jxtqwzmpgofwctqajewt.supabase.co}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set"
  echo "Usage: SUPABASE_SERVICE_ROLE_KEY='...' ./scripts/execute-migration.sh"
  exit 1
fi

echo "🔧 Executing Supabase migrations..."
echo "URL: $SUPABASE_URL"

# Read migration file
MIGRATION_SQL=$(cat migrations/002-create-vistorias-obras-table.sql)

# Execute via REST API using RPC (requires custom function)
# For now, provide instructions for manual execution
echo ""
echo "⚠️  Direct SQL execution via REST API requires a custom RPC function."
echo "📋 Manual execution steps:"
echo ""
echo "1. Go to: $SUPABASE_URL/project/sql"
echo "2. Create a new query and paste this SQL:"
echo ""
cat migrations/002-create-vistorias-obras-table.sql
echo ""
echo "3. Click 'Run'"
echo "4. Verify table creation in Tables → vistorias_obras"