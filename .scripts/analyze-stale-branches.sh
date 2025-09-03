#!/bin/bash

# Branch Analysis Script
# Analyzes branches for potential cleanup candidates

echo "🔍 Branch Analysis Report"
echo "========================================"

# Function to categorize branches by age
analyze_branches() {
    local ref_pattern=$1
    local branch_type=$2
    
    echo "\n📊 $branch_type Branches Analysis:"
    echo "-------------------------------------------"
    
    # Recent (last 3 days)
    recent=$(git for-each-ref --format='%(refname:short) %(committerdate:relative)' $ref_pattern | grep -E "(hours?|[0-2] days?) ago" | wc -l)
    echo "🟢 Recent (0-3 days): $recent branches"
    
    # Active (last week)  
    active=$(git for-each-ref --format='%(refname:short) %(committerdate:relative)' $ref_pattern | grep -E "([3-7] days?) ago" | wc -l)
    echo "🟡 Active (3-7 days): $active branches"
    
    # Stale (1-4 weeks)
    stale=$(git for-each-ref --format='%(refname:short) %(committerdate:relative)' $ref_pattern | grep -E "(weeks?) ago" | wc -l)
    echo "🟠 Stale (1+ weeks): $stale branches"
    
    # Old (1+ months)
    old=$(git for-each-ref --format='%(refname:short) %(committerdate:relative)' $ref_pattern | grep -E "(months?|years?) ago" | wc -l)
    echo "🔴 Old (1+ months): $old branches"
    
    echo "📈 Total $branch_type: $(git for-each-ref $ref_pattern | wc -l) branches"
}

# Analyze local and remote branches
analyze_branches "refs/heads/" "Local"
analyze_branches "refs/remotes/origin/" "Remote"

echo "\n🔍 Merged Branch Analysis:"
echo "-------------------------------------------"

# Check merged branches
merged_local=$(git branch --merged main | grep -v "main$" | grep -v "^\*" | wc -l)
merged_remote=$(git branch -r --merged origin/main | grep -v "origin/main$" | wc -l)

echo "✅ Merged Local: $merged_local branches (safe to delete)"
echo "✅ Merged Remote: $merged_remote branches (safe to delete)"

# Show specific merged branches
if [ $merged_local -gt 0 ]; then
    echo "\n📋 Merged Local Branches:"
    git branch --merged main | grep -v "main$" | grep -v "^\*" | sed 's/^/  /'
fi

if [ $merged_remote -gt 0 ]; then
    echo "\n📋 Merged Remote Branches:"
    git branch -r --merged origin/main | grep -v "origin/main$" | sed 's/^/  /'
fi

echo "\n🚩 Potential Cleanup Candidates:"
echo "-------------------------------------------"

# Find branches by pattern that might need attention
echo "\n🔍 PR branches (may be completed):"
git branch -r | grep "origin/pr/" | sed 's/^/  /' || echo "  None found"

echo "\n🔍 Doc branches (may be merged differently):"
git branch -r | grep -E "origin/(doc|docs)/" | sed 's/^/  /' || echo "  None found"

echo "\n🔍 Very recent branches (active development):"
git for-each-ref --format='  %(refname:short) - %(committerdate:relative) - %(authorname)' refs/remotes/origin/ | grep -E "(hours?|[0-2] days?) ago"

echo "\n💡 Recommendations:"
echo "-------------------------------------------"
echo "1. ✅ Run safe cleanup script for merged branches"
echo "2. 🤝 Coordinate with team for PR branches"  
echo "3. 📅 Set up weekly branch cleanup routine"
echo "4. 🔄 Configure auto-delete for merged PRs in GitHub/GitLab"
echo "5. ⏰ Review stale branches monthly"