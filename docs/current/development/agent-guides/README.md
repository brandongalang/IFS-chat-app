# Agent Guides

This directory contains task-specific guides that agents should read **on-demand** based on their current task. These guides are not loaded into the context window by default - agents should read them only when needed.

## Available Guides

### **[feature-implementation.md](./feature-implementation.md)**
**When to read**: Starting work on a new feature from `/docs/planning/next/`

**Contains**:
- Pre-implementation checklist
- Code structure navigation map
- Implementation log template
- Common patterns for adding features
- Documentation requirements
- Before opening PR checklist

### **[bug-fixes.md](./bug-fixes.md)**
**When to read**: Fixing a bug or investigating unexpected behavior

**Contains**:
- Investigation process
- Fix workflow (test-first approach)
- When to update documentation
- Common bug types and patterns
- Testing checklist

### **[documentation-workflow.md](./documentation-workflow.md)**
**When to read**: Before opening any PR or when unsure about docs requirements

**Contains**:
- When to update docs (and when to skip)
- Step-by-step documentation process
- Using `.docmap.json` to find affected docs
- Documentation standards
- Troubleshooting docs CI failures

### **[branch-management.md](./branch-management.md)**
**When to read**: Before starting any work or when having branch issues

**Contains**:
- Branch verification commands
- Branch naming conventions
- Common branch issues and solutions
- GitHub CLI commands
- Workflow best practices

### **[testing.md](./testing.md)**
**When to read**: Writing tests or debugging test failures

**Contains**:
- Test types (unit, integration, e2e)
- Running tests
- Writing test examples
- Test organization
- Best practices
- Debugging test failures

## Usage Pattern

1. **Always loaded**: `/AGENTS.md` or `/WARP.md` (minimal, essential rules)
2. **Load on-demand**: Read specific guide from this directory based on task
3. **Cross-reference**: Guides link to each other when relevant

## Benefits

- **Reduced context window**: Only load what you need
- **Focused guidance**: Each guide covers one task type thoroughly
- **Easy maintenance**: Update one guide without affecting others
- **Clear organization**: Find what you need quickly
