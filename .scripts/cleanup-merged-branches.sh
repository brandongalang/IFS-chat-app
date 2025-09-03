#!/bin/bash

# Safe Branch Cleanup Script
# Cleans up branches that are confirmed merged to main

set -e  # Exit on any error

echo "🧹 Starting Safe Branch Cleanup..."
echo "========================================"

# Check we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Ensure we're on main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    echo "⚠️  Switching to main branch (currently on: $current_branch)"
    git checkout main
    git pull origin main
fi

echo "\n📋 Phase 1: Cleaning up merged branches..."

# Clean up merged local branches (safe)
echo "\n🔍 Finding merged local branches..."
merged_locals=$(git branch --merged main | grep -v "main$" | grep -v "^\*" | xargs)
if [ -n "$merged_locals" ]; then
    echo "Found merged local branches: $merged_locals"
    echo "🗑️  Deleting merged local branches..."
    git branch -d $merged_locals
    echo "✅ Local merged branches cleaned up"
else
    echo "ℹ️  No merged local branches found"
fi

# Clean up merged remote branch (confirmed safe)
echo "\n🌐 Checking for specific merged remote branch..."
if git ls-remote --exit-code origin fix/ts-ci-green > /dev/null 2>&1; then
    echo "🗑️  Deleting merged remote branch: fix/ts-ci-green"
    git push origin --delete fix/ts-ci-green
    echo "✅ Merged remote branch deleted"
else
    echo "ℹ️  Merged remote branch already cleaned up"
fi

# Prune stale remote tracking branches
echo "\n🔄 Pruning stale remote tracking branches..."
git remote prune origin
echo "✅ Remote tracking branches pruned"

echo "\n🎉 Safe cleanup completed!"
echo "========================================"

# Show remaining branch status
echo "\n📊 Current branch status:"
echo "Local branches: $(git branch | wc -l)"
echo "Remote branches: $(git branch -r | wc -l)"

echo "\n💡 Next steps:"
echo "- Review remaining branches with: git branch -a"
echo "- Consider running team coordination script for PR branches"
echo "- Set up automated cleanup for future merged branches"