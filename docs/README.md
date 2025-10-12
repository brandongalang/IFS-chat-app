# Constellation Documentation

This directory contains all of the product, design, and engineering documentation for Constellation. It is organized into four primary sections for solo development and AI agent orientation:

## 1. `/vision`

This directory contains the **"North Star"** documentation. It describes the long-term product vision, strategic goals, and the ideal architecture we are working towards. Use this for high-level context and inspiration.

## 2. `/current`

This directory contains the **"Map"** of our application as it exists today. It provides a practical, comprehensive description of how the system *actually works*. This includes current architecture, feature implementations, data models, operations, and completed work. This is your primary reference for understanding the existing system.

**Detailed structure**:
- `overview.md` - High-level product overview and vision
- `features/` - Feature documentation and PRDs
- `architecture/` - Technical architecture and system design
- `operations/` - Operational runbooks and procedures
- `development/` - Development processes, testing, and agent guides

## 3. `/planning`

This directory contains **active development planning** and upcoming features. It includes feature priorities, scoping documents, and work in progress. This is where you'll find what to build next.

**Detailed structure**: See [`/planning/README.md`](./planning/README.md) for the complete planning documentation workflow and implementation logging format.

## 4. `/archive`

This directory contains **completed work** including finished planning documents and implementation logs. This provides historical context for how features were built and decisions were made.

## Recently updated highlights (October 12, 2025)
- **Restructured documentation** into four clear sections for better solo development and AI agent orientation
- **Consolidated current state** - all existing features, architecture, and operations now in `/current/`
- **Priority-based planning** - `/planning/` organized by urgency (`next/` vs `backlog/`)
- **Implementation tracking** - `/planning/implementation/` for active coding sessions with task progress
- **Historical archive** - completed work preserved in `/archive/` for future reference
- **Agent guidelines** - See [`../AGENTS.md`](../AGENTS.md) for detailed implementation logging format and workflow
