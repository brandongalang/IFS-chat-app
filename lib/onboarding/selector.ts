import { 
  OnboardingQuestion, 
  ThemeScores, 
  Stage2SelectionResult,
  getQuestionsByStage,
  Theme,
  THEMES
} from './types';
import { getTopThemes } from './scoring';

/**
 * Selects 4 Stage 2 questions based on Stage 1 theme scores
 * Uses a weighted scoring algorithm with diversity constraints
 */
export function selectStage2Questions(
  stage1Scores: ThemeScores, 
  questionBank: OnboardingQuestion[]
): Stage2SelectionResult {
  const stage2Questions = getQuestionsByStage(questionBank, 2);
  
  if (stage2Questions.length < 4) {
    throw new Error(`Insufficient Stage 2 questions in bank: ${stage2Questions.length}, need at least 4`);
  }

  // Score each question based on theme alignment
  const questionScores = stage2Questions.map(question => {
    const score = computeQuestionScore(question, stage1Scores);
    return { question, score };
  });

  // Sort by score descending
  questionScores.sort((a, b) => b.score - a.score);

  // Select top 4 with diversity constraints
  const selected = selectWithDiversity(questionScores, stage1Scores);
  
  // Generate selection rationale
  const topThemes = getTopThemes(stage1Scores, 5);
  const themeCoverage = computeThemeCoverage(selected, stage1Scores);
  
  return {
    ids: selected.map(item => item.question.id),
    rationale: {
      top_themes: topThemes,
      theme_coverage: themeCoverage,
      selection_method: 'weighted_with_diversity',
    },
  };
}

/**
 * Computes relevance score for a question based on user's theme scores
 */
function computeQuestionScore(question: OnboardingQuestion, userScores: ThemeScores): number {
  let totalScore = 0;
  let totalWeights = 0;

  // Compute dot product of question theme weights and user scores
  for (const [theme, weight] of Object.entries(question.theme_weights)) {
    if (theme in userScores) {
      const userScore = userScores[theme as Theme];
      totalScore += weight * userScore;
      totalWeights += weight;
    }
  }

  // Normalize by total weights to handle questions with different numbers of themes
  return totalWeights > 0 ? totalScore / totalWeights : 0;
}

/**
 * Selects questions with diversity constraints to ensure good theme coverage
 */
function selectWithDiversity(
  questionScores: Array<{ question: OnboardingQuestion; score: number }>,
  userScores: ThemeScores
): Array<{ question: OnboardingQuestion; score: number }> {
  const selected: typeof questionScores = [];
  const usedThemes = new Set<Theme>();
  const topThemes = getTopThemes(userScores, 3);

  // Constraint: ensure at least 2 of top 3 themes are represented
  let topThemesRepresented = 0;
  const targetTopThemes = Math.min(2, topThemes.length);

  for (const item of questionScores) {
    if (selected.length >= 4) break;

    const questionThemes = getQuestionThemes(item.question);
    const dominantTheme = getDominantTheme(item.question);
    
    // Diversity constraints
    const tooManyFromSameTheme = dominantTheme && 
      selected.filter(s => getDominantTheme(s.question) === dominantTheme).length >= 2;
    
    const needsTopThemeRepresentation = topThemesRepresented < targetTopThemes && 
      !questionThemes.some(theme => topThemes.includes(theme));

    // Skip if violates constraints
    if (tooManyFromSameTheme) continue;
    if (selected.length >= 2 && needsTopThemeRepresentation) continue;

    // Select this question
    selected.push(item);
    
    // Track theme usage
    questionThemes.forEach(theme => usedThemes.add(theme));
    
    // Track top theme representation
    if (questionThemes.some(theme => topThemes.includes(theme))) {
      topThemesRepresented++;
    }
  }

  // If we don't have 4 yet, fill remaining slots with best available
  while (selected.length < 4 && selected.length < questionScores.length) {
    const remaining = questionScores.filter(item => 
      !selected.some(s => s.question.id === item.question.id)
    );
    
    if (remaining.length > 0) {
      selected.push(remaining[0]); // Best remaining score
    }
  }

  return selected.slice(0, 4); // Ensure exactly 4
}

/**
 * Gets all themes associated with a question (those with weight > 0)
 */
function getQuestionThemes(question: OnboardingQuestion): Theme[] {
  return Object.entries(question.theme_weights)
    .filter(([_, weight]) => weight > 0)
    .map(([theme, _]) => theme as Theme);
}

/**
 * Gets the dominant theme for a question (highest weight)
 */
function getDominantTheme(question: OnboardingQuestion): Theme | null {
  let maxWeight = 0;
  let dominantTheme: Theme | null = null;

  for (const [theme, weight] of Object.entries(question.theme_weights)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      dominantTheme = theme as Theme;
    }
  }

  return dominantTheme;
}

/**
 * Computes theme coverage analysis for selected questions
 */
function computeThemeCoverage(
  selected: Array<{ question: OnboardingQuestion; score: number }>,
  userScores: ThemeScores
): Record<string, number> {
  const coverage: Record<string, number> = {};
  
  // Initialize all themes to 0
  for (const theme of THEMES) {
    coverage[theme] = 0;
  }
  
  // Sum coverage from selected questions, weighted by user scores
  for (const item of selected) {
    for (const [theme, weight] of Object.entries(item.question.theme_weights)) {
      if (theme in coverage && theme in userScores) {
        coverage[theme] += weight * userScores[theme as Theme];
      }
    }
  }
  
  return coverage;
}

/**
 * Validates a Stage 2 selection meets basic criteria
 */
export function validateStage2Selection(
  selectedIds: string[],
  questionBank: OnboardingQuestion[],
  userScores: ThemeScores
): {
  valid: boolean;
  issues: string[];
  coverage_score: number;
} {
  const issues: string[] = [];
  
  // Basic count check
  if (selectedIds.length !== 4) {
    issues.push(`Expected 4 questions, got ${selectedIds.length}`);
  }
  
  // Check all questions exist and are Stage 2
  const questions = selectedIds.map(id => 
    questionBank.find(q => q.id === id && q.stage === 2)
  );
  
  const missingQuestions = questions.filter(q => !q).length;
  if (missingQuestions > 0) {
    issues.push(`${missingQuestions} questions not found in Stage 2 bank`);
  }
  
  const validQuestions = questions.filter(q => q) as OnboardingQuestion[];
  
  // Compute coverage score (how well selection matches user's top themes)
  const topThemes = getTopThemes(userScores, 3);
  let coverageScore = 0;
  
  for (const question of validQuestions) {
    const questionThemes = getQuestionThemes(question);
    const topThemeMatches = questionThemes.filter(theme => topThemes.includes(theme)).length;
    coverageScore += topThemeMatches;
  }
  
  // Normalize coverage score (max possible is 4 questions * 3 top themes = 12)
  coverageScore = Math.min(1, coverageScore / 4);
  
  return {
    valid: issues.length === 0,
    issues,
    coverage_score: coverageScore,
  };
}

/**
 * Generates a deterministic selection with a seed for testing
 */
export function selectStage2QuestionsDeterministic(
  stage1Scores: ThemeScores,
  questionBank: OnboardingQuestion[],
  seed: number = 42
): Stage2SelectionResult {
  // Use seed to make order_hint based tiebreaking deterministic
  const seededQuestions = getQuestionsByStage(questionBank, 2)
    .map(q => ({ ...q, order_hint: q.order_hint + (seed % 100) * 0.01 }));
  
  return selectStage2Questions(stage1Scores, seededQuestions);
}
