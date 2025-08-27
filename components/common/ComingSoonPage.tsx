import * as React from 'react'
import { ComingSoonView } from './ComingSoonView'
import type { FeatureKey } from '@/config/features'

export default function ComingSoonPage({ featureKey }: { featureKey?: FeatureKey }) {
  return <ComingSoonView featureName={featureKey} />
}

