'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { AlertTriangle, CheckCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { isDevMode } from '@/config/features'
import { useDevOnboardingFlow } from '@/hooks/useDevOnboardingFlow'

function DevModeGuard({ children }: { children: ReactNode }) {
  const [devEnabled, setDevEnabled] = useState(false)

  useEffect(() => {
    setDevEnabled(isDevMode())
  }, [])

  if (!devEnabled) {
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
    )
  }

  return <>{children}</>
}

export default function OnboardingFlowPage() {
  const {
    currentStage,
    currentQuestionIndex,
    currentQuestion,
    totalQuestions,
    questionContent,
    answers,
    isComplete,
    progress,
    totalStages,
    actions: { resetFlow, loadPreset },
  } = useDevOnboardingFlow()

  const answersCount = Object.keys(answers).length

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
                You&apos;ve successfully completed the onboarding flow.
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
                <Button onClick={() => (window.location.href = '/')} className="flex-1">
                  Continue to App
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DevModeGuard>
    )
  }

  return (
    <DevModeGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 p-4">
        <div className="max-w-2xl mx-auto mb-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Dev Mode Onboarding Flow</strong> - This simulates the real user experience for UAT testing.
            </AlertDescription>
          </Alert>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Stage {currentStage} of {totalStages}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-center space-x-2 mt-3">
            {Array.from({ length: totalStages }).map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${currentStage >= index + 1 ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Question {totalQuestions > 0 ? currentQuestionIndex + 1 : 0} of {totalQuestions}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQuestion ? (
                <>
                  <div>
                    <h2 className="text-lg font-medium mb-2">{currentQuestion.prompt}</h2>
                    {currentQuestion.helper && (
                      <p className="text-sm text-muted-foreground">{currentQuestion.helper}</p>
                    )}
                  </div>
                  {questionContent}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading question...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                Current answers: {answersCount} collected
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DevModeGuard>
  )
}
