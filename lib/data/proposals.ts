import 'server-only'

import { proposePartSplitSchema, proposePartMergeSchema, approveRejectSchema, executeProposalSchema, type ProposePartSplitInput, type ProposePartMergeInput, type ApproveRejectInput, type ExecuteProposalInput } from './proposals.schema'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { createActionLogger } from '@/lib/database/action-logger'
import { getPartById } from './parts-server'
import type { PartRow } from '@/lib/types/database'

export type ProposalDependencies = {
  client: SupabaseDatabaseClient
  userId: string
}

export async function proposePartSplit(
  input: ProposePartSplitInput,
  deps: ProposalDependencies
) {
  const validated = proposePartSplitSchema.parse(input)
  const { client: supabase, userId } = deps

  const { error, data } = await supabase
    .from('part_change_proposals')
    .insert({
      user_id: userId,
      type: 'split',
      payload: {
        parentPartId: validated.parentPartId,
        children: validated.children,
      },
      rationale: validated.rationale,
      idempotency_key: validated.idempotencyKey,
    })
    .select('*')
    .single()

  if (error) {
    const isIdem = (error as any)?.message?.includes('uq_part_change_proposals_idem')
    if (!isIdem) {
      throw new Error(`Failed to propose split: ${error.message}`)
    }
  }

  return data
}

export async function proposePartMerge(
  input: ProposePartMergeInput,
  deps: ProposalDependencies
) {
  const validated = proposePartMergeSchema.parse(input)
  const { client: supabase, userId } = deps

  const { error, data } = await supabase
    .from('part_change_proposals')
    .insert({
      user_id: userId,
      type: 'merge',
      payload: {
        partIds: validated.partIds,
        canonicalName: validated.canonicalName,
      },
      rationale: validated.rationale,
      idempotency_key: validated.idempotencyKey,
    })
    .select('*')
    .single()

  if (error) {
    const isIdem = (error as any)?.message?.includes('uq_part_change_proposals_idem')
    if (!isIdem) {
      throw new Error(`Failed to propose merge: ${error.message}`)
    }
  }

  return data
}

export async function approveProposal(
  input: ApproveRejectInput,
  deps: ProposalDependencies
) {
  const validated = approveRejectSchema.parse(input)
  const { client: supabase, userId } = deps

  const { data: proposal, error } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', validated.proposalId)
    .eq('user_id', userId)
    .single()

  if (error || !proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.status !== 'pending') {
    throw new Error(`Proposal is not pending (status: ${proposal.status})`)
  }

  const { error: updErr, data: updated } = await supabase
    .from('part_change_proposals')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: validated.approvedBy })
    .eq('id', validated.proposalId)
    .select('*')
    .single()

  if (updErr) {
    throw new Error(`Failed to approve: ${updErr.message}`)
  }

  return updated
}

export async function rejectProposal(
  input: ApproveRejectInput,
  deps: ProposalDependencies
) {
  const validated = approveRejectSchema.parse(input)
  const { client: supabase, userId } = deps

  const { data: proposal, error } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', validated.proposalId)
    .eq('user_id', userId)
    .single()

  if (error || !proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.status !== 'pending') {
    throw new Error(`Proposal is not pending (status: ${proposal.status})`)
  }

  const { error: updErr, data: updated } = await supabase
    .from('part_change_proposals')
    .update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: validated.approvedBy })
    .eq('id', validated.proposalId)
    .select('*')
    .single()

  if (updErr) {
    throw new Error(`Failed to reject: ${updErr.message}`)
  }

  return updated
}

async function getActionLoggerWithClient(client: SupabaseDatabaseClient) {
  return createActionLogger(client)
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

export async function executeSplit(
  input: ExecuteProposalInput,
  deps: ProposalDependencies
) {
  const validated = executeProposalSchema.parse(input)
  const { client: supabase, userId } = deps

  const { data: proposal } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', validated.proposalId)
    .eq('user_id', userId)
    .single()

  if (!proposal || proposal.type !== 'split') {
    throw new Error('Invalid split proposal')
  }

  const payload = proposal.payload as any
  const parent = await getPartById({ partId: payload.parentPartId }, deps)
  if (!parent) {
    throw new Error('Parent part not found')
  }

  const { data: parentRecord, error: parentRecordError } = await supabase
    .from('parts_v2')
    .select('id, data, confidence, category, status, evidence_count, first_noticed, last_active, charge, needs_attention')
    .eq('id', parent.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (parentRecordError || !parentRecord) {
    throw new Error('Parent part record missing in PRD schema')
  }

  const now = new Date().toISOString()
  const actionLogger = await getActionLoggerWithClient(supabase)

  const childResults: PartRow[] = []
  const childIds: string[] = []

  for (const child of payload.children as Array<any>) {
    const childStory = toRecord(parent.story)
    const childStoryEvolution = Array.isArray((parent.story as any)?.evolution)
      ? [
          ...((parent.story as any).evolution as Array<{ timestamp?: string; change?: string; trigger?: string }>),
          { timestamp: now, change: `Split from ${parent.name}`, trigger: 'Split execution' },
        ]
      : [{ timestamp: now, change: `Split from ${parent.name}`, trigger: 'Split execution' }]

    const childData = {
      role: child.role ?? parent.role ?? null,
      age: child.age ?? parent.age ?? null,
      triggers: parent.triggers ?? [],
      emotions: parent.emotions ?? [],
      beliefs: parent.beliefs ?? [],
      somatic_markers: parent.somatic_markers ?? [],
      recent_evidence: [],
      story: { ...childStory, evolution: childStoryEvolution },
      relationships: parent.relationships ?? {},
      visualization: parent.visualization ?? { emoji: '🤗', color: '#6B7280', energyLevel: 0.5 },
      acknowledged_at: null,
      last_interaction_at: now,
      lineage_source: parent.id,
    }

    // TODO(ifs-chat-app-5): Replace manual parts_v2 payload shaping with a dedicated split helper once
    // the PRD schema exposes first-class split/merge operations.
    const inserted = await actionLogger.loggedInsert(
      'parts_v2',
      {
        user_id: userId,
        name: child.name,
        status: 'emerging',
        category: parent.category,
        charge: parentRecord.charge ?? 'neutral',
        needs_attention: false,
        confidence: Math.max(0, Math.min(1, (parent.confidence ?? 0) - 0.1)),
        evidence_count: 0,
        data: childData,
        first_noticed: parent.first_noticed ?? now,
        last_active: now,
        created_at: now,
        updated_at: now,
      },
      userId,
      'create_emerging_part',
      {
        partName: child.name,
        changeDescription: `Split child created from ${parent.name}`,
        parentPartId: parent.id,
      }
    )

    childIds.push(inserted.id)
    const mappedChild = await getPartById({ partId: inserted.id }, deps)
    if (mappedChild) {
      childResults.push(mappedChild)
    }
  }

  const parentData = toRecord(parentRecord.data)
  const relationships = toRecord(parentData.relationships ?? parent.relationships)
  const lineage = toRecord(relationships.lineage)
  const superseded = Array.isArray(lineage.superseded_by) ? (lineage.superseded_by as string[]) : []
  relationships.lineage = {
    ...lineage,
    superseded_by: [...new Set([...superseded, ...childIds])],
  }
  parentData.relationships = relationships

  // TODO(ifs-chat-app-5): Swap to PRD merge helper when available to avoid hand-crafted lineage patches.
  await actionLogger.loggedUpdate(
    'parts_v2',
    parent.id,
    {
      data: parentData,
      updated_at: now,
    },
    userId,
    'update_part_attributes',
    { partName: parent.name, changeDescription: 'Updated lineage after split' }
  )

  const updatedParent = await getPartById({ partId: parent.id }, deps)
  if (!updatedParent) {
    throw new Error('Failed to reload parent part after split execution')
  }

  const { error: execErr } = await supabase
    .from('part_change_proposals')
    .update({ status: 'executed', executed_at: now, executed_by: 'agent' })
    .eq('id', validated.proposalId)
  if (execErr) throw new Error(`Failed to mark proposal executed: ${execErr.message}`)

  return { parent: updatedParent, children: childResults }
}

export async function executeMerge(
  input: ExecuteProposalInput,
  deps: ProposalDependencies
) {
  const validated = executeProposalSchema.parse(input)
  const { client: supabase, userId } = deps

  const { data: proposal } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', validated.proposalId)
    .eq('user_id', userId)
    .single()
  if (!proposal || proposal.type !== 'merge') throw new Error('Invalid merge proposal')

  const payload = proposal.payload as any
  const { data: partRecords, error: partsErr } = await supabase
    .from('parts_v2')
    .select('id, name, data')
    .eq('user_id', userId)
    .in('id', payload.partIds)

  if (partsErr) {
    throw new Error(`Failed to load parts for merge: ${partsErr.message}`)
  }

  if (!partRecords || partRecords.length < 2) {
    throw new Error('Parts not found for merge')
  }

  const now = new Date().toISOString()
  const actionLogger = await getActionLoggerWithClient(supabase)

  const canonicalId: string = payload.partIds[0] ?? partRecords[0].id
  const canonicalRecord = partRecords.find((row: any) => row.id === canonicalId) ?? partRecords[0]

  await actionLogger.loggedUpdate(
    'parts_v2',
    canonicalRecord.id,
    { name: payload.canonicalName, updated_at: now },
    userId,
    'update_part_attributes',
    {
      partName: canonicalRecord.name ?? 'Unnamed Part',
      changeDescription: `Renamed to ${payload.canonicalName} during merge`,
    }
  )

  const mergedIds: string[] = []

  for (const record of partRecords) {
    if (record.id === canonicalRecord.id) {
      continue
    }

    const data = toRecord(record.data)
    const relationships = toRecord(data.relationships)
    const lineage = toRecord(relationships.lineage)
    const superseded = Array.isArray(lineage.superseded_by)
      ? (lineage.superseded_by as string[])
      : []

    relationships.lineage = {
      ...lineage,
      superseded_by: [...new Set([...superseded, canonicalRecord.id])],
    }

    data.relationships = relationships

    await actionLogger.loggedUpdate(
      'parts_v2',
      record.id,
      { data, updated_at: now },
      userId,
      'update_part_attributes',
      {
        partName: record.name ?? 'Unnamed Part',
        changeDescription: `Superseded by ${payload.canonicalName}`,
      }
    )

    mergedIds.push(record.id)
  }

  const updatedCanonical = await getPartById({ partId: canonicalRecord.id }, deps)
  if (!updatedCanonical) {
    throw new Error('Failed to reload canonical part after merge execution')
  }

  const mergedParts: PartRow[] = []
  for (const id of mergedIds) {
    const merged = await getPartById({ partId: id }, deps)
    if (merged) {
      mergedParts.push(merged)
    }
  }

  const { error: execErr } = await supabase
    .from('part_change_proposals')
    .update({ status: 'executed', executed_at: now, executed_by: 'agent' })
    .eq('id', validated.proposalId)
  if (execErr) throw new Error(`Failed to mark proposal executed: ${execErr.message}`)

  return { canonical: updatedCanonical, merged: mergedParts }
}
