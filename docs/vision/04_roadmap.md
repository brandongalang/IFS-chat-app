# Product Roadmap & Strategy

This document outlines the strategic roadmap for Constellation, from the initial MVP to future expansion. The philosophy is to start with the riskiest assumptions, validate them in the simplest way possible, and then build outwards from a validated core.

## MVP Strategy: Ruthless Focus on the Core Loop

### Strategic Rationale

The single most critical question for Constellation is whether the core loop of **Journaling → AI Detection → Visualization** provides unique, transformative value. If this loop fails, no amount of additional features will save the product. Therefore, the MVP is designed with ruthless focus to answer this one question. We must validate that we can meaningfully reduce the cognitive load of self-discovery before we do anything else.

### MVP Scope: The Minimum Viable Loop

**INCLUDED (Must-haves to test the core loop):**
-   **Text-only chat interface:** The simplest possible way to get user thoughts into the system.
-   **Real-time part detection:** The core "magic" of the discovery loop.
-   **Parts Garden visualization:** The core of the "mapping" loop.
-   **Part profile pages:** A place to see AI hypotheses and for the user to confirm/reject them.
-   **Evidence linking:** Critical for the value proposition of transparency.
-   **Basic safety pause mechanisms:** An ethical necessity from day one.

**EXCLUDED (Features that add value but are not essential to the core loop):**
-   Daily check-ins and proactive nudges
-   Insight Cards with reveal mechanics
-   Voice input and narrative arcs
-   Predictive forecasting
-   Time-lapse visualization

### MVP Success Criteria

**Primary Validation Question:** *"Does the simple loop of journaling → part detection → garden visualization provide unique value and measurably reduce cognitive load?"*

-   **Validation Framework:**
    -   **Cohort:** 20-25 IFS-familiar beta users, 3-week trial.
    -   **Qualitative Metrics:** User interviews focused on clarity, cognitive load reduction, and perceived unique value.
    -   **Quantitative Signals:**
        -   **Pre/post NASA Task Load Index scores:** Target a 30% reduction in this standardized measure of cognitive effort.
        -   **Part detection accuracy:** Target >80% precision and >70% recall vs. user self-tags.
        -   **Garden engagement depth:** Target an average session time in the Garden of >90 seconds.
        -   **Hypothesis confirmation rate:** Target >70% user confirmation rate for core insights.

---

## Hypothesis Prioritization & Testing Framework

Our development is guided by a series of hypotheses, ordered by risk. We test the most foundational assumptions first.

### Tier 1: Existential Hypotheses (Test First)

*If these fail, the product likely has no future.*

1.  **The Identification Hypothesis (Highest Risk):**
    -   **Question:** Can our AI accurately detect IFS parts from natural language without overwhelming or annoying users?
    -   **Why it's first:** This is the core technical challenge. If we can't do this well, the rest of the product is irrelevant.
2.  **The Value Hypothesis (High Risk):**
    -   **Question:** Does visualizing the detected parts in a "garden" meaningfully reduce cognitive load and provide unique insight?
    -   **Why it's second:** Even if detection works, it's useless unless the visualization provides real value. This tests the core product promise.

### Tier 2: Growth Hypotheses (Test After MVP Validation)

*If these fail, we have a product, but it may not be a successful business.*

3.  **The Engagement Hypothesis:**
    -   **Question:** Do narrative elements and gamified insights (like "Insight Cards") drive long-term retention?
    -   **Why it's here:** This tests whether the product can become a sticky, long-term habit rather than a one-time novelty.
4.  **The Predictive Value Hypothesis:**
    -   **Question:** Does forecasting part activations (e.g., "Your Critic often appears before deadlines") create 10x value for the user?
    -   **Why it's here:** This tests whether we can build a true competitive moat based on predictive, personalized intelligence.

---

## Expansion Roadmap & Strategic Bets

### Phase 1: Engagement Enhancement (Months 2-4)

**Core Bet:** Narrative-driven insights will increase D30 retention by 2x.
-   **Rationale:** Once the core value is proven, the next step is to make the experience a delightful and regular habit. This phase is about building the features that encourage daily use.
-   **Implementation:** Insight Cards, part "story arcs," voice input, predictive nudges.
    -   **Dev note (2025-03-02):** The placeholder `useSpeechRecognition` hook has been removed because no UI consumed it. When we build real voice input, reintroduce a hook alongside the actual component workflow (e.g., wire it directly into the chat composer or future microphone controls) so the implementation is exercised end-to-end from day one.

### Phase 2: Intelligence Amplification (Months 4-8)

**Core Bet:** Predictive capabilities will create a defensible competitive moat.
-   **Rationale:** This is where we leverage our unique longitudinal data to provide value no competitor can match. We move from reactive mapping to proactive guidance.
-   **Implementation:** Pattern forecasting, relationship predictions, somatic integration (e.g., via wearables), time-lapse Garden visualization.

### Phase 3: Ecosystem Integration (Months 8-12)

**Core Bet:** Professional partnerships will create network effects and defensibility.
-   **Rationale:** By integrating with the professional IFS community, we create a powerful distribution channel and a flywheel effect where therapists and clients use the platform together.
-   **Implementation:** Therapist collaboration tools, practitioner certification programs, research partnerships, API for integration with other wellness platforms.

---

## Go-to-Market & Pricing

### Go-to-Market Strategy

The GTM strategy is designed to build credibility and momentum in stages.
1.  **IFS Community Seeding:** We will start with the people who already understand the value of IFS. Partnering with the IFS Institute and certified practitioners for a beta program provides instant credibility and a cohort of expert users.
2.  **Therapy-Adjacent Expansion:** Next, we target the much larger market of "therapy-curious" users through content marketing (blogs, social media) and referrals from our initial practitioner base.
3.  **High-Performer Positioning:** Finally, we position Constellation as an advanced self-awareness and performance tool for executives, knowledge workers, and other high-performers who are motivated by self-mastery.

### Pricing Framework (Vision)

-   **Freemium:** Basic part detection and a limited garden (e.g., 3 parts maximum) to let users experience the core loop.
-   **Premium ($19/month):** Unlimited parts, insight cards, data export, advanced features like voice input.
-   **Professional ($49/month):** For therapists and coaches, including client management dashboards, collaboration tools, and advanced analytics.
