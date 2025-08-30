# Next Steps & Future Work

This document outlines features and improvements that were part of the initial design but have not yet been implemented. They are recorded here for future development cycles.

## 1. Implement the `potential_refinements` Table

- **Purpose:** To store AI-generated suggestions for "Part Refinements" that the user has denied.
- **Benefit:** This feature, described in the `SYSTEM_DESIGN.md`, would allow the AI to exhibit "Patient Persistence." It would prevent the AI from repeatedly suggesting ideas the user has already rejected and would allow it to re-evaluate the suggestions later if new, relevant information arises in conversation. This would make the AI feel more intelligent and context-aware.
- **Implementation:**
    - Create a new Supabase migration for the `potential_refinements` table with the schema defined in `SYSTEM_DESIGN.md`.
    - Update the API endpoint that handles insight feedback to populate this table when a user denies a part refinement suggestion.

## 2. Implement the Mock Insight Generator

- **Purpose:** To generate placeholder "Insight" cards for development and testing.
- **Benefit:** The `SYSTEM_DESIGN.md` envisioned a `mockInsightGenerator()` function to make it easier to test the Insights feature without relying on a live AI model. This would improve the developer workflow, speed up testing, and allow for frontend development to proceed independently of the AI backend.
- **Implementation:**
    - Create a `mockInsightGenerator()` function in a suitable location (e.g., `lib/dev/` or `scripts/`).
    - Integrate this function into the `GET /api/insights` endpoint, so that it is called to generate mock data when the application is running in development mode.
