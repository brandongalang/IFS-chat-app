import 'server-only'

import { proposePartSplitSchema, proposePartMergeSchema, approveRejectSchema, executeProposalSchema, type ProposePartSplitInput, type ProposePartMergeInput, type ApproveRejectInput, type ExecuteProposalInput } from './proposals.schema'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { createActionLogger } from '@/lib/database/action-logger'
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

  const { data: parent, error: parentErr } = await supabase
    .from('parts')
    .select('*')
    .eq('id', payload.parentPartId)
    .eq('user_id', userId)
    .single()
  if (parentErr || !parent) throw new Error('Parent part not found')

  const now = new Date().toISOString()

  const inserts = (payload.children as Array<any>).map((c: any) => ({
    user_id: userId,
    name: c.name,
    status: 'emerging',
    category: parent.category,
    age: c.age ?? null,
    role: c.role ?? null,
    triggers: parent.triggers ?? [],
    emotions: parent.emotions ?? [],
    beliefs: parent.beliefs ?? [],
    somatic_markers: parent.somatic_markers ?? [],
    confidence: Math.max(0, Math.min(1, parent.confidence - 0.1)),
    evidence_count: 0,
    recent_evidence: [],
    story: {
      ...(parent.story || {}),
      evolution: [
        ...((parent.story?.evolution) || []),
        { timestamp: now, change: `Split from ${parent.name}`, trigger: 'Split execution' },
      ],
    },
    relationships: parent.relationships || {},
    visualization: parent.visualization || { emoji: '🤗', color: '#6B7280', energyLevel: 0.5 },
    first_noticed: parent.first_noticed,
    acknowledged_at: null,
    last_active: now,
    created_at: now,
    updated_at: now,
  }))

  const { data: children, error: childErr } = await supabase
    .from('parts')
    .insert(inserts)
    .select('*')
  if (childErr) throw new Error(`Failed to create split children: ${childErr.message}`)

  const actionLogger = await getActionLoggerWithClient(supabase)

  const relationships = parent.relationships || {}
  const lineage = { ...(relationships.lineage || {}) }
  lineage['superseded_by'] = [...(lineage['superseded_by'] || []), ...children.map((c: PartRow) => c.id)]
  const updatedParent = await actionLogger.loggedUpdate<PartRow>(
    'parts',
    parent.id,
    { relationships: { ...relationships, lineage }, updated_at: now },
    userId,
    'update_part_attributes',
    { partName: parent.name, changeDescription: 'Updated lineage after split' }
  )

  const { error: execErr } = await supabase
    .from('part_change_proposals')
    .update({ status: 'executed', executed_at: now, executed_by: 'agent' })
    .eq('id', validated.proposalId)
  if (execErr) throw new Error(`Failed to mark proposal executed: ${execErr.message}`)

  return { parent: updatedParent, children }
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

  const { data: parts, error: partsErr } = await supabase
    .from('parts')
    .select('*')
    .eq('user_id', userId)
    .in('id', payload.partIds)
  if (partsErr || !parts || parts.length < 2) throw new Error('Parts not found for merge')

  const canonical = parts[0]
  const now = new Date().toISOString()

  const actionLogger = await getActionLoggerWithClient(supabase)

  const updatedCanonical = await actionLogger.loggedUpdate<PartRow>(
    'parts',
    canonical.id,
    { name: payload.canonicalName, updated_at: now },
    userId,
    'update_part_attributes',
    { partName: canonical.name, changeDescription: `Renamed to ${payload.canonicalName} during merge` }
  )

  for (const p of parts.slice(1)) {
    const relationships = p.relationships || {}
    const lineage = { ...(relationships.lineage || {}) }
    lineage['superseded_by'] = [...(lineage['superseded_by'] || []), updatedCanonical.id]
    await actionLogger.loggedUpdate<PartRow>(
      'parts',
      p.id,
      { relationships: { ...relationships, lineage }, updated_at: now },
      userId,
      'update_part_attributes',
      { partName: p.name, changeDescription: `Superseded by ${payload.canonicalName}` }
    )
  }

  const { error: execErr } = await supabase
    .from('part_change_proposals')
    .update({ status: 'executed', executed_at: now, executed_by: 'agent' })
    .eq('id', validated.proposalId)
  if (execErr) throw new Error(`Failed to mark proposal executed: ${execErr.message}`)

  return { canonical: updatedCanonical, merged: parts.slice(1) }
}
