---
title: Feature: Session Management API
owner: @brandongalang
status: shipped
last_updated: 2025-10-12
feature_flag: null
code_paths:
  - app/api/session/start/route.ts
  - app/api/session/end/route.ts
  - app/api/session/message/route.ts
  - lib/session-service.ts
related_prs:
  - #TBD
---

## What
API endpoints for managing chat sessions including starting, ending, and adding messages to sessions.

## Why
Provide session lifecycle management for the chat interface, ensuring proper tracking and storage of conversations.

## How it works
- **POST /api/session/start** - Creates a new chat session and returns sessionId
- **POST /api/session/end** - Marks a session as completed
- **POST /api/session/message** - Adds a message to an existing session
- Supports both authenticated users and development mode

## Data model
- `sessions` table for session metadata
- `messages` table for individual messages within sessions
- Proper user isolation and development mode support

## Configuration
- No feature flags required
- Works with Supabase authentication or development mode
- Uses session service for consistent session handling
