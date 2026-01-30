# Technical Decision: Mobile Architecture

## Status: Proposed

**Date**: 2025-12-27

## Decision: Use Expo (React Native) for Mobile Redesign

### Context

The IFS Therapy Companion needs to move from a mobile-first web app to a native iOS application. The goal is to improve UX (haptics, gestures, performance) and simplify workflows while maintaining the "Ethereal" aesthetic.

### Options Considered

1. **Swift (Native)**: Maximum performance, but requires a full rewrite and excludes Android.
2. **Flutter (Dart)**: Excellent animation engine, but requires rewriting shared TypeScript logic in Dart.
3. **Expo (React Native)**: High logic reuse (TS/JS), strong ecosystem for "Ethereal" animations, and cross-platform capability.

### Reasoning for Expo

- **Logic Continuity**: Reuses existing Zod schemas, Supabase clients, and Mastra agent patterns.
- **Developer Velocity**: Fast iteration with Expo Go and "Live Reload".
- **UX Capability**: `react-native-reanimated` and `expo-haptics` provide the "Physicality" and "Breathe & Flow" principles defined in the Product Spec.
- **Cost/Effort**: Lowest effort to achieve a high-quality prototype compared to a full language switch.

### Consequences

- **Positive**: Shared types between web and mobile; faster time to market for Android.
- **Negative**: Slight performance overhead compared to Swift (though negligible for a chat-based app).
- **Neutral**: Requires careful management of shared code via a monorepo structure or symlinks.
