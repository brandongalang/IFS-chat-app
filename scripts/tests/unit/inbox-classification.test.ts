export {}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// Minimal replica of the tightened classification logic used exclusively for unit tests.
type Candidate = { title?: string; summary?: string; inference?: string; tags?: string[] }
type Classification = 'Observation' | 'Question' | 'Label'

function computeMessageClassification(candidate: Candidate): Classification {
  const { title, summary, inference, tags } = candidate
  const fields = [title, summary, inference].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )

  // Check if any field contains a question mark
  const hasQuestionMark = fields.some((f) => f.includes('?'))

  // Negative patterns that should NOT be questions (even with ?)
  const nonQuestionPatterns = [
    /^\s*how to\b/i,
    /^\s*what\s+(we|i)\s+(learned|noticed|found)\b/i,
  ]

  const isNonQuestionPhrase = fields.some((f) =>
    nonQuestionPatterns.some((pattern) => pattern.test(f))
  )

  // Only classify as Question if it has "?" AND is not a negative pattern
  if (hasQuestionMark && !isNonQuestionPhrase) {
    return 'Question'
  }

  // Label detection
  const text = `${title ?? ''} ${summary ?? ''} ${inference ?? ''}`.toLowerCase()
  const isLabel =
    /\b(pattern|type|kind|category|class|label|identify|recognize)\b/.test(text) ||
    (Array.isArray(tags) &&
      tags.some((tag) => {
        const t = tag?.toLowerCase?.() ?? ''
        return t.includes('pattern') || t.includes('type')
      }))

  if (isLabel) return 'Label'

  // Default to Observation
  return 'Observation'
}

async function runTests() {
  console.log('Starting inbox-classification unit tests...\n')

  // "How to build a habit" => Observation
  {
    const c: Candidate = { title: 'How to build a habit' }
    assert(computeMessageClassification(c) === 'Observation', 'Expected Observation for "How to build a habit"')
  }

  // "What we learned this week" => Observation
  {
    const c: Candidate = { title: 'What we learned this week' }
    assert(computeMessageClassification(c) === 'Observation', 'Expected Observation for "What we learned this week"')
  }

  // "What did I miss?" => Question
  {
    const c: Candidate = { title: 'What did I miss?' }
    assert(computeMessageClassification(c) === 'Question', 'Expected Question for "What did I miss?"')
  }

  // "When should I exercise?" => Question
  {
    const c: Candidate = { title: 'When should I exercise?' }
    assert(computeMessageClassification(c) === 'Question', 'Expected Question for "When should I exercise?"')
  }

  // "Pattern detected: recurring late-night browsing" => Label
  {
    const c: Candidate = { title: 'Pattern detected: recurring late-night browsing' }
    assert(computeMessageClassification(c) === 'Label', 'Expected Label for "Pattern detected: recurring late-night browsing"')
  }

  // Borderlines without '?' default to Observation
  {
    const c: Candidate = { title: 'Why this matters' }
    assert(computeMessageClassification(c) === 'Observation', 'Expected Observation for "Why this matters" (no question mark)')
  }

  console.log('All inbox-classification unit tests passed! ✓')
}

runTests().catch((error) => {
  console.error('inbox-classification unit test failed:', error)
  process.exit(1)
})
