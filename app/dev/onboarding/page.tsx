'use client';

import { useState, useEffect } from 'react';
import { isDevMode } from '@/config/features';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { computeStage1Scores } from '@/lib/onboarding/scoring';
import { selectStage2Questions, validateStage2Selection } from '@/lib/onboarding/selector';
import { 
  ANSWER_PRESETS, 
  DEV_STAGE_2_QUESTION_BANK, 
  type PresetKey
} from '@/lib/dev/fixtures';
import type { OnboardingQuestion, QuestionResponse, ThemeScores } from '@/lib/onboarding/types';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

// Dev mode guard
function DevModeGuard({ children }: { children: React.ReactNode }) {
    const [devEnabled, setDevEnabled] = useState(false);

    useEffect(() => {
      // Check if we're in dev mode using centralized helper
      setDevEnabled(isDevMode());
    }, []);

    if (!devEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This development tool is only available in development mode.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Set <code>NEXT_PUBLIC_IFS_DEV_MODE=true</code> to access.
              </p>
          </CardContent>
        </Card>
      </div>
    );
  }

    return <>{children}</>;
  }

type Stage2Results = {
  selection: { ids: string[]; rationale: { top_themes: string[] } & Record<string, unknown> };
  validation: { valid: boolean; coverage_score?: number; issues?: string[] };
  questionBank: OnboardingQuestion[];
}

export default function OnboardingDevPage() {
  // State management
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('perfectionism_anxiety');
  const [customAnswers, setCustomAnswers] = useState<Record<string, QuestionResponse>>({});
  const [stage1Scores, setStage1Scores] = useState<ThemeScores | null>(null);
  const [stage2Results, setStage2Results] = useState<Stage2Results | null>(null);
  const [useLiveData, setUseLiveData] = useState(false);
  const [liveQuestions, setLiveQuestions] = useState<OnboardingQuestion[]>([]);

  const currentAnswers = selectedPreset === 'custom' 
    ? customAnswers 
    : ANSWER_PRESETS[selectedPreset].answers;

  // Fetch live data when toggled
  useEffect(() => {
    if (useLiveData) {
      fetchLiveQuestions();
    }
  }, [useLiveData]);

  const fetchLiveQuestions = async () => {
    try {
      const response = await fetch('/api/onboarding/questions?stage=2');
      if (response.ok) {
        const data = await response.json();
        setLiveQuestions(data.questions || []);
      } else {
        console.warn('Failed to fetch live questions, falling back to fixtures');
        setLiveQuestions([]);
      }
    } catch (error) {
      console.warn('Error fetching live questions:', error);
      setLiveQuestions([]);
    }
  };

  const computeScores = () => {
    try {
      const scores = computeStage1Scores(currentAnswers);
      setStage1Scores(scores);
      setStage2Results(null); // Clear stage 2 when stage 1 changes
    } catch (error) {
      console.error('Error computing scores:', error);
      alert('Error computing scores. Check console for details.');
    }
  };

  const runStage2Selection = () => {
    if (!stage1Scores) {
      alert('Please compute Stage 1 scores first');
      return;
    }

    try {
      const questionBank = useLiveData && liveQuestions.length >= 4 
        ? liveQuestions 
        : DEV_STAGE_2_QUESTION_BANK;
      
      if (questionBank.length < 4) {
        alert('Insufficient questions in bank (need at least 4)');
        return;
      }

      const selection = selectStage2Questions(stage1Scores, questionBank);
      const validation = validateStage2Selection(selection.ids, questionBank, stage1Scores);
      
      setStage2Results({
        selection,
        validation,
        questionBank: questionBank.filter(q => selection.ids.includes(q.id))
      });
    } catch (error) {
      console.error('Error in Stage 2 selection:', error);
      alert('Error in Stage 2 selection. Check console for details.');
    }
  };

  const resetAll = () => {
    setStage1Scores(null);
    setStage2Results(null);
    setCustomAnswers({});
  };

  const getScoreValidation = (scores: ThemeScores) => {
    const issues = [];
    const values = Object.values(scores);
    
    if (values.some(v => v < 0 || v > 1)) {
      issues.push('Some scores are outside [0,1] range');
    }
    
    const hasActivation = ['perfectionism', 'anxiety', 'self_criticism'].some(
      theme => scores[theme as keyof ThemeScores] > 0
    );
    
    if (!hasActivation) {
      issues.push('Expected themes (perfectionism, anxiety, self_criticism) not activated');
    }

    return issues;
  };

  return (
    <DevModeGuard>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Onboarding Dev Playground</h1>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Development Mode Only</strong> - This tool is for UAT testing the onboarding flow without authentication hassles.
            </AlertDescription>
          </Alert>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="live-data" 
                checked={useLiveData} 
                onCheckedChange={setUseLiveData}
                disabled={false} // Could disable if no DB connection
              />
              <Label htmlFor="live-data">
                Use Live Database ({useLiveData ? 'ON' : 'OFF'})
              </Label>
              {useLiveData && (
                <Badge variant={liveQuestions.length > 0 ? 'default' : 'destructive'}>
                  {liveQuestions.length > 0 ? `${liveQuestions.length} questions loaded` : 'No live data'}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label>Answer Preset</Label>
              <Select 
                value={selectedPreset} 
                onValueChange={(value) => setSelectedPreset(value as PresetKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANSWER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.name} - {preset.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2">
              <Button onClick={computeScores} variant="default">
                Compute Stage 1 Scores
              </Button>
              <Button 
                onClick={runStage2Selection} 
                variant="secondary"
                disabled={!stage1Scores}
              >
                Run Stage 2 Selection
              </Button>
              <Button onClick={resetAll} variant="outline">
                Reset All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Tabs defaultValue="stage1" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stage1">Stage 1 Results</TabsTrigger>
            <TabsTrigger value="stage2" disabled={!stage2Results}>Stage 2 Results</TabsTrigger>
          </TabsList>

          <TabsContent value="stage1" className="space-y-4">
            {/* Current Answers */}
            <Card>
              <CardHeader>
                <CardTitle>Current Answers ({Object.keys(currentAnswers).length})</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(currentAnswers, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Stage 1 Scores */}
            {stage1Scores && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span>Stage 1 Scores</span>
                    {getScoreValidation(stage1Scores).length === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getScoreValidation(stage1Scores).length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {getScoreValidation(stage1Scores).map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(stage1Scores).map(([theme, score]) => (
                      <div key={theme} className="space-y-1">
                        <div className="text-sm font-medium">{theme.replace('_', ' ')}</div>
                        <div className="text-2xl font-bold">
                          {score.toFixed(3)}
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${Math.min(score * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      View Raw JSON
                    </summary>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto mt-2">
                      {JSON.stringify(stage1Scores, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stage2" className="space-y-4">
            {stage2Results && (
              <>
                {/* Stage 2 Selection Results */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <span>Stage 2 Selection</span>
                      {stage2Results.validation?.valid ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold">Selected Question IDs</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {stage2Results.selection.ids.map((id: string) => (
                            <Badge key={id} variant="outline">{id}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Top Themes</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(stage2Results.selection.rationale.top_themes ?? []).map((theme: string) => (
                            <Badge key={theme} variant="default">{theme}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Validation Results */}
                    <div className="space-y-2">
                      <h4 className="font-semibold">Validation</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Valid: </span>
                          <span className={stage2Results.validation.valid ? 'text-green-600' : 'text-red-600'}>
                            {stage2Results.validation.valid ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Coverage Score: </span>
                          <span>{stage2Results.validation.coverage_score?.toFixed(3) || 'N/A'}</span>
                        </div>
                      </div>
                      
                      {(stage2Results.validation.issues ?? []).length > 0 && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            <ul className="list-disc list-inside">
                              {(stage2Results.validation.issues ?? []).map((issue: string, i: number) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        View Selection Details
                      </summary>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto mt-2">
                        {JSON.stringify(stage2Results.selection, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>

                {/* Selected Questions Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Questions Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {stage2Results.questionBank?.map((question: OnboardingQuestion, index: number) => (
                      <div key={question.id} className="border rounded p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <h5 className="font-medium">
                            {index + 1}. {question.prompt}
                          </h5>
                          <Badge variant="outline">{question.id}</Badge>
                        </div>
                        {question.helper && (
                          <p className="text-sm text-muted-foreground italic">
                            {question.helper}
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-1 text-sm">
                          {question.options?.map((option) => (
                            <div key={option.value} className="pl-4">
                              • {option.label}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Theme weights: {JSON.stringify(question.theme_weights)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DevModeGuard>
  );
}
