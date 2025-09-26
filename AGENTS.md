# Agent Guidelines

- Prefer GitHub CLI (`gh`) for creating and updating pull requests from this repository.
- Document any deviations from standard workflows in this file so future agents stay aligned.
- Mastra tool modules now export factory helpers (e.g., `createAssessmentTools`) that require passing the server-derived user ID; inject the profile's user ID when wiring agents.
