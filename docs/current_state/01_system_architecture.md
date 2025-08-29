# Current System Architecture

This document describes the technical architecture of the Constellation application as it is currently implemented. It is intended for new technical team members.

## High-Level Overview

The application is a modern full-stack web application built on Next.js and Supabase. The core of the application is a sophisticated AI agent, built using the Mastra framework, that interacts with the user to help them explore their internal psychological landscape. The architecture prioritizes a secure, stateful, and responsive user experience.

## Technology Stack

- **Framework:** [Next.js](https://nextjs.org/) (v15) with the App Router.
- **Language:** [TypeScript](https://www.typescriptlang.org/).
- **Frontend:** [React](https://react.dev/) (v19).
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with a component library built on [shadcn/ui](https://ui.shadcn.com/) and Radix UI primitives.
- **State Management:** Primarily managed through standard React hooks. The Vercel AI SDK (`@ai-sdk/react`) is used specifically to handle the state of the chat UI, including message history and streaming responses.

## Data & Control Flow

Understanding the flow of data from user input to AI response is key to understanding the system.

1.  **User Input:** The user types a message in the React-based chat interface.
2.  **API Call:** The frontend sends the entire message history, along with the user's profile, to the backend via a `POST` request to the `/api/chat` endpoint.
3.  **Agent Invocation:** The `/api/chat` route handler receives the request. It dynamically imports and instantiates the **IFS Agent** from `mastra/agents/ifs-agent.ts`, passing the user's profile to the agent's system prompt for personalization.
4.  **LLM Processing:** The agent sends the conversation history and its system prompt (including the list of available tools) to the `z-ai/glm-4.5` model via the OpenRouter API.
5.  **Tool Use:** The LLM decides if it needs to use one of its tools. If so, it returns a "tool call" object. The Mastra framework executes the corresponding tool function (e.g., `searchParts` from `part-tools.ts`). The tool function then directly queries the Supabase database.
6.  **Action Logging:** If the tool performs a write operation (e.g., `createEmergingPart`), it uses the `actionLogger` service to record the change in the `agent_actions` table before committing it. This ensures the action is reversible.
7.  **Response Generation:** The result of the tool call is sent back to the LLM, which then uses this new information to generate its final text response to the user.
8.  **Streaming:** The final response is streamed back from the API route to the client, where the Vercel AI SDK renders it token-by-token in the UI.

## Backend and Data Layer

- **Backend:** Implemented as server-side logic within the Next.js framework, primarily using **API Routes**.
- **Database:** [PostgreSQL](https://www.postgresql.org/) hosted on [Supabase](https://supabase.com/).
- **Authentication:** Handled entirely by Supabase Auth, using the `@supabase/ssr` library to manage user sessions seamlessly across client and server components.
- **Security:** The database schema makes extensive use of PostgreSQL's **Row Level Security (RLS)** to ensure users can only access their own data. Policies are defined for all major tables.

## AI / Agentic Layer

- **Agent Framework:** The core logic is built on **Mastra** (`@mastra/core`), an open-source TypeScript framework for creating stateful, production-ready AI agents. It orchestrates the interaction between the LLM, the tools, and the application state.
- **LLM Provider:** The agent connects to Large Language Models via [OpenRouter](https://openrouter.ai/).
- **LLM Model:** The primary model in use is **`z-ai/glm-4.5`**. This is a powerful, modern Mixture-of-Experts (MoE) model from Z.ai, which was likely chosen for its strong performance in agentic tasks and tool use, as noted in its technical documentation.
- **Core Components:**
    - **IFS Agent (`ifs-agent.ts`):** The central agent responsible for processing user input.
    - **System Prompt (`ifs_agent_prompt.ts`):** A detailed set of instructions that defines the agent's personality, goals, and rules for tool use.
    - **Tools (`mastra/tools/`):** A suite of functions the agent can call to interact with the database. These are organized by function (`part-tools`, `assessment-tools`, `proposal-tools`, `evidence-tools`, `rollback-tools`).
    - **Action Logger (`lib/database/action-logger.ts`):** A critical service that logs all database mutations made by the agent, enabling the rollback/undo functionality.

## Deployment & Operations

- **Current Status:** The application is currently in a **local development phase**. It has not been deployed to a production environment.
- **Cron Jobs:** There is logic for a cron job to perform periodic updates to user memory (`app/api/cron/memory-update/route.ts`), but this is **not currently active or scheduled**. It will need to be configured with a service like Vercel Cron or a similar scheduler upon deployment.
