# AI-Powered Product Development: IFS Therapy Companion
## A Product Manager's AI Development Showcase

> **Demonstrating systematic product management of complex AI systems using modern agentic development tools**

This project demonstrates how a technical Product Manager can leverage cutting-edge AI development tools to build sophisticated, production-ready applications. The IFS Therapy Companion serves as a case study in managing multi-agent AI systems, coordinating development workflows, and delivering healthcare-grade software through AI-assisted product development.

**Repository**: https://github.com/brandongalang/IFS-chat-app.git

---

## 🎯 Product Management Approach: AI-First Development

### The 7-Day Full-Stack Challenge
As a Product Manager with no prior solo full-stack development experience, I set out to prove AI could genuinely compress learning curves. The result: **Trailhead**, a sophisticated IFS therapy companion built in 7 days with:

- **2,500+ lines of TypeScript** across frontend and backend
- **30+ AI agent tools** implementing therapeutic methodology
- **Domain-specific memory system** with differential snapshot architecture
- **Production-ready features** including authentication, real-time chat, and data visualization

### The CAST Framework for AI Development
Through painful trial and error, I developed a systematic approach that actually works:

#### **C**larify: Define Exactly What You Want
- Not "build me a dashboard" but "dashboard showing user's 5 most recent conversations, with archive/delete actions, displaying first message truncated to 50 characters"
- Partner with AI to refine requirements through iterative questioning

#### **A**rchitect: Make Foundational Decisions  
- Database schema design, security boundaries, naming conventions require human judgment
- AI implements any approach perfectly, but architectural decisions need domain expertise
- Use AI to propose options and explain trade-offs, then choose based on long-term implications

#### **S**caffold: Build Minimal Skeleton Files
- Establish patterns AI can follow rather than one-shotting complete features
- Create first components showing loading states, errors, props, imports
- Incrementally extend established patterns for architectural coherence

#### **T**est: Let AI Define "Correct" 
- Never write tests myself, but instruct agents to test each request before committing
- Tests become communication with AI, defining correctness in your specific context

### Strategic AI Tool Orchestra
No single tool handles every cognitive task. I assembled a specialized toolkit:

#### **Complex + Precision: GPT-5-Thinking-High in Warp**
- **When**: High-consequence changes where mistakes are expensive
- **Example**: Built complete user memory system with differential state management, JSON Patch algorithms, and secured cron automation - 470 lines across 9 files, one-shot implementation
- **Speed**: Slow (several minutes) but surgical reliability
#### **Fast Agentic Exploration: Claude Code**  
- **When**: Real-time problem-solving and codebase exploration
- **Killer Feature**: Spawning sub-agents for parallel tasks with specific POVs
- **Example**: Simultaneous codebase exploration and pattern searches, synthesized results

#### **Brute Force Context: Gemini CLI**
- **When**: Whole-codebase analysis, architectural trade-offs
- **Advantage**: Massive context windows + built-in Google search
- **Example**: Input entire codebase, ramble about problems, paste lengthy error logs conversationally

#### **Frontend + Async: Jules**
- **When**: UI skeletons, interactive planning, simple refactors
- **Workflow**: 10 minutes detailed specs → commit to branch → working PR 10 minutes later
- **Strength**: Interactive planning with asynchronous implementation in separate VMs

#### **Voice Input: Wispr Flow**
- **When**: Any complex explanation or requirement gathering  
- **Advantage**: 109 WPM transcription captures thinking process, not just commands
- **Impact**: Voice provides context and uncertainty that helps AI explore approaches

## 📊 The Human-AI Division of Labor

### What You Cannot Delegate
Hard-learned lesson: **You cannot prompt what you cannot explain logically**. Critical non-delegable decisions:

#### **Architectural Foundations**
- **Database schema design** - Every wrong choice cascades through your entire application
- **Security boundaries** - Row Level Security, authentication flows, data access patterns
- **Domain logic** - How IFS therapy concepts map to data structures and user workflows
- **Integration decisions** - Which services connect and how they handle failure states

#### **The Gray Zone: Collaborative Magic**
Where domain expertise meets AI implementation skills. Example: **Parts Garden Feature**

**My Constraints**: Parts as nodes, relationships as edges, visual weight based on evidence strength, emotional charge through color/size, drag-and-drop with stable positioning

**AI's Implementation**: 500+ lines of sophisticated React with D3.js integration - force-directed graph with physics simulation, self-organizing parts based on relationships, smooth animations reflecting emotional charge, dynamic clustering

**The Result**: Code I couldn't have written in six months, implementing a vision I couldn't have technically specified.

### Why Starting From Scratch Fails
**The Anti-Pattern**: Requesting complete features from scratch creates disconnected code feeling like different developers worked from subtly different specifications.

**The Breakthrough**: AI should follow foundational decisions, not make them.

#### **Incremental Expansion Strategy**
1. **Build One Domain First**: Started with chat agent as solid foundation
2. **Expand Adjacent Areas**: From chat → user memory → parts visualization → relationship mapping  
3. **Establish Patterns**: Let AI extend and refine rather than create from nothing
4. **Maintain Coherence**: Every generated line feels architecturally consistent

### Planning Revolutionizes Everything
**Key Insight**: Have AI explain what it's building before asking it to execute.

This planning step:
- Defines "correctness" within your specific context
- Becomes specification language AI understands and optimizes toward  
- Eliminates dead-end execution that plagued other approaches
- Prevents "fake implementations" when AI gets overwhelmed

**Workflow**: Rubber duck with GPT-5-Thinking-High first → let it crawl codebase and develop approach → execute that plan with appropriate tool

## Ethereal Theme (global)

The ethereal visual style is controlled centrally via ThemeController and CSS variables.

- Dev override (no redeploy):
  ```js
  // In browser console
  localStorage.setItem('eth-theme', JSON.stringify({ enabled: 1 })) // or 0 to hide backdrop
  // Change background image (must exist in /public)
  localStorage.setItem('eth-theme', JSON.stringify({ imageUrl: '/ethereal-bg.jpg' }))
  location.reload()
  ```
- Central tokens live in `config/etherealTheme.ts`:
  - Background image URL, vignette levels, blob colors/positions
  - Text opacities and letter spacing (assistant/user)
  - Animation timings (word/char fade, streaming cadence)
- Components consume CSS variables; avoid hardcoding visuals in components. See `warp.md` for rules and a PR checklist.

## 🔧 AI Development Workflow Management

### Sprint Planning with AI Agents
Demonstrating modern product management practices:

#### Epic Breakdown & Story Generation
```bash
# Using Task Master AI for automated story decomposition
task-master parse-prd .taskmaster/docs/user-memory-feature.md
task-master analyze-complexity --research
task-master expand --all --research
```

#### Cross-functional Coordination
- **Design System**: Automated component generation using shadcn/ui patterns
- **Backend Services**: API endpoint generation with Supabase integration
- **Testing Strategy**: Automated test case creation for critical user journeys
- **Documentation**: Real-time API docs and user guides through AI assistance

#### Quality Assurance Integration
- **Code Review Automation**: Jules integration for pattern recognition and best practices
- **Performance Monitoring**: Built-in analytics for response time and user satisfaction
- **Security Validation**: Automated security scanning and compliance checking


## 🚀 AI-Enhanced Product Development Process

### Requirements to Deployment: AI-Accelerated Pipeline

This project showcases how a Product Manager can leverage AI tools throughout the entire product development lifecycle:

#### 1. Requirements Analysis & Planning
```bash
# AI-powered PRD generation and story breakdown
task-master init
task-master parse-prd .taskmaster/docs/therapy-companion-prd.txt
task-master analyze-complexity --research
```

#### 2. Technical Architecture Design  
- **Claude Code**: Generated system architecture diagrams and API specifications
- **Context7 MCP**: Validated framework choices against latest documentation
- **Gemini CLI**: Analyzed large codebases for integration patterns and best practices

#### 3. Implementation Coordination
- **Multi-agent development**: Coordinated 4 specialized AI agents (Planning, Implementation, Testing, Documentation)
- **Real-time code review**: Jules provided continuous quality feedback during development
- **Cross-platform testing**: Replit enabled collaborative testing across different environments

#### 4. Quality & Compliance Management
- **Automated security scanning**: Built-in HIPAA compliance validation
- **Performance optimization**: AI-driven database query optimization and caching strategies
- **Accessibility testing**: Automated ARIA compliance checking and keyboard navigation validation

### Product Decision Framework

#### Technical Debt Management
Strategic decisions to balance velocity with long-term maintainability:

- **Modular agent architecture** allows incremental AI model upgrades
- **API-first design** enables independent frontend/backend iteration cycles  
- **Progressive enhancement** ensures functionality across different user environments
- **Comprehensive logging** provides data for continuous product improvement

#### Stakeholder Communication
AI tools enhanced traditional PM communication:

- **Automated status reports** generated from git commits and task completion
- **Visual progress tracking** through Task Master AI dashboards
- **Task Master AI** - Automated project management and story decomposition  
- **OpenRouter Account** - Multi-model AI inference for optimal performance
- **Supabase Pro** - Production-grade backend with real-time capabilities
- **Notion Workspace** - Integrated knowledge management via MCP

### The Actual 7-Day Timeline
Based on building Trailhead from scratch with no prior full-stack experience:

#### **Days 1-2: Foundation & Framework Development**
- **CAST Framework Creation**: Developed systematic AI development approach through trial and error
- **Tool Stack Assembly**: Tested and selected specialized AI tools for different cognitive tasks  
- **Version Control Mastery**: Learned Git workflows, branching, and checkpointing strategies
- **Domain Architecture**: Made core decisions about IFS therapy data models and security boundaries

#### **Days 3-5: Core Feature Implementation**
- **Chat Agent Development**: Built IFS-trained conversational AI with therapeutic methodology
- **User Memory System**: Implemented differential snapshot architecture for psychological continuity
- **Database Design**: Created PostgreSQL schema with Row Level Security for healthcare compliance
- **Authentication & Sessions**: Integrated Supabase Auth with secure session management

#### **Days 6-7: Advanced Features & Polish**
- **Parts Garden Visualization**: D3.js force-directed graph with emotional charge visualization
- **Real-time State Sync**: Server-sent events with task visualization and progress indicators  
- **Mobile Responsiveness**: shadcn/ui components with dark/light theme support
- **Production Deployment**: Vercel + Supabase with environment configuration

### What Actually Changed
**The Real Insight**: AI makes domain expertise programmable. 

Six months ago, manually building Trailhead would have been laughable. Terms like "Row Level Security," "force-directed graphs," and "differential state management" were completely foreign.

**The Breakthrough**: You don't need implementation expertise, you need architectural decision-making combined with domain knowledge.

#### **From PM with IFS Therapy Understanding → Functioning Software**
- **Domain Expertise**: Deep understanding of IFS methodology and therapeutic needs
- **AI Implementation**: Transformed mental models into 2,500+ lines of production code
- **Result**: Functioning app with authentication, real-time chat, data visualization, and mobile engagement

**Key Learning**: The barrier between knowing what should exist and making it exist is getting dramatically lower.

## 🔍 Project Exploration Guide

### Key Files Demonstrating PM + AI Integration
```bash
# View AI agent configuration
cat mastra/agents/ifs-agent.ts

# Review automated task management
ls .taskmaster/tasks/

# Examine AI-generated API endpoints  
find app/api -name "*.ts" | head -5

# Check feature flag implementation
cat config/features.ts
```

## 🚀 Running the liteLLM Proxy

This project uses `liteLLM` to provide a proxy layer for LLM calls, enabling features like prompt injection detection. To run the application locally, you'll need to start the `liteLLM` proxy in a separate terminal.

**1. Set your OpenRouter API Key:**

Make sure your `OPENROUTER_API_KEY` is set as an environment variable. You can add it to a `.env.local` file in the root of the project:

```
OPENROUTER_API_KEY=your_api_key_here
```

**2. Start the liteLLM Proxy:**

Open a new terminal window and run the following command:

```bash
litellm --config litellm.config.yaml --port 4000
```

This will start the proxy bound on `0.0.0.0:4000` (a wildcard bind address).

**3. Point the app to your local proxy (client connection):**

Add this to `.env.local` (note we connect via `127.0.0.1`, not `0.0.0.0`):

```
OPENROUTER_BASE_URL=http://127.0.0.1:4000
```

Then restart your Next.js dev server so env changes apply.

- Default behavior without `OPENROUTER_BASE_URL` is to call OpenRouter cloud at `https://openrouter.ai/api/v1`.
- If port 4000 is busy, pick another (e.g., 4001) and set `OPENROUTER_BASE_URL=http://127.0.0.1:4001`.

**Sanity check the proxy:**

```bash
# For GLM-4.5-Air model (via /v1/chat/completions endpoint)
curl -s -X POST http://127.0.0.1:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"openrouter/z-ai/glm-4.5-air","messages":[{"role":"user","content":"hello"}]}'

# Alternative: Standard endpoint (if /v1 doesn't work)
curl -s -X POST http://127.0.0.1:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"openrouter/llama-3.1-8b-instruct","messages":[{"role":"user","content":"hello"}]}'
```

If your litellm config exposes `/v1/chat/completions`, use that path instead.

---

## 🧩 Local Development: Processes to Run

To run the full experience locally, you'll typically run three processes in parallel:

1) LiteLLM proxy (LLM gateway)
- Purpose: Provide a local OpenAI-compatible endpoint to route LLM calls.
- Terminal A:
```bash
# Ensure your OpenRouter API key is set in this terminal
export OPENROUTER_API_KEY=YOUR_KEY_HERE
# Start the proxy and bind to port 4000
npx litellm --config litellm.config.yaml --port 4000
```
- App config in `.env.local`:
```bash
# Connect the app to your local proxy
OPENROUTER_BASE_URL=http://127.0.0.1:4000
# Or, if your proxy exposes /v1/chat/completions:
# OPENROUTER_BASE_URL=http://127.0.0.1:4000/v1
```
- Sanity check the proxy:
```bash
curl -s -X POST http://127.0.0.1:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"openrouter/llama-3.1-8b-instruct","messages":[{"role":"user","content":"hello"}]}'
```
If that 404s but `/v1/chat/completions` works, use the `/v1` base URL as shown above.

2) Mastra (agent tools). Pick one:
- Dev mode (watches for changes):
```bash
npm run dev:mastra   # equivalent to: mastra dev --dir mastra
```
- One-time build (generate/update outputs):
```bash
npm run build:mastra # equivalent to: mastra build --dir mastra
```
Note: The Next.js API route imports agent code from `mastra/agents`. If you change tools or agent config, keep Mastra dev running or re-run the build.

3) Next.js app server
- Terminal C:
```bash
npm run dev
```
- After any changes to `.env.local`, restart this server so env vars apply.

### Troubleshooting
- ECONNREFUSED 127.0.0.1:4000:
  - Make sure LiteLLM is running and listening on port 4000.
  - Verify the correct endpoint path: `/chat/completions` vs `/v1/chat/completions`.
  - Ensure `OPENROUTER_API_KEY` is present in the LiteLLM process environment.
  - If 4000 is busy, start LiteLLM on another port and update `OPENROUTER_BASE_URL` accordingly.
- Webpack hot-update 404 during dev: benign during HMR.
- Hydration mismatch: avoid browser-only APIs (`window`, `localStorage`) in SSR render paths; move to `useEffect`, or mark components `ssr: false`.

## 🔌 Agent API Architecture

### Core Agent Endpoints

#### Primary Agent Interface: `/api/chat`
- **Streaming Agent Responses**: Real-time AI SDK message streaming with task visualization
- **Multi-Model Routing**: Intelligent model selection via OpenRouter integration
- **Context Management**: Persistent conversation state with relationship mapping
- **Fallback Systems**: Graceful degradation for development and testing scenarios

#### Development Agent Simulator: `/api/chat/dev`
- **Local Development**: Full-featured agent simulation without external API dependencies
- **Task Visualization**: Realistic streaming task steps and reasoning display
- **Access Control**: Available only when dev mode is enabled (`NEXT_PUBLIC_IFS_DEV_MODE=true` or `NODE_ENV=development`)

### Advanced Analytics & Insights Engine

#### Insights Generation API
The system includes a sophisticated insights generation system that demonstrates advanced agent capabilities:

- **GET `/api/insights`**: Dynamic insight card generation with JIT (Just-In-Time) provisioning
  - Smart filtering by status: `pending`, `revealed`, `actioned`
  - Configurable limits with intelligent backfill algorithms
  - Real-time insight generation when `IFS_INSIGHTS_JIT=true`

- **POST `/api/insights/[id]/reveal`**: Idempotent insight revelation with timestamp tracking
- **POST `/api/insights/[id]/feedback`**: Advanced feedback collection with quartile rating system

#### Agent Performance Analytics
- **Action Logging**: Comprehensive tracking of all agent decisions and tool executions
- **User Engagement Metrics**: Session duration, interaction patterns, and satisfaction scoring
- **Model Performance**: Response time, accuracy, and user preference tracking across different AI models


## 🎨 Advanced Agent Development Patterns

## 🔐 Secret Scanning

This repository uses [gitleaks](https://github.com/gitleaks/gitleaks) to prevent committing secrets.
Every pull request runs a gitleaks scan in CI and the build fails if any secrets are detected.

Run a scan locally before pushing changes:

```bash
gitleaks detect --source=. --config=.gitleaks.toml --no-git
```
