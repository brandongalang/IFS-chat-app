'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { OnboardingQuestion, QuestionResponse } from '@/lib/onboarding/types';
import { DEV_STAGE_2_QUESTION_BANK, ANSWER_PRESETS } from '@/lib/dev/fixtures';
import { AlertTriangle, CheckCircle } from 'lucide-react';

// Dev mode guard
function DevModeGuard({ children }: { children: React.ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const devMode = process.env.NODE_ENV === 'development' || 
                    process.env.NEXT_PUBLIC_IFS_DEV_MODE === 'true';
    setIsDevMode(devMode);
  }, []);

  if (!isDevMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This development tool is only available in development mode.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Mock Stage 1 questions (using the actual structure)
const STAGE_1_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'S1_Q1',
    stage: 1,
    type: 'single_choice',
    prompt: 'When you share your work publicly, what typically comes up for you first?',
    helper: 'Think about the immediate feelings or thoughts that arise',
    options: [
      { value: 'surge_energy', label: 'A surge of energy and excitement about reaching people' },
      { value: 'methodical_checking', label: 'Methodical checking and rechecking before posting' },
      { value: 'wondering_reception', label: 'Wondering how it will be received by others' },
      { value: 'noticing_improvement', label: 'Noticing everything that could be improved' },
    ],
    active: true,
    locale: 'en',
    order_hint: 1,
    theme_weights: {},
  },
  {
    id: 'S1_Q2', 
    stage: 1,
    type: 'single_choice',
    prompt: 'When your plans get disrupted unexpectedly, what happens inside you?',
    helper: 'Consider your inner response to sudden changes',
    options: [
      { value: 'energized_possibilities', label: 'I feel energized by new possibilities opening up' },
      { value: 'protect_secure', label: 'I need to protect what feels secure and familiar' },
      { value: 'check_affected', label: 'I check on others who might be affected by the change' },
      { value: 'analyze_wrong', label: 'I analyze what went wrong and how to prevent it next time' },
    ],
    active: true,
    locale: 'en',
    order_hint: 2,
    theme_weights: {},
  },
  {
    id: 'S1_Q3',
    stage: 1,
    type: 'single_choice', 
    prompt: 'When someone you care about seems upset with you, what do you find yourself doing?',
    helper: 'Think about your automatic response pattern',
    options: [
      { value: 'give_space', label: 'Give them space and wait for them to come to me' },
      { value: 'directly_ask', label: 'Ask directly what\'s wrong and how to fix it' },
      { value: 'review_actions', label: 'Review all my recent actions to see what I might have done' },
      { value: 'focus_elsewhere', label: 'Focus my attention elsewhere until things settle' },
    ],
    active: true,
    locale: 'en',
    order_hint: 3,
    theme_weights: {},
  },
];

// Stage 3 questions with free text responses
const STAGE_3_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'S3_Q1',
    stage: 3,
    type: 'free_text',
    prompt: 'When you think about the parts of yourself that get activated under stress, what do you notice they are trying to protect you from?',
    helper: 'Take a moment to reflect on what your protective parts are guarding against',
    options: [],
    active: true,
    locale: 'en',
    order_hint: 1,
    theme_weights: {},
  },
  {
    id: 'S3_Q2',
    stage: 3,
    type: 'free_text',
    prompt: 'What beliefs do you carry about yourself that might have formed during difficult times in your life?',
    helper: 'These might be thoughts like "I\'m not good enough" or "I have to be perfect"',
    options: [],
    active: true,
    locale: 'en',
    order_hint: 2,
    theme_weights: {},
  },
  {
    id: 'S3_Q3',
    stage: 3,
    type: 'free_text',
    prompt: 'Where in your body do you tend to feel stress, tension, or difficult emotions?',
    helper: 'This could be your shoulders, stomach, chest, or anywhere else you notice sensations',
    options: [],
    active: true,
    locale: 'en',
    order_hint: 3,
    theme_weights: {},
  },
  {
    id: 'S3_Q4',
    stage: 3,
    type: 'free_text',
    prompt: 'If you could offer a compassionate message to the parts of yourself that struggle, what would you say?',
    helper: 'Imagine speaking to these parts like you would to a good friend who is going through a hard time',
    options: [],
    active: true,
    locale: 'en',
    order_hint: 4,
    theme_weights: {},
  },
];

export default function OnboardingFlowPage() {
  const [currentStage, setCurrentStage] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({});
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Initialize questions based on stage
  useEffect(() => {
    if (currentStage === 1) {
      setQuestions(STAGE_1_QUESTIONS);
      setCurrentQuestionIndex(0);
    } else if (currentStage === 2) {
      // Use fixture data for Stage 2 
      setQuestions(DEV_STAGE_2_QUESTION_BANK.slice(0, 4));
      setCurrentQuestionIndex(0);
    } else if (currentStage === 3) {
      // Stage 3 with free text questions
      setQuestions(STAGE_3_QUESTIONS);
      setCurrentQuestionIndex(0);
    }
  }, [currentStage]);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  
  // Progress calculation: 3 Stage 1 + 4 Stage 2 + 4 Stage 3 = 11 total
  const totalQuestionCount = 11;
  let completedQuestions = 0;
  
  if (currentStage === 1) {
    completedQuestions = currentQuestionIndex;
  } else if (currentStage === 2) {
    completedQuestions = 3 + currentQuestionIndex;
  } else if (currentStage === 3) {
    completedQuestions = 7 + currentQuestionIndex;
  }
  
  const progress = (completedQuestions / totalQuestionCount) * 100;

  const handleAnswer = (response: QuestionResponse) => {
    if (!currentQuestion) return;

    const newAnswers = {
      ...answers,
      [currentQuestion.id]: response,
    };
    setAnswers(newAnswers);

    // Auto-advance to next question
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else if (currentStage === 1) {
        // Move to Stage 2
        setCurrentStage(2);
      } else if (currentStage === 2) {
        // Move to Stage 3
        setCurrentStage(3);
      } else {
        // Complete onboarding
        setIsComplete(true);
      }
    }, 500); // Small delay for UX
  };

  const handleSingleChoice = (value: string) => {
    handleAnswer({
      type: 'single_choice',
      value,
    });
  };

  const handleTextResponse = (text: string) => {
    if (text.trim().length === 0) return;
    
    handleAnswer({
      type: 'free_text', 
      text: text.trim(),
    });
  };

  const resetFlow = () => {
    setCurrentStage(1);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsComplete(false);
  };

  const loadPreset = (presetKey: string) => {
    const preset = ANSWER_PRESETS[presetKey as keyof typeof ANSWER_PRESETS];
    if (preset) {
      setAnswers(preset.answers);
      setCurrentStage(2);
      setCurrentQuestionIndex(0);
    }
  };

  if (isComplete) {
    return (
      <DevModeGuard>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle>Onboarding Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">
                You've successfully completed the onboarding flow.
              </p>
              <div className="text-xs bg-muted p-3 rounded">
                <strong>Answers collected:</strong>
                <pre className="mt-2 whitespace-pre-wrap">
                  {JSON.stringify(answers, null, 2)}
                </pre>
              </div>
              <div className="flex gap-2">
                <Button onClick={resetFlow} variant="outline" className="flex-1">
                  Start Over
                </Button>
                <Button onClick={() => window.location.href = '/'} className="flex-1">
                  Continue to App
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DevModeGuard>
    );
  }

  return (
    <DevModeGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 p-4">
        {/* Header */}
        <div className="max-w-2xl mx-auto mb-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Dev Mode Onboarding Flow</strong> - This simulates the real user experience for UAT testing.
            </AlertDescription>
          </Alert>
        </div>

        {/* Progress */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Stage {currentStage} of 3</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-center space-x-2 mt-3">
            <div className={`w-3 h-3 rounded-full ${currentStage >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full ${currentStage >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full ${currentStage >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </div>

        {/* Question Card */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQuestion ? (
                <>
                  <div>
                    <h2 className="text-lg font-medium mb-2">
                      {currentQuestion.prompt}
                    </h2>
                    {currentQuestion.helper && (
                      <p className="text-sm text-muted-foreground">
                        {currentQuestion.helper}
                      </p>
                    )}
                  </div>

                  {/* Single Choice Questions */}
                  {currentQuestion.type === 'single_choice' && (
                    <RadioGroup
                      onValueChange={handleSingleChoice}
                      value={answers[currentQuestion.id]?.type === 'single_choice' ? answers[currentQuestion.id].value : ''}
                    >
                      <div className="space-y-3">
                        {currentQuestion.options.map((option) => (
                          <div key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value={option.value} id={option.value} />
                            <Label htmlFor={option.value} className="cursor-pointer flex-1 leading-relaxed">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}

                  {/* Free Text Questions */}
                  {currentQuestion.type === 'free_text' && (
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Take your time to reflect and share your thoughts..."
                        className="min-h-40 text-base leading-relaxed"
                        defaultValue={answers[currentQuestion.id]?.type === 'free_text' ? answers[currentQuestion.id].text : ''}
                        id={`textarea-${currentQuestion.id}`}
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">
                          Take as much time as you need. There are no right or wrong answers.
                        </p>
                        <Button
                          onClick={() => {
                            const textarea = document.getElementById(`textarea-${currentQuestion.id}`) as HTMLTextAreaElement;
                            if (textarea?.value.trim()) {
                              handleTextResponse(textarea.value);
                            }
                          }}
                          className="ml-4"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading question...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dev Controls */}
        <div className="max-w-2xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dev Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={resetFlow}>
                  Reset Flow
                </Button>
                <Button size="sm" variant="outline" onClick={() => loadPreset('perfectionism_anxiety')}>
                  Load Preset: Perfectionism
                </Button>
                <Button size="sm" variant="outline" onClick={() => loadPreset('relational_caretaking')}>
                  Load Preset: Relational
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Current answers: {Object.keys(answers).length} collected
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DevModeGuard>
  );
}
