'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type Part = {
  id: string
  name: string
  visualization: {
    emoji: string
  }
}

type CheckInData = {
  type: 'morning' | 'evening'
  mood?: number
  energy_level?: number
  intention?: string
  reflection?: string
  gratitude?: string
  somatic_markers?: string[]
  parts_data?: {
    present_parts: string[]
    new_parts_observations: string
  }
}

export function CheckInForm() {
  const [step, setStep] = useState(1)
  const [parts, setParts] = useState<Part[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkInData, setCheckInData] = useState<CheckInData>({ type: new Date().getHours() < 12 ? 'morning' : 'evening' })
  const { toast } = useToast()

  useEffect(() => {
    async function fetchParts() {
      setIsLoading(true)
      try {
        const response = await fetch('/api/parts')
        if (!response.ok) throw new Error('Failed to fetch parts')
        const data = await response.json()
        setParts(data)
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Could not load your parts. Please try again later.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchParts()
  }, [toast])

  const handleSliderChange = (field: 'mood' | 'energy_level') => (value: number[]) => {
    setCheckInData(prev => ({ ...prev, [field]: value[0] }))
  }

  const handleTextChange = (field: keyof CheckInData) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCheckInData(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handlePartSelectionChange = (partId: string) => {
    const currentParts = checkInData.parts_data?.present_parts || []
    const newParts = currentParts.includes(partId)
      ? currentParts.filter(id => id !== partId)
      : [...currentParts, partId]
    setCheckInData(prev => ({ ...prev, parts_data: { ...prev.parts_data, present_parts: newParts } }))
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit check-in')
      }
      toast({ title: 'Success', description: 'Your check-in has been saved.' })
      setStep(step + 1) // Move to a "thank you" step
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => setStep(s => s + 1)
  const prevStep = () => setStep(s => s - 1)

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label>How are you feeling right now? (1 = Low, 5 = High)</Label>
              <Slider defaultValue={[3]} min={1} max={5} step={1} onValueChange={handleSliderChange('mood')} />
            </div>
            <div>
              <Label>What's your energy level? (1 = Low, 5 = High)</Label>
              <Slider defaultValue={[3]} min={1} max={5} step={1} onValueChange={handleSliderChange('energy_level')} />
            </div>
          </div>
        )
      case 2:
        return (
          <div>
            <Label>{checkInData.type === 'morning' ? 'What is your intention for the day?' : 'How did your day go?'}</Label>
            <Textarea
              value={checkInData.type === 'morning' ? checkInData.intention : checkInData.reflection}
              onChange={handleTextChange(checkInData.type === 'morning' ? 'intention' : 'reflection')}
              placeholder="Briefly describe..."
            />
          </div>
        )
      case 3:
        return (
          <div>
            <Label>Which parts are present for you right now?</Label>
            <div className="space-y-2 mt-2">
              {isLoading ? <p>Loading parts...</p> : parts.map(part => (
                <div key={part.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={part.id}
                    checked={checkInData.parts_data?.present_parts?.includes(part.id)}
                    onCheckedChange={() => handlePartSelectionChange(part.id)}
                  />
                  <Label htmlFor={part.id} className="flex items-center">
                    <span className="mr-2">{part.visualization.emoji}</span>
                    {part.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )
      case 4:
        return (
          <div>
            <Label>What are you grateful for today?</Label>
            <Textarea
              value={checkInData.gratitude}
              onChange={handleTextChange('gratitude')}
              placeholder="List one or two things..."
            />
          </div>
        )
      case 5:
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold">Thank You!</h2>
            <p>Your check-in is complete.</p>
          </div>
        )
      default:
        return <p>Unknown step</p>
    }
  }

  const totalSteps = 4

  return (
    <Card className="w-full my-8">
      <CardHeader>
        <CardTitle className="text-capitalize">{checkInData.type} Check-In</CardTitle>
        <CardDescription>A few moments to connect with yourself.</CardDescription>
      </CardHeader>
      <CardContent>
        {renderStep()}
      </CardContent>
      <CardFooter className="flex justify-between">
        {step <= totalSteps && (
          <Button onClick={prevStep} disabled={step === 1 || isLoading}>
            Previous
          </Button>
        )}
        {step < totalSteps && (
          <Button onClick={nextStep} disabled={isLoading}>
            Next
          </Button>
        )}
        {step === totalSteps && (
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Submit'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
