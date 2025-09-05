import { 
  THEMES, 
  Theme, 
  ThemeScores, 
  QuestionResponse, 
  Stage1QuestionId 
} from './types';
import STAGE1_RESPONSE_VALUES from '../../config/onboarding-weights.json';
export { STAGE1_RESPONSE_VALUES };

// Utility function to check if a question ID is a Stage 1 question
export function isStage1Question(questionId: string): questionId is Stage1QuestionId {
  return questionId in STAGE1_RESPONSE_VALUES;
}

/**
 * Pre-computes the maximum possible score for each theme
 */
const MAX_THEME_SCORES = (() => {
  const maxScores: ThemeScores = Object.fromEntries(
    THEMES.map(theme => [theme, 0])
  ) as ThemeScores;

  // Sum the max possible contribution for each theme from each question
  for (const questionId in STAGE1_RESPONSE_VALUES) {
    const themeContributions: Record<Theme, number> = {} as Record<Theme, number>;

    const responseMapping = STAGE1_RESPONSE_VALUES[questionId as Stage1QuestionId];

    // Find the max weight for each theme in the current question's options
    for (const option in responseMapping) {
      const weights = responseMapping[option as keyof typeof responseMapping];
      for (const [theme, weight] of Object.entries(weights as Record<string, number>)) {
        if (THEMES.includes(theme as Theme)) {
          themeContributions[theme as Theme] = Math.max(
            themeContributions[theme as Theme] || 0,
            Number(weight)
          );
        }
      }
    }

    // Add the max contributions to the total max scores
    for (const [theme, maxWeight] of Object.entries(themeContributions)) {
      maxScores[theme as Theme] += maxWeight;
    }
  }

  return maxScores;
})();

/**
 * Computes theme scores from Stage 1 responses
 * Maps single-choice answers to weighted theme contributions
 */
export function computeStage1Scores(answersSnapshot: Record<string, QuestionResponse>): ThemeScores {
  // Initialize all themes to 0
  const scores: ThemeScores = Object.fromEntries(
    THEMES.map(theme => [theme, 0])
  ) as ThemeScores;

  // Process each Stage 1 response
  const stage1Questions = Object.keys(STAGE1_RESPONSE_VALUES) as Stage1QuestionId[];
  
  for (const questionId of stage1Questions) {
    const response = answersSnapshot[questionId];
    if (!response || response.type !== 'single_choice') continue;

    const responseMapping = STAGE1_RESPONSE_VALUES[questionId];
    const valueWeights = responseMapping[response.value as keyof typeof responseMapping];
    
    if (valueWeights) {
      // Add weighted contributions to theme scores
      for (const [theme, weight] of Object.entries(valueWeights as Record<string, number>)) {
        if (THEMES.includes(theme as Theme)) {
          scores[theme as Theme] += weight;
        }
      }
    }
  }

  // Calculate max possible scores dynamically
  const maxScores: ThemeScores = Object.fromEntries(
    THEMES.map(theme => [theme, 0])
  ) as ThemeScores;

  for (const questionId of stage1Questions) {
    const questionResponses = STAGE1_RESPONSE_VALUES[questionId];
    const themeMaxForQuestion: Partial<ThemeScores> = {};

    for (const responseKey in questionResponses) {
      const weights = questionResponses[responseKey as keyof typeof questionResponses];
      if (weights) {
        for (const [theme, weight] of Object.entries(weights as Record<string, number>)) {
          if (THEMES.includes(theme as Theme)) {
            themeMaxForQuestion[theme as Theme] = Math.max(themeMaxForQuestion[theme as Theme] || 0, weight);
          }
        }
      }
    }

    for (const [theme, maxWeight] of Object.entries(themeMaxForQuestion)) {
      if (maxWeight) {
        maxScores[theme as Theme] += maxWeight;
      }
    }
  }

  // Normalize scores to [0, 1] range
  for (const theme of THEMES) {
    const maxPossibleScore = maxScores[theme];
    if (maxPossibleScore > 0) {
      scores[theme] = Math.min(1, scores[theme] / maxPossibleScore);
    } else {
      scores[theme] = 0;
    }
  }

  return scores;
}

/**
 * Gets the top N themes by score, with minimum threshold
 */
export function getTopThemes(scores: ThemeScores, n: number = 5, minScore: number = 0.1): Theme[] {
  return THEMES
    .filter(theme => scores[theme] >= minScore)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, n);
}

/**
 * Computes a summary of theme scores for analytics or display
 */
export function summarizeScores(scores: ThemeScores): {
  top_themes: Theme[];
  total_activation: number;
  dominant_theme: Theme | null;
  theme_balance: 'focused' | 'balanced' | 'scattered';
} {
  const topThemes = getTopThemes(scores, 3);
  const totalActivation = THEMES.reduce((sum, theme) => sum + scores[theme], 0);
  const dominantTheme = topThemes[0] || null;
  
  // Determine balance pattern
  const topThreeScores = topThemes.map(theme => scores[theme]);
  let themeBalance: 'focused' | 'balanced' | 'scattered' = 'balanced';
  
  if (topThreeScores.length > 0) {
    const [first, second = 0, third = 0] = topThreeScores;
    
    if (first > 0.7 && second < 0.3) {
      themeBalance = 'focused'; // One dominant theme
    } else if (first < 0.5 && topThreeScores.length >= 3) {
      themeBalance = 'scattered'; // Many moderate themes
    }
  }

  return {
    top_themes: topThemes,
    total_activation: totalActivation,
    dominant_theme: dominantTheme,
    theme_balance: themeBalance,
  };
}

/**
 * Validates that we have sufficient Stage 1 responses for scoring
 */
export function hasCompleteStage1(answersSnapshot: Record<string, QuestionResponse>): boolean {
  const requiredQuestions = Object.keys(STAGE1_RESPONSE_VALUES) as Stage1QuestionId[];
  return requiredQuestions.every(qId => {
    const response = answersSnapshot[qId];
    return response && response.type === 'single_choice' && response.value;
  });
}

/**
 * Debug helper to log scoring details
 */
export function debugScoring(answersSnapshot: Record<string, QuestionResponse>): {
  responses: Record<string, string>;
  contributions: Record<string, Record<Theme, number>>;
  final_scores: ThemeScores;
  summary: ReturnType<typeof summarizeScores>;
} {
  const responses: Record<string, string> = {};
  const contributions: Record<string, Record<Theme, number>> = {};
  
  // Track contributions by question
  for (const questionId of Object.keys(STAGE1_RESPONSE_VALUES) as Stage1QuestionId[]) {
    const response = answersSnapshot[questionId];
    if (response && response.type === 'single_choice') {
      responses[questionId] = response.value;
      
      const responseMapping = STAGE1_RESPONSE_VALUES[questionId];
      const valueWeights = responseMapping[response.value as keyof typeof responseMapping];
      
      if (valueWeights) {
        contributions[questionId] = {} as Record<Theme, number>;
        for (const [theme, weight] of Object.entries(valueWeights as Record<string, number>)) {
          if (THEMES.includes(theme as Theme)) {
            contributions[questionId][theme as Theme] = weight;
          }
        }
      }
    }
  }

  const finalScores = computeStage1Scores(answersSnapshot);
  const summary = summarizeScores(finalScores);

  return {
    responses,
    contributions,
    final_scores: finalScores,
    summary,
  };
}
