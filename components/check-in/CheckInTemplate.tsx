'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import React from 'react'

export interface FormField {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  required?: boolean
}

interface CheckInTemplateProps {
  title: string
  description: string
  fields: FormField[]
  onSubmit: React.FormEventHandler<HTMLFormElement>
  isLoading: boolean
  submitText: string
  submitDisabled?: boolean
  error: string | null
  preFieldsContent?: React.ReactNode
  className?: string
}

export function CheckInTemplate({
  title,
  description,
  fields,
  onSubmit,
  isLoading,
  submitText,
  submitDisabled = false,
  error,
  preFieldsContent,
  className,
}: CheckInTemplateProps & Omit<React.ComponentPropsWithoutRef<'div'>, 'onSubmit'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              {preFieldsContent}
              {fields.map((field) => (
                <div className="grid gap-2" key={field.id}>
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    required={field.required}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </div>
              ))}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || submitDisabled}>
                {isLoading ? 'Saving...' : submitText}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
