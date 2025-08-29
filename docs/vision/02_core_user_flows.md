# Core User Flows: The Three-Loop Ecosystem

The Constellation user experience is designed as a self-reinforcing ecosystem of three core loops. Each loop serves a distinct user need but also feeds into the others, creating a virtuous cycle of discovery, understanding, and integration.

1.  **Discovery Loop:** The user expresses themselves, and the AI helps them identify the parts within that expression.
2.  **Mapping Loop:** The user visualizes their system of parts, and the AI helps them understand the relationships and dynamics between them.
3.  **Integration Loop:** The user receives synthesized insights about their system, and the AI suggests practices to foster harmony.

---

## Loop 1: Discovery Flow - The Core Engine

**Goal:** To make the process of identifying internal parts as frictionless as possible, turning natural journaling into a structured act of discovery without adding cognitive load.

**Trigger:** User opens the app and begins a natural language journaling session.

### User Journey

1.  **Natural Language Input:** The user writes freely and naturally, without needing to know anything about IFS.
    - *Example:* *"I'm feeling overwhelmed about this presentation. Part of me wants to nail it perfectly, but another part just wants to hide."*
2.  **Real-Time AI Detection:** As the user types, the AI detects language patterns that suggest the presence of internal parts. It highlights these potential parts inline with confidence indicators. This is the "magic" moment of the app.
3.  **Permission-Based Exploration:** The system offers gentle, non-intrusive prompts to explore the detected parts. The user is always in control.
    - *Example Prompt:* *"I notice a Perfectionist and an Exile here—want to explore?"*
4.  **Confirmation & Refinement:** The user can confirm or refine the AI's suggestions with simple taps or edits. This act of confirmation is a crucial step for user validation and model training.
5.  **Garden Population:** Confirmed parts instantly appear in the "Parts Garden" visualization, with evidence links that trace back to the specific text spans that triggered their discovery.

### Technical Implementation & Principles

The Discovery Engine is designed as a multi-stage pipeline to balance speed, accuracy, and cost.

```python
class DiscoveryEngine:
    """
    Processes user text to identify and validate potential IFS parts.
    The goal is to provide real-time feedback without being intrusive.
    """
    def process_input(self, user_text, context):
        # Stage 1: Lightweight, on-device pattern matching for speed.
        # This allows for instant highlighting of common phrases.
        candidates = self.detect_part_patterns(user_text)

        # Stage 2: Deeper LLM analysis for complex cases.
        # This is triggered if the initial detection is weak or ambiguous,
        # ensuring we catch nuanced expressions without high latency on every keystroke.
        if len(candidates) < 2 or confidence < 0.8:
            llm_analysis = self.llm_analyzer.process(user_text, context.existing_parts)
            candidates = self.merge_detections(candidates, llm_analysis)

        # Stage 3: Safety and confidence filtering.
        # Ensures we don't surface low-confidence suggestions or
        # suggestions that might be harmful, based on the user's current state.
        return self.safety_filter.validate(candidates, context.user_state)
```

---

## Loop 2: Mapping Flow - The Living Garden

**Goal:** To transform the abstract concept of a "psychological system" into a tangible, interactive map, reducing cognitive overwhelm and revealing systemic patterns at a glance.

**Trigger:** User navigates to the "Parts Garden" visualization.

### User Journey

1.  **Dynamic Visualization:** The user sees their parts as nodes in a dynamic, physics-based graph. The relationships and polarizations between parts are visualized as forces (e.g., pushing or pulling).
2.  **AI-Powered Insights:** The user taps on a part to see AI-generated hypotheses about its role, burdens, and protective functions, complete with confidence scores and links back to the evidence.
3.  **User Validation:** Using simple confirmation sliders or edits, the user validates, refines, or rejects the AI's insights. This feedback is the primary mechanism for training the user's personal model.
4.  **Model Update:** The system's internal model of the user's psyche is updated in real-time based on this feedback, creating "override chains" that prioritize user wisdom over AI suggestions.
5.  **Garden Evolution:** The visualization instantly reflects the confirmed changes, showing how relationships and polarizations shift as the user gains clarity.

### Key UX Innovations

-   **Complexity Dial:** A slider that allows the user to control the level of detail, from a "Beginner Mode" showing only major parts and polarizations to an "Advanced Mode" showing the full, complex web of relationships.
-   **Evidence Transparency:** Every AI hypothesis is linked directly to the specific text spans that triggered it, building trust and allowing the user to audit the AI's reasoning.
-   **Confidence Visualization:** Newly detected parts appear translucent or have a "shimmering" effect until they are confirmed by the user, visually separating AI suggestions from user-validated truth.
-   **Focus Mode:** Allows the user to isolate one part and its immediate relationships, preventing the cognitive overwhelm that can come from viewing the entire system at once.

---

## Loop 3: Integration Flow - Insight Synthesis

**Goal:** To proactively surface meaningful, high-level patterns from the user's history, turning raw data into actionable insights that can guide healing and integration work.

**Trigger:** Daily or weekly notification of new available insights (this is a post-MVP feature).

### User Journey

1.  **Notification:** The user receives a notification: *"New insights are ready for you (3 cards)."*
2.  **Insight Reveal:** The user opens the app to find a series of "Insight Cards." Each card presents a synthesized pattern discovered by the AI.
    - *Example Card:* *"Your Critic appears most often on Sunday evenings when you are thinking about the upcoming work week."*
3.  **Validation:** The user validates the insight with a simple slider ("How true does this feel?"). This feedback trains the AI's pattern-recognition capabilities.
4.  **Suggested Practice:** Based on the validated insight, the system suggests a relevant integration practice or a guided dialogue between the involved parts.
5.  **Model Adjustment:** The AI adjusts its future hypothesis generation based on the validation feedback, getting smarter about what kinds of patterns are most relevant to the user.
