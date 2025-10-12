# Specs & Task Documentation

This directory contains product requirements, technical specifications, and implementation plans organized by lifecycle stage.

## Structure

### `/scoping/`
**Early-stage planning and feature ideas**
- Product requirements documents (PRDs)
- Feature proposals and brainstorming
- Architecture exploration
- Not yet committed to implementation
- May be revised, combined, or discarded

Examples: Feature priority matrices, UX walkthroughs, initial technical designs

### `/in-progress/`
**Active work with open PRs**
- Specs for features currently being implemented
- Move here when work begins (branch created, PR opened)
- Should reference the relevant PR number
- May be updated during implementation

Examples: Active feature specs, implementation guides being followed

### `/completed/`
**Shipped features and finished work**
- Specs for merged PRs and deployed features
- Serves as historical record of implementation decisions
- Should include final PR number(s)
- Reference for future related work

Examples: Completed feature specs, migration plans that were executed

## Workflow

1. **Create** new specs in `/scoping/` during planning
2. **Move** to `/in-progress/` when work begins (add PR reference)
3. **Move** to `/completed/` when PR merges (add final PR number)
4. **Archive** or delete specs that are no longer relevant

## Relationship to `/docs/`

- `/docs/features/` - Living documentation of shipped features (user-facing)
- `/docs/runbooks/` - Operational procedures and troubleshooting
- `/specs/` - Implementation planning and historical specs (developer-facing)

Specs are implementation plans; docs are maintenance references.

## Naming Conventions

- Use kebab-case for file names: `feature-name-spec.md`
- Prefix with numbers for sequencing: `001-feature-name.md`
- Include PR numbers in completed specs: `feature-name-spec-pr-123.md` (optional)

## Updating Rules

When working on specs:
- Always update the spec during implementation if scope changes
- Add a "Related PRs" section linking to all relevant PRs
- Move completed specs even if implementation deviated from plan (they're historical record)
- Keep the final state in `/completed/` as a record of what was actually built
