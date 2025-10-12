# Grafana Cloud Observability Implementation Plan

## Overview

Implement OpenTelemetry tracing via Mastra's built-in telemetry, exporting to Grafana Cloud free tier for agent performance visibility.

**Goal:** Understand where time is spent during agent execution (LLM inference, tool calls, memory loading, streaming) to debug latency issues like large report processing.

---

## Current State

### What We Have

- **Session tracking** in Supabase (`sessions` table) - stores full conversation history, duration
- **Inbox observation telemetry** in Supabase (`inbox_observation_telemetry` table) - tool-level performance for inbox tools
- **Memory observability** - structured logs for snapshot cache hit/miss
- **Mastra PinoLogger** - basic structured logging

### What We're Missing

- ❌ Distributed tracing across agent execution
- ❌ Visibility into LLM inference time
- ❌ Tool call timing breakdown
- ❌ Request flow visualization
- ❌ Ability to debug "why was this slow?"

### Why Grafana Cloud?

- ✅ Free tier: 50GB logs, 10k series, 50GB traces/month
- ✅ No local infrastructure (vs Jaeger Docker container)
- ✅ Production-ready with retention
- ✅ Integrated dashboards and alerting
- ✅ OpenTelemetry native support

---

## Architecture