'use client'

import { useState, useEffect, useMemo, useCallback, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import { searchParts, getPartRelationships } from '@/lib/data/parts-lite'
import type { PartRow, PartCategory, RelationshipType } from '@/lib/types/database'
import type { PartRelationshipWithDetails } from '@/lib/data/parts.schema'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PartCard } from '@/components/garden/PartCard'
import { isGardenGridViewEnabled } from '@/config/features'
import type { ForceGraphProps } from 'react-force-graph-2d'
import { syncPartsAction } from './actions'
import { RefreshCw } from 'lucide-react'

// Dynamically import the ForceGraph2D component to avoid SSR issues
const ForceGraph2D = dynamic<ForceGraphProps<GraphNode, GraphLink>>(
  () => import('react-force-graph-2d'),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[600px] rounded-lg" />,
  }
)

interface GraphNode {
  id: string;
  name: string;
  category: PartCategory;
  emoji: string;
  last_charged_at: string | null;
  last_charge_intensity: number | null;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string
  target: string
  type: RelationshipType
}

// --- Charge Decay and Visualization Logic ---

const CHARGE_DECAY_RATE = 0.00002 // Governs how fast charge decays per millisecond
const MIN_CHARGE_FOR_AURA = 0.1

function calculateCurrentCharge(lastChargedAt: string | null, lastIntensity: number | null): number {
  if (!lastChargedAt || !lastIntensity) return 0
  const timeSinceCharged = Date.now() - new Date(lastChargedAt).getTime()
  const currentCharge = lastIntensity * Math.exp(-CHARGE_DECAY_RATE * timeSinceCharged)
  return currentCharge > 0.01 ? currentCharge : 0 // Clamp to 0 if very small
}

function getCategoryColor(category: PartCategory, charge: number): string {
  const baseColors: Record<PartCategory, [number, number]> = {
    manager: [210, 80],     // Blue: [hue, saturation]
    firefighter: [0, 90],   // Red: [hue, saturation]
    exile: [260, 70],       // Purple: [hue, saturation]
    unknown: [45, 10],      // Gray/Yellow: [hue, saturation]
  }
  const [hue, saturation] = baseColors[category] || baseColors.unknown
  const lightness = 50 + charge * 20 // Brighter when charged
  return `hsla(${hue}, ${saturation}%, ${lightness}%, 1)`
}

function drawNode(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number, time: number) {
  const { x, y, name, category, emoji, last_charged_at, last_charge_intensity } = node
  if (typeof x !== 'number' || typeof y !== 'number') return;

  const charge = calculateCurrentCharge(last_charged_at, last_charge_intensity)
  const color = getCategoryColor(category, charge)
  const nodeRadius = 10 + charge * 5 // Node gets bigger with charge

  // --- Draw Charge Aura ---
  if (charge > MIN_CHARGE_FOR_AURA) {
    const pulseFactor = Math.sin(time / 300) * 0.5 + 0.5 // Slow pulse
    const auraRadius = nodeRadius + 5 + pulseFactor * 5 * charge
    const aura = ctx.createRadialGradient(x, y, nodeRadius, x, y, auraRadius)
    aura.addColorStop(0, `${color.replace('1)', `${charge * 0.5})`)}`)
    aura.addColorStop(1, `${color.replace('1)', '0)')}`)
    ctx.fillStyle = aura
    ctx.fillRect(x - auraRadius, y - auraRadius, auraRadius * 2, auraRadius * 2)
  }

  // --- Draw Node Shape ---
  ctx.fillStyle = color
  ctx.beginPath()

  if (category === 'manager') { // Rounded rectangle
    const w = nodeRadius * 2.5
    const h = nodeRadius * 1.8
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 5)
  } else if (category === 'firefighter') { // Star
    ctx.moveTo(x, y - nodeRadius)
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(x + Math.cos((18 + i * 72) * Math.PI / 180) * nodeRadius, y - Math.sin((18 + i * 72) * Math.PI / 180) * nodeRadius)
      ctx.lineTo(x + Math.cos((54 + i * 72) * Math.PI / 180) * (nodeRadius / 2), y - Math.sin((54 + i * 72) * Math.PI / 180) * (nodeRadius / 2))
    }
  } else { // Circle (for Exile and Unknown)
    ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false)
  }
  ctx.fill()

  // --- Draw Emoji ---
  const emojiSize = nodeRadius * 1.5
  ctx.font = `${emojiSize / globalScale}px Sans-Serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, x, y)

  // --- Draw Label ---
  const label = name
  const fontSize = 12 / globalScale
  ctx.font = `${fontSize}px Sans-Serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'hsl(var(--foreground))'
  ctx.fillText(label, x, y + nodeRadius + 4)
}


export default function GardenPage() {
  const isGridView = isGardenGridViewEnabled()
  const [parts, setParts] = useState<PartRow[]>([])
  const [relationships, setRelationships] = useState<PartRelationshipWithDetails[]>([])
  const [partsError, setPartsError] = useState<string | null>(null)
  const [relationshipsError, setRelationshipsError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [time, setTime] = useState(0) // For animation timing
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const error = partsError ?? relationshipsError

  useEffect(() => {
    if (isGridView) return
    // Animation loop for graph view
    const frameId = requestAnimationFrame(setTime)
    return () => cancelAnimationFrame(frameId)
  }, [isGridView, time])

  useEffect(() => {
    let isActive = true

    async function fetchPartsData() {
      try {
        const partsResult = await searchParts({ limit: 50 })
        if (!isActive) return

        if (partsResult && Array.isArray(partsResult)) {
          setParts(partsResult)
          setPartsError(null)
        } else {
          throw new Error('Failed to load parts.')
        }
      } catch (e) {
        if (!isActive) return
        const message = e instanceof Error ? e.message : 'Failed to load parts.'
        setPartsError(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    setIsLoading(true)
    fetchPartsData()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (isGridView) {
      setRelationshipsError(null)
      return
    }

    let isActive = true

    async function fetchRelationshipsData() {
      try {
        const relationshipsResult = await getPartRelationships({ includePartDetails: false, limit: 50 })
        if (!isActive) return

        if (relationshipsResult && Array.isArray(relationshipsResult)) {
          setRelationships(relationshipsResult)
          setRelationshipsError(null)
        } else {
          throw new Error('Failed to load relationships.')
        }
      } catch (e) {
        if (!isActive) return
        const message = e instanceof Error ? e.message : 'Failed to load relationships.'
        setRelationshipsError(message)
      }
    }

    fetchRelationshipsData()

    return () => {
      isActive = false
    }
  }, [isGridView])

  const filteredParts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return parts

    return parts.filter((part) => {
      const nameMatch = part.name.toLowerCase().includes(query)
      const roleMatch = part.role ? part.role.toLowerCase().includes(query) : false
      return nameMatch || roleMatch
    })
  }, [parts, searchQuery])

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }, [])

  const graphData = useMemo(() => {
    if (!parts.length) return { nodes: [], links: [] }

    const nodes: GraphNode[] = parts.map((part) => ({
      id: part.id,
      name: part.name,
      category: part.category,
      emoji: (part.visualization as { emoji?: string })?.emoji || '🤗',
      last_charged_at: part.last_charged_at,
      last_charge_intensity: part.last_charge_intensity,
    }))

    const links: GraphLink[] = relationships
      .map((rel) => {
        const partIds = Array.isArray(rel.parts) ? rel.parts : []
        if (partIds.length === 2) {
          const [first, second] = partIds
          if (first?.id && second?.id) {
            return { source: first.id, target: second.id, type: rel.type }
          }
        }
        return null
      })
      .filter((link): link is GraphLink => !!link)

    return { nodes, links }
  }, [parts, relationships])

  const handleNodeClick = useCallback((node: GraphNode) => {
    const id = node.id
    if (id != null) window.location.href = `/garden/${String(id)}`
  }, []);

  const handleDrawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    drawNode(node, ctx, globalScale, time);
  }, [time]);

  const handleRefreshSync = useCallback(async () => {
    console.log('[Garden] Refresh button clicked!');
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      console.log('[Garden] Calling syncPartsAction...');
      const result = await syncPartsAction();
      console.log('[Garden] syncPartsAction result:', result);

      if (result.success) {
        setSyncMessage(`✅ Synced ${result.synced} parts${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
        console.log('[Garden] Refetching parts from database...');
        // Refetch parts to show the newly synced data
        const partsResult = await searchParts({ limit: 50 });
        console.log('[Garden] searchParts result:', partsResult);
        if (partsResult && Array.isArray(partsResult)) {
          console.log(`[Garden] Setting ${partsResult.length} parts in state`);
          setParts(partsResult);
        }
      } else {
        console.error('[Garden] Sync failed:', result.error);
        setSyncMessage(`❌ Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[Garden] Exception during sync:', error);
      setSyncMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
      console.log('[Garden] Sync complete, isSyncing set to false');
      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }, [])

  return (
    <div className="container mx-auto p-4 md:p-6 h-full flex flex-col">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold tracking-tight">The Parts Garden</h1>
            <p className="text-muted-foreground mt-2">
              Explore the parts of your inner world and select a card to see its details.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={handleRefreshSync}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Refresh'}
            </Button>
            {syncMessage && (
              <p className="text-sm text-muted-foreground">{syncMessage}</p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow relative">
        {error && (
          <div className="text-red-500 text-center p-4">
            <p>Could not load garden: {error}</p>
          </div>
        )}

        {!error && (
          isGridView ? (
            <div className="flex flex-col gap-6">
              <div className="max-w-md">
                <label htmlFor="garden-search" className="sr-only">
                  Search parts
                </label>
                <Input
                  id="garden-search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search parts by name or role"
                  autoComplete="off"
                />
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="aspect-square">
                      <div className="flex h-full w-full items-center justify-center">
                        <Skeleton className="h-16 w-16 rounded-full" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : filteredParts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filteredParts.map((part) => (
                    <PartCard key={part.id} part={part} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  No parts match your search yet.
                </p>
              )}
            </div>
          ) : (
            <Card className="w-full h-[600px] overflow-hidden">
              <ForceGraph2D
                graphData={graphData}
                nodeLabel=""
                nodeVal={10}
                onNodeClick={handleNodeClick}
                linkDirectionalParticles={1}
                linkDirectionalParticleWidth={1.5}
                linkDirectionalParticleSpeed={0.008}
                backgroundColor="hsl(var(--card))"
                linkColor={(link: object) => {
                  const l = link as GraphLink
                  switch (l.type) {
                    case 'protector-exile':
                      return 'rgba(134, 239, 172, 0.7)'
                    case 'polarized':
                      return 'rgba(252, 165, 165, 0.8)'
                    case 'allied':
                      return 'rgba(147, 197, 253, 0.7)'
                    default:
                      return 'rgba(156, 163, 175, 0.5)'
                  }
                }}
                linkWidth={(link: object) => ((link as GraphLink).type === 'protector-exile' ? 3 : 1)}
                linkLineDash={(link: object) => ((link as GraphLink).type === 'polarized' ? [4, 2] : [])}
                nodeCanvasObject={(node, ctx, globalScale) => handleDrawNode(node, ctx, globalScale)}
              />
            </Card>
          )
        )}
      </main>
    </div>
  )
}
