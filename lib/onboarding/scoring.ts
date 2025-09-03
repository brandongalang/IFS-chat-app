import { 
  THEMES, 
  Theme, 
  ThemeScores, 
  QuestionResponse, 
  STAGE1_RESPONSE_VALUES,
  isStage1Question,
  Stage1QuestionId 
} from './types';

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
      for (const [theme, weight] of Object.entries(valueWeights)) {
        if (theme in scores) {
          scores[theme as Theme] += weight;
        }
      }
    }
  }

  // Normalize scores to [0, 1] range
  // Max possible score per theme is roughly 5 questions * max weight (~0.9)
  const maxPossibleScore = 4.5; // Conservative estimate
  
  for (const theme of THEMES) {
    scores[theme] = Math.min(1, scores[theme] / maxPossibleScore);
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
        contributions[questionId] = {};
        for (const [theme, weight] of Object.entries(valueWeights)) {
          if (theme in THEMES) {
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
