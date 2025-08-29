export type TestPersona = 'beginner' | 'moderate' | 'advanced'

export interface TestPersonaConfig {
  id: string
  name: string
  email: string
  description: string
}

export const TEST_PERSONAS: Record<TestPersona, TestPersonaConfig> = {
  beginner: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alex Beginner',
    email: 'alex.beginner@ifsdev.local',
    description: 'New to IFS (14 days), 3-5 sessions, discovering first parts'
  },
  moderate: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Jamie Moderate',
    email: 'jamie.moderate@ifsdev.local',
    description: 'Regular user (90 days), 10-14 sessions, active part relationships'
  },
  advanced: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Riley Advanced',
    email: 'riley.advanced@ifsdev.local',
    description: 'Power user (180+ days), 20+ sessions, complex part ecosystem'
  }
}

export function getPersonaUserId(persona: TestPersona): string {
  return TEST_PERSONAS[persona].id
}

export function getCurrentPersona(): TestPersona {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('ifs-test-persona')
    if (stored && ['beginner','moderate','advanced'].includes(stored)) {
      return stored as TestPersona
    }
  }
  // Fallback to env default resolved in dev config
  const envDefault =
    (process as any).env?.IFS_TEST_PERSONA ||
    (process as any).env?.NEXT_PUBLIC_IFS_TEST_PERSONA ||
    (process as any).env?.VITE_IFS_TEST_PERSONA ||
    'beginner'
  return ['beginner','moderate','advanced'].includes(envDefault) ? (envDefault as TestPersona) : 'beginner'
}

export function setCurrentPersona(persona: TestPersona): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ifs-test-persona', persona)
  }
}
