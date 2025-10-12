# Planning Documentation Structure

This directory contains all work we're planning to do, organized by priority and type.

## Structure Overview

```
/planning/
├── next/                    # 1-3 things you're ready/close to building
├── backlog/                 # Things you're thinking about but not immediate priorities
└── implementation/          # Active coding sessions & progress logs
```

```
/docs/
├── archive/                # Completed work (planning docs & implementation logs)
├── current/                # What's implemented now
└── vision/                 # Long-term vision and strategy
```

## Priority Organization

### `/next/` - Ready to Build (1-3 items)
High-priority features you're ready or close to building. These represent your immediate focus and what you'll tackle soon.

**Examples:**
- `feat-priority-matrix.md` - Overall feature prioritization framework
- `feat-inbox-to-chat-bridge.md` - Critical blank page problem solver

### `/backlog/` - Future Consideration
Features and technical work you're thinking about but aren't immediate priorities. These are "someday/maybe" items.

**Examples:**
- `feat-journey-narrative.md` - Nice-to-have storytelling features
- `tech-grafana-observability.md` - Infrastructure improvements

## Implementation Sessions

The `/implementation/` directory contains your active coding sessions where you log progress **as you build**.

**Purpose:** Real-time progress tracking, decision logs, and work continuation
**Examples:**
- `feat-inbox-to-chat-bridge-session-1.md` - First coding session
- `feat-inbox-to-chat-bridge-session-2.md` - Follow-up work session

## Development Workflow

1. **Review priorities** in `/next/` or `/backlog/`
2. **Start implementation session** in `/implementation/` when ready to code
3. **Log progress** as you build, update existing logs
4. **Archive completed work** to `/docs/archive/` when done

## Document Types

### **Feature Planning** (`feat-`)
User-facing features that add new capabilities or improve user experience.
- `feat-inbox-to-chat-bridge.md` - New user-facing functionality
- `feat-parts-evolution.md` - Enhanced user workflows

### **Technical Planning** (`tech-`)
Backend improvements, refactors, infrastructure changes, or technical debt reduction.
- `tech-grafana-observability.md` - Monitoring and observability setup
- `tech-memory-v2.md` - Database or architecture improvements

4. **Archive completed work** to `/docs/archive/` when done

## Why This Structure?

1. **Clear priority separation** - `next/` vs `backlog/` makes immediate priorities obvious
2. **Solo development friendly** - Simple structure that doesn't overcomplicate your workflow
3. **Progress visibility** - See what's planned vs. what's being actively worked on
4. **Resume capability** - You can pick up implementation sessions where you left off

## Adding New Documents

1. **For immediate priorities:** Add to `/next/` with `feat-` or `tech-` prefix
2. **For future consideration:** Add to `/backlog/` with `feat-` or `tech-` prefix  
3. **For implementation:** Create in `/implementation/` with session numbering

This structure helps you understand: **What to build next** (`/next`), **what you might build later** (`/backlog`), **current progress** (`/implementation`), and **what was accomplished** (`/archive`).
