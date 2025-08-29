'use client'

import * as React from 'react'
import { InsightRow } from '@/lib/types/database'
import { InsightCard } from './InsightCard'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

// A skeleton component for the loading state
function InsightCarouselSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Carousel>
        <CarouselContent>
          <CarouselItem>
            <div className="p-1">
              <Card className="h-[450px] flex flex-col justify-between">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            </div>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious disabled />
        <CarouselNext disabled />
      </Carousel>
    </div>
  )
}

export function InsightCarousel() {
  const [insights, setInsights] = React.useState<InsightRow[]>([])
  const [status, setStatus] = React.useState<'loading' | 'error' | 'success' | 'empty'>('loading')
  const [error, setError] = React.useState<string | null>(null)

  const fetchInsights = React.useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/insights?limit=3')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Could not load insights.')
      }
      const body = await res.json()
      const data = body.data as InsightRow[]

      if (data && data.length > 0) {
        setInsights(data)
        setStatus('success')
      } else {
        setInsights([])
        setStatus('empty')
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('An unexpected error occurred.')
      }
      setStatus('error')
    }
  }, [])

  React.useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const handleActioned = (id: string) => {
    const newInsights = insights.filter((i) => i.id !== id)
    setInsights(newInsights)
    if (newInsights.length === 0) {
      setStatus('empty')
    }
  }

  if (status === 'loading') {
    return <InsightCarouselSkeleton />
  }

  if (status === 'error') {
    return (
      <div className="text-center p-8 border rounded-lg max-w-md mx-auto">
        <h3 className="text-xl font-semibold text-destructive">An Error Occurred</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button onClick={fetchInsights} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="text-center p-8 border rounded-lg max-w-md mx-auto">
        <h3 className="text-xl font-semibold">No New Insights</h3>
        <p className="text-muted-foreground mt-2">You&apos;re all caught up. Check back later for more.</p>
      </div>
    )
  }

  return (
    <Carousel className="w-full max-w-md mx-auto" opts={{ align: 'start' }}>
      <CarouselContent>
        {insights.map((insight) => (
          <CarouselItem key={insight.id}>
            <div className="p-1">
              <InsightCard insight={insight} onActioned={handleActioned} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  )
}
