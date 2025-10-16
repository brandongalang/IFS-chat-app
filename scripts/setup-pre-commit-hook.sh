#!/bin/bash

# Setup pre-commit hook for bead file-lock enforcement
# Run this once to install the hook: bash scripts/setup-pre-commit-hook.sh

set -e

HOOK_FILE=".git/hooks/pre-commit"

cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash

# Pre-commit hook: Prevent committing to files checked out by other beads
# Reads file checkout state from bead notes in format: "Checkout: file1, file2, file3"

set -e

# Get all beads and their checkout notes
BEADS_DB=".beads/ifs-chat-app.db"

if [ ! -f "$BEADS_DB" ]; then
  exit 0
fi

# Extract checkout info from all beads using sqlite3 or grep fallback
get_locked_files() {
  # Try sqlite3 first if available
  if command -v sqlite3 &> /dev/null && file "$BEADS_DB" | grep -q "SQLite"; then
    # Query beads for checkout notes
    sqlite3 "$BEADS_DB" "SELECT notes FROM beads WHERE notes LIKE 'Checkout:%'" 2>/dev/null || true
  fi
}

LOCKED_NOTES=$(get_locked_files)

if [ -z "$LOCKED_NOTES" ]; then
  exit 0
fi

# Get staged files
STAGED=$(git diff --cached --name-only)

# Check each staged file against locked files
CONFLICT=0
while IFS= read -r note; do
  if [[ "$note" =~ ^Checkout:\ (.*)$ ]]; then
    FILES_STR="${BASH_REMATCH[1]}"
    # Parse comma-separated files
    IFS=',' read -ra LOCKED_FILES <<< "$FILES_STR"
    
    for locked_file in "${LOCKED_FILES[@]}"; do
      # Trim whitespace
      locked_file=$(echo "$locked_file" | xargs)
      
      for staged_file in $STAGED; do
        if [ "$staged_file" = "$locked_file" ]; then
          echo "❌ ERROR: File '$staged_file' is checked out by another bead"
          echo "   Run: bd show <bead-id> to see which bead has it checked out"
          CONFLICT=1
        fi
      done
    done
  fi
done <<< "$LOCKED_NOTES"

if [ $CONFLICT -eq 1 ]; then
  echo ""
  echo "💡 TIP: Use 'git diff --cached --name-only' to see what you're committing"
  echo "   Contact the agent with the bead that has these files checked out"
  exit 1
fi

exit 0
EOF

chmod +x "$HOOK_FILE"

echo "✅ Pre-commit hook installed at $HOOK_FILE"
echo ""
echo "How it works:"
echo "1. Before each commit, the hook checks for file locks in bead notes"
echo "2. If you try to commit a 'checked out' file, the commit is blocked"
echo "3. Use 'bd show <bead-id>' to see which bead has files locked"
echo ""
echo "To bypass (NOT recommended): git commit --no-verify"
