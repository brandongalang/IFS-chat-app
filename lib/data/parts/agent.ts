import 'server-only';

import { requiresUserConfirmation, devLog, dev } from '@/config/dev';
import { env } from '@/config/env';
import { getSupabaseServiceRoleKey } from '@/lib/supabase/config';
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients';
import type { RelationshipDynamic } from '@/lib/types/database';
import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
  createEmergingPartSchema,
  updatePartSchema,
  getPartRelationshipsSchema,
  getPartNotesSchema,
  logRelationshipSchema,
  supersedePartSchema,
  upsertPartInputSchema,
  type SearchPartsInput,
  type SearchPartsResult,
  type GetPartByIdInput,
  type GetPartByIdResult,
  type GetPartDetailInput,
  type GetPartDetailResult,
  type CreateEmergingPartInput,
  type CreateEmergingPartResult,
  type UpdatePartInput,
  type UpdatePartResult,
  type GetPartRelationshipsInput,
  type GetPartRelationshipsResult,
  type GetPartNotesInput,
  type GetPartNotesResult,
  type LogRelationshipInput,
  type LogRelationshipResult,
  type SupersedePartInput,
  type SupersedePartResult,
  type UpsertPartInput,
  type PartRelationshipWithDetails,
} from './schema';
import { searchParts as searchPartsClient, getPartById as getPartByIdClient } from './client';
import {
  DEFAULT_RELATIONSHIP_STATUS,
  DEFAULT_VISUALIZATION,
  type RelationshipContextPayload,
  coerceVisualization,
  parseRelationshipContext,
  parseRelationshipObservations,
} from './schema';

import type { PartRowV2, PartRelationshipRowV2 } from '../schema/types';

async function getActionLogger(client: SupabaseDatabaseClient) {
  const { createActionLogger } = await import('@/lib/database/action-logger');
  return createActionLogger(client);
}

export type PartsAgentDependencies = {
  client: SupabaseDatabaseClient;
  userId: string;
};

function assertAgentDeps(deps: PartsAgentDependencies): PartsAgentDependencies {
  if (!deps?.client) {
    throw new Error('Supabase client is required for agent part operations');
  }
  if (!deps?.userId) {
    throw new Error('userId is required for agent part operations');
  }
  return deps;
}

function encodeRelationshipContext(payload: RelationshipContextPayload): string | null {
  const pruned: RelationshipContextPayload = {
    description: payload.description ?? null,
    issue: payload.issue ?? null,
    commonGround: payload.commonGround ?? null,
    status: payload.status ?? null,
    polarizationLevel:
      typeof payload.polarizationLevel === 'number' ? payload.polarizationLevel : null,
    lastAddressed: payload.lastAddressed ?? null,
  };

  if (
    pruned.description === null &&
    pruned.issue === null &&
    pruned.commonGround === null &&
    pruned.status === null &&
    pruned.polarizationLevel === null &&
    pruned.lastAddressed === null
  ) {
    return null;
  }

  return JSON.stringify(pruned);
}

function encodeRelationshipDynamics(dynamics: RelationshipDynamic[]): string[] {
  if (!dynamics.length) return [];
  return [JSON.stringify({ dynamics })];
}

function buildPartDataPatch(
  current: PartRowV2,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const existing =
    current.data && typeof current.data === 'object' && !Array.isArray(current.data)
      ? { ...(current.data as Record<string, unknown>) }
      : {};
  for (const [key, value] of Object.entries(patch)) {
    existing[key] = value;
  }
  return existing;
}

/**
 * Search parts for the current user using the PRD `parts_v2` table and return V2 rows.
 */
export async function searchParts(
  input: SearchPartsInput,
  deps: PartsAgentDependencies
): Promise<SearchPartsResult> {
  const validated = searchPartsSchema.parse(input);
  const { userId } = assertAgentDeps(deps);

  devLog('agent.searchParts', { userId, query: validated.query });

  return await searchPartsClient(input, { client: deps.client });
}

/**
 * Fetch a single part, including optional markdown snapshot sections when memory v2 is enabled.
 */
export async function getPartById(
  input: GetPartByIdInput,
  deps: PartsAgentDependencies
): Promise<GetPartByIdResult> {
  const validated = getPartByIdSchema.parse(input);
  const { userId } = assertAgentDeps(deps);

  devLog('agent.getPartById', { userId, id: validated.partId });

  const part = await getPartByIdClient(input, deps);
  if (!part) return null;

  // Future enhancement: conditionally attach markdown profile sections.
  return part;
}

// Import listRelationships from schema/relationships
async function listRelationshipsV2(
  deps: { client: SupabaseDatabaseClient; userId: string },
  filters: { partId?: string; type?: string } = {}
): Promise<PartRelationshipRowV2[]> {
  const { client, userId } = deps;
  let query = client
    .from('part_relationships_v2')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters.partId) {
    query = query.or(`part_a_id.eq.${filters.partId},part_b_id.eq.${filters.partId}`);
  }
  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list relationships: ${error.message}`);
  }
  return (data ?? []) as PartRelationshipRowV2[];
}

/**
 * Return a part with relationship details and optional markdown snapshots for overview, part, and relationships.
 */
export async function getPartDetail(
  input: GetPartDetailInput,
  deps: PartsAgentDependencies
): Promise<GetPartDetailResult> {
  const validated = getPartDetailSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  devLog('agent.getPartDetail', { userId, id: validated.partId });

  const part = await getPartById(input, deps);
  if (!part) {
    throw new Error('Part not found');
  }

  const rels = await listRelationshipsV2({ client, userId }, { partId: validated.partId });

  const mappedRelationships = rels.map((rel) => {
    const contextPayload = parseRelationshipContext(rel.context);
    const dynamics = parseRelationshipObservations(rel.observations);
    const polarization =
      typeof contextPayload.polarizationLevel === 'number'
        ? contextPayload.polarizationLevel
        : typeof rel.strength === 'number'
          ? Math.max(0, Math.min(1, 1 - rel.strength))
          : 0.5;

    return {
      id: rel.id,
      user_id: rel.user_id,
      parts: [rel.part_a_id, rel.part_b_id],
      type: rel.type,
      description: contextPayload.description ?? null,
      issue: contextPayload.issue ?? null,
      common_ground: contextPayload.commonGround ?? null,
      dynamics,
      status: (contextPayload.status ?? DEFAULT_RELATIONSHIP_STATUS) as any,
      polarization_level: polarization,
      last_addressed: contextPayload.lastAddressed ?? null,
      created_at: rel.created_at,
      updated_at: rel.updated_at,
    };
  });

  let overviewSections: unknown;
  let partProfileSections: unknown;
  let relationshipProfiles: Record<string, unknown> | undefined;

  // Future enhancement: load markdown profile sections.

  return {
    ...part,
    relationships: mappedRelationships as any[],
    snapshots:
      overviewSections || partProfileSections || relationshipProfiles
        ? {
            overview_sections: overviewSections,
            part_profile_sections: partProfileSections,
            relationship_profiles: relationshipProfiles,
          }
        : undefined,
  };
}

/**
 * Create a new emerging part in `parts_v2`, enforcing evidence count and user confirmation requirements.
 */
export async function createEmergingPart(
  input: CreateEmergingPartInput,
  deps: PartsAgentDependencies
): Promise<CreateEmergingPartResult> {
  const validated = createEmergingPartSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  if (validated.evidence.length < 3) {
    throw new Error('Cannot create emerging part: At least 3 pieces of evidence are required');
  }

  if (requiresUserConfirmation(validated.userConfirmed)) {
    throw new Error(
      'Cannot create emerging part: User confirmation is required through chat interaction'
    );
  }

  const nowIso = new Date().toISOString();

  const { data: existing } = await client
    .from('parts_v2')
    .select('id')
    .eq('user_id', userId)
    .eq('name', validated.name)
    .maybeSingle();

  if (existing) {
    throw new Error(`A part named "${validated.name}" already exists for this user`);
  }

  const avgEvidenceConfidence =
    validated.evidence.reduce((sum, ev) => sum + ev.confidence, 0) / validated.evidence.length;
  const initialConfidence = Math.min(0.95, avgEvidenceConfidence * 0.8);

  const dataPayload: Record<string, unknown> = {
    age: validated.age ?? null,
    role: validated.role ?? null,
    triggers: validated.triggers ?? [],
    emotions: validated.emotions ?? [],
    beliefs: validated.beliefs ?? [],
    somatic_markers: validated.somaticMarkers ?? [],
    recent_evidence: validated.evidence,
    story: {
      origin: null,
      currentState: `Newly discovered part with ${validated.evidence.length} pieces of evidence`,
      purpose: validated.role ?? null,
      evolution: [
        {
          timestamp: nowIso,
          change: 'Part created',
          trigger: 'Evidence threshold reached',
        },
      ],
    },
    visualization: { ...DEFAULT_VISUALIZATION },
    acknowledged_at: null,
    last_interaction_at: nowIso,
    last_charged_at: null,
    last_charge_intensity: null,
  };

  const insertPayload = {
    user_id: userId,
    name: validated.name,
    status: 'emerging' as const,
    category: validated.category ?? 'unknown',
    confidence: initialConfidence,
    evidence_count: validated.evidence.length,
    data: dataPayload,
    first_noticed: nowIso,
    last_active: nowIso,
  };

  const actionLogger = await getActionLogger(client);
  const inserted = await actionLogger.loggedInsert(
    'parts_v2',
    insertPayload,
    userId,
    'create_emerging_part',
    {
      partName: validated.name,
      changeDescription: `Created emerging part with ${validated.evidence.length} pieces of evidence`,
      evidenceCount: validated.evidence.length,
      confidence: initialConfidence,
      category: validated.category ?? 'unknown',
    }
  );

  return inserted as PartRowV2;
}

function combinePartUpdates(
  current: PartRowV2,
  updates: UpdatePartInput['updates'],
  nowIso: string
): {
  partPatch: Partial<PartRowV2>;
  dataPatch: Record<string, unknown>;
  actionType: string;
  changeDescription: string;
} {
  const data =
    current.data && typeof current.data === 'object' && !Array.isArray(current.data)
      ? (current.data as Record<string, unknown>)
      : {};

  const partPatch: Partial<PartRowV2> = {
    last_active: nowIso,
  };

  const dataPatch: Record<string, unknown> = {};

  if (
    typeof updates.name === 'string' &&
    updates.name.trim().length > 0 &&
    updates.name !== current.name
  ) {
    partPatch.name = updates.name.trim();
  }

  if (updates.status && updates.status !== current.status) {
    partPatch.status = updates.status;
  }

  if (updates.category && updates.category !== current.category) {
    partPatch.category = updates.category;
  }

  if (typeof updates.role !== 'undefined') {
    dataPatch.role = updates.role ?? null;
  }

  if (typeof updates.age !== 'undefined') {
    dataPatch.age = updates.age ?? null;
  }

  if (typeof updates.triggers !== 'undefined') {
    dataPatch.triggers = updates.triggers ?? [];
  }

  if (typeof updates.emotions !== 'undefined') {
    dataPatch.emotions = updates.emotions ?? [];
  }

  if (typeof updates.beliefs !== 'undefined') {
    dataPatch.beliefs = updates.beliefs ?? [];
  }

  if (typeof updates.somaticMarkers !== 'undefined') {
    dataPatch.somatic_markers = updates.somaticMarkers ?? [];
  }

  if (typeof updates.visualization !== 'undefined') {
    dataPatch.visualization = {
      ...coerceVisualization(data.visualization),
      ...updates.visualization,
    };
  }

  if (typeof updates.last_charge_intensity === 'number') {
    dataPatch.last_charge_intensity = updates.last_charge_intensity;
  }

  if (typeof updates.last_charged_at === 'string') {
    dataPatch.last_charged_at = updates.last_charged_at;
  }

  if (typeof updates.acknowledged_at === 'string') {
    dataPatch.acknowledged_at = updates.acknowledged_at;
  }

  if (typeof updates.last_interaction_at === 'string') {
    dataPatch.last_interaction_at = updates.last_interaction_at;
  }

  if (updates.last_active) {
    partPatch.last_active = updates.last_active;
  }

  let actionType: string = 'update_part_attributes';
  let changeDescription = 'Updated part attributes';

  if (partPatch.name && partPatch.name !== current.name) {
    changeDescription = `renamed part from "${current.name}" to "${partPatch.name}"`;
  } else if (updates.visualization) {
    changeDescription = 'updated part visualization';
  } else if (typeof updates.last_charge_intensity === 'number') {
    actionType = 'update_part_charge';
    changeDescription = `updated part charge to ${updates.last_charge_intensity.toFixed(2)}`;
  } else if (updates.category && updates.category !== current.category) {
    actionType = 'update_part_category';
    changeDescription = `changed category from ${current.category} to ${updates.category}`;
  }

  return { partPatch, dataPatch, actionType, changeDescription };
}

/**
 * Apply updates to a part, including confidence adjustments and evidence append, while logging the change.
 */
export async function updatePart(
  input: UpdatePartInput,
  deps: PartsAgentDependencies
): Promise<UpdatePartResult> {
  const validated = updatePartSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  const { data: currentRow, error } = await client
    .from('parts_v2')
    .select('*')
    .eq('id', validated.partId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch part_v2: ${error.message}`);
  }

  if (!currentRow) {
    throw new Error('Part not found or access denied');
  }

  const current = currentRow as PartRowV2;
  const currentData =
    current.data && typeof current.data === 'object' && !Array.isArray(current.data)
      ? (current.data as Record<string, unknown>)
      : {};

  const nowIso = new Date().toISOString();

  const {
    partPatch,
    dataPatch,
    actionType: baseActionType,
    changeDescription: baseChangeDescription,
  } = combinePartUpdates(current, validated.updates, nowIso);

  let updatedConfidence = current.confidence ?? 0;
  if (typeof validated.updates.confidenceBoost === 'number') {
    updatedConfidence = Math.min(
      1,
      Math.max(0, updatedConfidence + validated.updates.confidenceBoost)
    );
    partPatch.confidence = updatedConfidence;
  }

  let evidenceCount = current.evidence_count ?? 0;
  let updatedEvidence = Array.isArray(currentData.recent_evidence)
    ? currentData.recent_evidence
    : [];
  if (validated.evidence) {
    updatedEvidence = [...updatedEvidence, validated.evidence].slice(-10);
    evidenceCount = (current.evidence_count ?? 0) + 1;
    partPatch.evidence_count = evidenceCount;
    dataPatch.recent_evidence = updatedEvidence;
  }
  const mergedData = buildPartDataPatch(currentRow as PartRowV2, dataPatch);

  let actionType = baseActionType;
  let changeDescription = baseChangeDescription;

  if (typeof validated.updates.confidenceBoost === 'number') {
    actionType = 'update_part_confidence';
    const direction = validated.updates.confidenceBoost >= 0 ? 'increased' : 'decreased';
    changeDescription = `${direction} confidence from ${current.confidence} to ${updatedConfidence}`;
  } else if (validated.evidence) {
    actionType = 'add_part_evidence';
    changeDescription = `added evidence: ${validated.evidence.content.substring(0, 50)}...`;
  }

  const actionLogger = await getActionLogger(client);
  const updated = await actionLogger.loggedUpdate(
    'parts_v2',
    validated.partId,
    {
      ...(partPatch as Record<string, unknown>),
      data: mergedData,
    },
    userId,
    actionType as any,
    {
      partName: current.name ?? undefined,
      changeDescription,
      confidenceDelta: validated.updates.confidenceBoost,
      categoryChange: validated.updates.category
        ? { from: current.category, to: validated.updates.category }
        : undefined,
      evidenceAdded: Boolean(validated.evidence),
      fieldChanged: Object.keys(validated.updates).join(', '),
      auditNote: validated.auditNote || undefined,
    }
  );

  return updated as PartRowV2;
}

/**
 * List relationships for the user, remapping PRD rows into legacy structures with optional part details and snapshots.
 */
export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsAgentDependencies
): Promise<GetPartRelationshipsResult> {
  const validated = getPartRelationshipsSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  const filterType = validated.relationshipType;

  const relationships = await listRelationshipsV2(
    { client, userId },
    {
      partId: validated.partId,
      type: filterType,
    }
  );

  const filtered = validated.partId
    ? relationships.filter(
        (rel) => rel.part_a_id === validated.partId || rel.part_b_id === validated.partId
      )
    : relationships;

  const limited = filtered.slice(0, validated.limit);

  let partsDetails: Record<string, { name: string; status: string }> = {};
  if (validated.includePartDetails) {
    const ids = new Set<string>();
    for (const rel of limited) {
      ids.add(rel.part_a_id);
      ids.add(rel.part_b_id);
    }
    if (ids.size > 0) {
      const { data, error } = await client
        .from('parts_v2')
        .select('id, name, status')
        .eq('user_id', userId)
        .in('id', Array.from(ids));
      if (error) {
        throw new Error(`Error fetching part details: ${error.message}`);
      }
      partsDetails = (data ?? []).reduce<Record<string, { name: string; status: string }>>(
        (acc, part) => {
          acc[part.id] = { name: part.name ?? 'Unnamed Part', status: part.status ?? 'active' };
          return acc;
        },
        {}
      );
    }
  }

  return limited.map((rel) => {
    const contextPayload = parseRelationshipContext(rel.context);
    const dynamics = parseRelationshipObservations(rel.observations);
    const polarization =
      typeof contextPayload.polarizationLevel === 'number'
        ? contextPayload.polarizationLevel
        : typeof rel.strength === 'number'
          ? Math.max(0, Math.min(1, 1 - rel.strength))
          : 0.5;

    const partIds = [rel.part_a_id, rel.part_b_id];

    return {
      id: rel.id,
      user_id: userId,
      part_a_id: rel.part_a_id,
      part_b_id: rel.part_b_id,
      type: rel.type as any,
      strength: rel.strength ?? 0.5,
      context: contextPayload,
      status: (contextPayload.status ?? DEFAULT_RELATIONSHIP_STATUS) as any,
      description: contextPayload.description ?? null,
      issue: contextPayload.issue ?? null,
      common_ground: contextPayload.commonGround ?? null,
      polarization_level: polarization,
      dynamics: dynamics.map((d) => ({ observation: d, context: '' })),
      parts: partIds.map((partId) => ({
        id: partId,
        ...(validated.includePartDetails && partsDetails[partId]
          ? { name: partsDetails[partId].name, status: partsDetails[partId].status }
          : {}),
      })),
      last_addressed: contextPayload.lastAddressed ?? null,
      created_at: rel.created_at,
      updated_at: rel.updated_at,
    } as PartRelationshipWithDetails;
  });
}

/**
 * Fetch freeform clarification notes for a part, ensuring user scoping through Supabase joins.
 */
export async function getPartNotes(
  input: GetPartNotesInput,
  deps: PartsAgentDependencies
): Promise<GetPartNotesResult> {
  const validated = getPartNotesSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  const { data, error } = await client
    .from('part_notes')
    .select('id, part_id, content, created_at, parts!inner(user_id)')
    .eq('part_id', validated.partId)
    .eq('parts.user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return (data ?? []).map((note: any) => ({
    id: note.id,
    part_id: note.part_id,
    content: note.content,
    created_at: note.created_at,
  }));
}

/**
 * Create or update a relationship record, computing polarization strength and persisting audit logs.
 */
export async function logRelationship(
  input: LogRelationshipInput,
  deps: PartsAgentDependencies
): Promise<LogRelationshipResult> {
  const validated = logRelationshipSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  const sortedPartIds = [...validated.partIds].sort();
  const nowIso = new Date().toISOString();
  const v2Type = validated.type;

  const contextPayload: RelationshipContextPayload = {
    description: validated.description ?? null,
    issue: validated.issue ?? null,
    commonGround: validated.commonGround ?? null,
    status: (validated.status ?? DEFAULT_RELATIONSHIP_STATUS) as any,
    polarizationLevel:
      typeof validated.polarizationLevel === 'number' ? validated.polarizationLevel : undefined,
    lastAddressed: validated.lastAddressed ?? null,
  };

  const dynamics: RelationshipDynamic[] = validated.dynamic
    ? [
        {
          observation: validated.dynamic.observation,
          context: validated.dynamic.context,
          polarizationChange: validated.dynamic.polarizationChange,
          timestamp: validated.dynamic.timestamp ?? nowIso,
        },
      ]
    : [];

  const { data: candidates, error } = await client
    .from('part_relationships_v2')
    .select('*')
    .eq('user_id', userId)
    .eq('type', v2Type)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to query relationships: ${error.message}`);
  }

  const matched = (candidates ?? []).find((row) => {
    const pair = [row.part_a_id, row.part_b_id].sort();
    return pair[0] === sortedPartIds[0] && pair[1] === sortedPartIds[1];
  });

  const polarization =
    typeof contextPayload.polarizationLevel === 'number'
      ? Math.max(0, Math.min(1, contextPayload.polarizationLevel))
      : typeof validated.polarizationLevel === 'number'
        ? Math.max(0, Math.min(1, validated.polarizationLevel))
        : 0.5;

  const strength = 1 - polarization;

  if (matched) {
    const currentContext = parseRelationshipContext(matched.context);
    const currentDynamics = parseRelationshipObservations(matched.observations);

    const nextContext: RelationshipContextPayload = {
      description: contextPayload.description ?? currentContext.description ?? null,
      issue: contextPayload.issue ?? currentContext.issue ?? null,
      commonGround: contextPayload.commonGround ?? currentContext.commonGround ?? null,
      status: (contextPayload.status ??
        currentContext.status ??
        DEFAULT_RELATIONSHIP_STATUS) as any,
      polarizationLevel: polarization,
      lastAddressed: contextPayload.lastAddressed ?? currentContext.lastAddressed ?? null,
    };

    const nextDynamics = [...currentDynamics, ...dynamics];

    const updatePayload = {
      strength,
      context: encodeRelationshipContext(nextContext),
      observations: encodeRelationshipDynamics(nextDynamics as RelationshipDynamic[]),
      updated_at: nowIso,
    };

    const serviceRole = getSupabaseServiceRoleKey();
    if (typeof window === 'undefined' && dev.enabled && serviceRole) {
      const { data: direct, error: updateError } = await client
        .from('part_relationships_v2')
        .update(updatePayload as any)
        .eq('id', matched.id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (updateError || !direct) {
        throw new Error(
          `Failed to update relationship: ${updateError?.message ?? 'unknown error'}`
        );
      }
      return direct as PartRelationshipRowV2;
    }

    const actionLogger = await getActionLogger(client);
    const updated = await actionLogger.loggedUpdate(
      'part_relationships_v2',
      matched.id,
      updatePayload as any,
      userId,
      'update_relationship',
      {
        partIds: sortedPartIds,
        changeDescription: dynamics.length
          ? `Appended dynamic: ${dynamics[0].observation.substring(0, 60)}...`
          : 'Updated relationship fields',
        polarization,
        type: validated.type,
      }
    );

    return updated as PartRelationshipRowV2;
  }

  const insertContext: RelationshipContextPayload = {
    ...contextPayload,
    polarizationLevel: polarization,
  };

  const insertPayload = {
    part_a_id: sortedPartIds[0],
    part_b_id: sortedPartIds[1],
    type: v2Type,
    strength,
    context: encodeRelationshipContext(insertContext),
    observations: encodeRelationshipDynamics(dynamics),
    created_at: nowIso,
    updated_at: nowIso,
  };

  const actionLogger = await getActionLogger(client);
  const created = await actionLogger.loggedInsert(
    'part_relationships_v2',
    insertPayload as any,
    userId,
    'create_relationship',
    {
      partIds: sortedPartIds,
      changeDescription: dynamics.length
        ? `Created relationship with dynamic: ${dynamics[0].observation.substring(0, 60)}...`
        : 'Created relationship',
      polarization,
      type: validated.type,
    }
  );

  return created as PartRelationshipRowV2;
}

/**
 * Update a part's lineage to indicate it has been superseded by one or more other parts.
 * This is used during split and merge operations to maintain lineage history.
 */
export async function supersedePart(
  input: SupersedePartInput,
  deps: PartsAgentDependencies
): Promise<SupersedePartResult> {
  const validated = supersedePartSchema.parse(input);
  const { client, userId } = assertAgentDeps(deps);

  const { data: currentRow, error } = await client
    .from('parts_v2')
    .select('*')
    .eq('id', validated.partId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch part_v2: ${error.message}`);
  }

  if (!currentRow) {
    throw new Error('Part not found or access denied');
  }

  const currentData =
    currentRow.data && typeof currentRow.data === 'object' && !Array.isArray(currentRow.data)
      ? { ...(currentRow.data as Record<string, unknown>) }
      : {};
  const relationships =
    currentData.relationships &&
    typeof currentData.relationships === 'object' &&
    !Array.isArray(currentData.relationships)
      ? { ...(currentData.relationships as Record<string, unknown>) }
      : {};
  const lineage =
    relationships.lineage &&
    typeof relationships.lineage === 'object' &&
    !Array.isArray(relationships.lineage)
      ? { ...(relationships.lineage as Record<string, unknown>) }
      : {};

  const existingSuperseded = Array.isArray(lineage.superseded_by)
    ? (lineage.superseded_by as string[])
    : [];
  const newSupersededBy = [...new Set([...existingSuperseded, ...validated.supersededBy])];

  const updatedLineage = {
    ...lineage,
    superseded_by: newSupersededBy,
  };

  const updatedRelationships = {
    ...relationships,
    lineage: updatedLineage,
  };

  const dataPatch = {
    relationships: updatedRelationships,
  };

  const mergedData = buildPartDataPatch(currentRow as PartRowV2, dataPatch);
  const nowIso = new Date().toISOString();

  const actionLogger = await getActionLogger(client);
  const updated = await actionLogger.loggedUpdate(
    'parts_v2',
    validated.partId,
    {
      data: mergedData,
      updated_at: nowIso,
    },
    userId,
    'update_part_attributes',
    {
      partName: currentRow.name,
      changeDescription: validated.reason ?? 'Updated lineage',
      supersededBy: validated.supersededBy,
    }
  );

  return updated as PartRowV2;
}

export interface CreateSplitChildPartInput {
  childProposal: {
    name: string;
    role?: string | null;
    age?: number | null;
  };
  parentRecord: PartRowV2;
}

/**
 * Create a new child part resulting from a split operation.
 * Inherits attributes from the parent and sets up lineage.
 */
export async function createSplitChildPart(
  input: CreateSplitChildPartInput,
  deps: PartsAgentDependencies
): Promise<PartRowV2> {
  const { childProposal, parentRecord } = input;
  const { client, userId } = assertAgentDeps(deps);
  const now = new Date().toISOString();
  const actionLogger = await getActionLogger(client);

  const parentData =
    parentRecord.data && typeof parentRecord.data === 'object' && !Array.isArray(parentRecord.data)
      ? (parentRecord.data as Record<string, unknown>)
      : {};

  // Payload shaping logic
  const childStory =
    parentData.story && typeof parentData.story === 'object' && !Array.isArray(parentData.story)
      ? { ...(parentData.story as Record<string, unknown>) }
      : {};
  const childStoryEvolution = Array.isArray((childStory as any)?.evolution)
    ? [
        ...((childStory as any).evolution as Array<{
          timestamp?: string;
          change?: string;
          trigger?: string;
        }>),
        { timestamp: now, change: `Split from ${parentRecord.name}`, trigger: 'Split execution' },
      ]
    : [{ timestamp: now, change: `Split from ${parentRecord.name}`, trigger: 'Split execution' }];

  const childData = {
    role: childProposal.role ?? (typeof parentData.role === 'string' ? parentData.role : null),
    age: childProposal.age ?? (typeof parentData.age === 'number' ? parentData.age : null),
    triggers: Array.isArray(parentData.triggers) ? parentData.triggers : [],
    emotions: Array.isArray(parentData.emotions) ? parentData.emotions : [],
    beliefs: Array.isArray(parentData.beliefs) ? parentData.beliefs : [],
    somatic_markers: Array.isArray(parentData.somatic_markers) ? parentData.somatic_markers : [],
    recent_evidence: [],
    story: { ...childStory, evolution: childStoryEvolution },
    relationships: parentData.relationships ?? {},
    visualization: parentData.visualization ?? { ...DEFAULT_VISUALIZATION },
    acknowledged_at: null,
    last_interaction_at: now,
    lineage_source: parentRecord.id,
  };

  const insertPayload = {
    user_id: userId,
    name: childProposal.name,
    status: 'emerging' as const,
    category: parentRecord.category,
    charge: parentRecord.charge ?? 'neutral',
    needs_attention: false,
    confidence: Math.max(0, Math.min(1, (parentRecord.confidence ?? 0) - 0.1)),
    evidence_count: 0,
    data: childData,
    first_noticed: parentRecord.first_noticed ?? now,
    last_active: now,
    created_at: now,
    updated_at: now,
  };

  const inserted = await actionLogger.loggedInsert(
    'parts_v2',
    insertPayload,
    userId,
    'create_emerging_part',
    {
      partName: childProposal.name,
      changeDescription: `Split child created from ${parentRecord.name}`,
      parentPartId: parentRecord.id,
    }
  );

  return inserted as PartRowV2;
}

/**
 * Delete a part record and all its associated data.
 */
export async function deletePart(partId: string, deps: PartsAgentDependencies): Promise<void> {
  const { client, userId } = assertAgentDeps(deps);
  const { error } = await client.from('parts_v2').delete().eq('id', partId).eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete part: ${error.message}`);
  }
}

/**
 * Create or update a part record using a raw payload.
 * Useful for sync operations and internal data management.
 */
export async function upsertPart(
  input: UpsertPartInput,
  deps: PartsAgentDependencies
): Promise<PartRowV2> {
  const { client, userId } = assertAgentDeps(deps);
  const now = new Date().toISOString();
  const actionLogger = await getActionLogger(client);

  const payload = {
    ...input,
    user_id: userId,
    updated_at: now,
    first_noticed: input.first_noticed ?? now,
    created_at: input.id ? undefined : now, // Approximate created_at for new parts
  };

  if (input.id) {
    return (await actionLogger.loggedUpdate(
      'parts_v2',
      input.id,
      payload,
      userId,
      'update_part_attributes',
      {
        partName: input.name ?? 'Unnamed Part',
        changeDescription: 'Upsert update',
      }
    )) as PartRowV2;
  } else {
    return (await actionLogger.loggedInsert('parts_v2', payload, userId, 'create_emerging_part', {
      partName: input.name ?? 'Unnamed Part',
      changeDescription: 'Upsert creation',
    })) as PartRowV2;
  }
}

export const __test = {
  parseRelationshipContext,
  encodeRelationshipContext,
  parseRelationshipObservations,
  encodeRelationshipDynamics,
};
