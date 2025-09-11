import { createTool } from '@mastra/core';
import { i as isMemoryV2Enabled, l as logRelationshipSchema$1, g as getPartRelationshipsSchema$1, u as updatePartSchema$1, c as createEmergingPartSchema$1, a as getPartDetailSchema$1, b as getPartByIdSchema$1, s as searchPartsSchema$1 } from '../part-schemas.mjs';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { r as resolveUserId, d as devLog, a as dev, b as requiresUserConfirmation } from '../dev.mjs';
import { c as createClient, a as createAdminClient } from '../admin.mjs';
import '@supabase/supabase-js';

function nowIso() {
  try {
    return (/* @__PURE__ */ new Date()).toISOString();
  } catch {
    return "";
  }
}
function toNumber(n) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : void 0;
}
function recordSnapshotUsage(kind, status, extra) {
  try {
    const line = {
      ts: nowIso(),
      tag: "MemoryV2",
      event: "snapshot_usage",
      kind,
      status,
      latency_ms: toNumber(extra?.latencyMs),
      user_id: extra?.userId,
      part_id: extra?.partId,
      rel_id: extra?.relId,
      error: extra?.error ? String(extra.error?.message || extra.error) : void 0
    };
    console.log(JSON.stringify(line));
  } catch {
  }
}

const searchPartsSchema = z.object({
  query: z.string().optional().describe("Search query for part names or roles"),
  status: z.enum(["emerging", "acknowledged", "active", "integrated"]).optional().describe("Filter by part status"),
  category: z.enum(["manager", "firefighter", "exile", "unknown"]).optional().describe("Filter by part category"),
  limit: z.number().min(1).max(50).default(20).describe("Maximum number of results to return"),
  userId: z.string().uuid().optional().describe("User ID for the search (optional in development mode)")
});
const getPartByIdSchema = z.object({
  partId: z.string().uuid().describe("The UUID of the part to retrieve"),
  userId: z.string().uuid().optional().describe("User ID who owns the part (optional in development mode)")
});
const getPartDetailSchema = z.object({
  partId: z.string().uuid().describe("The UUID of the part to retrieve details for"),
  userId: z.string().uuid().optional().describe("User ID who owns the part (optional in development mode)")
});
const createEmergingPartSchema = z.object({
  name: z.string().min(1).max(100).describe("Name of the emerging part"),
  evidence: z.array(z.object({
    type: z.enum(["direct_mention", "pattern", "behavior", "emotion"]),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    sessionId: z.string().uuid(),
    timestamp: z.string().datetime()
  })).min(3).describe("Evidence supporting the part (minimum 3 required)"),
  category: z.enum(["manager", "firefighter", "exile", "unknown"]).optional().default("unknown"),
  age: z.number().min(0).max(100).optional().describe("Perceived age of the part"),
  role: z.string().optional().describe("Role or function of the part"),
  triggers: z.array(z.string()).optional().default([]).describe("Known triggers for this part"),
  emotions: z.array(z.string()).optional().default([]).describe("Emotions associated with this part"),
  beliefs: z.array(z.string()).optional().default([]).describe("Beliefs held by this part"),
  somaticMarkers: z.array(z.string()).optional().default([]).describe("Physical sensations associated with this part"),
  userId: z.string().uuid().optional().describe("User ID who owns the part (optional in development mode)"),
  userConfirmed: z.boolean().describe("Whether the user has confirmed this part exists through chat interaction")
});
const updatePartSchema = z.object({
  partId: z.string().uuid().describe("The UUID of the part to update"),
  userId: z.string().uuid().optional().describe("User ID who owns the part (optional in development mode)"),
  updates: z.object({
    name: z.string().min(1).max(100).optional(),
    status: z.enum(["emerging", "acknowledged", "active", "integrated"]).optional(),
    category: z.enum(["manager", "firefighter", "exile", "unknown"]).optional(),
    age: z.number().min(0).max(100).optional(),
    role: z.string().optional(),
    triggers: z.array(z.string()).optional(),
    emotions: z.array(z.string()).optional(),
    beliefs: z.array(z.string()).optional(),
    somaticMarkers: z.array(z.string()).optional(),
    visualization: z.object({
      emoji: z.string(),
      color: z.string()
    }).optional(),
    confidenceBoost: z.number().min(0).max(1).optional().describe("Amount to adjust identification confidence by (explicit only)"),
    last_charged_at: z.string().datetime().optional().describe("Timestamp for when the part's charge was last updated"),
    last_charge_intensity: z.number().min(0).max(1).optional().describe("Intensity of the part's last charge (0 to 1)")
  }).describe("Fields to update"),
  evidence: z.object({
    type: z.enum(["direct_mention", "pattern", "behavior", "emotion"]),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    sessionId: z.string().uuid(),
    timestamp: z.string().datetime()
  }).optional().describe("New evidence to add for this update"),
  auditNote: z.string().optional().describe("Note about why this update was made")
});
const getPartRelationshipsSchema = z.object({
  userId: z.string().uuid().optional().describe("User ID to get relationships for (optional in development mode)"),
  partId: z.string().uuid().optional().describe("Optional: Get relationships for specific part"),
  relationshipType: z.enum(["polarized", "protector-exile", "allied"]).optional().describe("Optional: Filter by relationship type"),
  status: z.enum(["active", "healing", "resolved"]).optional().describe("Optional: Filter by relationship status"),
  includePartDetails: z.boolean().default(false).describe("Include part names and status in response"),
  limit: z.number().min(1).max(50).default(20).describe("Maximum number of relationships to return")
});
const logRelationshipSchema = z.object({
  userId: z.string().uuid().optional().describe("User ID who owns the relationship (optional in development mode)"),
  partIds: z.array(z.string().uuid()).min(2).max(2).describe("Exactly two part IDs involved in the relationship"),
  type: z.enum(["polarized", "protector-exile", "allied"]).describe("Relationship type"),
  description: z.string().optional().describe("Short description of the relationship"),
  issue: z.string().optional().describe("Primary point of conflict or issue"),
  commonGround: z.string().optional().describe("Areas of agreement or shared goals"),
  status: z.enum(["active", "healing", "resolved"]).optional().describe("Relationship status"),
  polarizationLevel: z.number().min(0).max(1).optional().describe("Absolute polarization level to set (0..1)"),
  dynamic: z.object({
    observation: z.string().min(1).describe("What was noticed about the interaction"),
    context: z.string().min(1).describe("Context where this dynamic occurred"),
    polarizationChange: z.number().min(-1).max(1).optional().describe("Relative change in polarization (-1..1)"),
    timestamp: z.string().datetime().optional().describe("When this dynamic occurred (defaults to now)")
  }).optional(),
  lastAddressed: z.string().datetime().optional().describe("When this relationship was last addressed"),
  upsert: z.boolean().default(true).describe("Update existing relationship if it exists; otherwise create")
});
function getSupabaseClient() {
  if (typeof window !== "undefined") {
    return createClient();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\nMissing NEXT_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.\nCheck your .env and ensure the Mastra dev server is loading it (npm run dev:mastra -- --env .env)."
    );
  }
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (dev.enabled && serviceRole) {
    return createAdminClient();
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {
      }
    }
  });
}
async function searchParts(input) {
  try {
    const validated = searchPartsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    devLog("searchParts called", { userId, query: validated.query });
    let query = supabase.from("parts").select("*").eq("user_id", userId).order("last_active", { ascending: false }).limit(validated.limit);
    if (validated.query) {
      query = query.or(`name.ilike.%${validated.query}%,role.ilike.%${validated.query}%`);
    }
    if (validated.status) {
      query = query.eq("status", validated.status);
    }
    if (validated.category) {
      query = query.eq("category", validated.category);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    return data || [];
  } catch (error) {
    const errMsg = error instanceof Error ? dev.verbose ? error.stack || error.message : error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}
async function getPartById(input) {
  try {
    const validated = getPartByIdSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    devLog("getPartById called", { userId, partId: validated.partId });
    const { data, error } = await supabase.from("parts").select("*").eq("id", validated.partId).eq("user_id", userId).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }
    let snapshot_sections = void 0;
    if (typeof window === "undefined" && isMemoryV2Enabled() && data) {
      const t0 = Date.now();
      try {
        const { readPartProfileSections } = await import('../read.mjs');
        snapshot_sections = await readPartProfileSections(userId, validated.partId);
        recordSnapshotUsage("part_profile", snapshot_sections ? "hit" : "miss", { latencyMs: Date.now() - t0, userId, partId: validated.partId });
      } catch (e) {
        recordSnapshotUsage("part_profile", "error", { latencyMs: Date.now() - t0, userId, partId: validated.partId, error: e });
        try {
          devLog("readPartProfileSections error", { e });
        } catch {
        }
      }
    }
    return snapshot_sections ? { ...data, snapshot_sections } : data;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}
async function getPartDetail(input) {
  try {
    const validated = getPartDetailSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    devLog("getPartDetail called", { userId, partId: validated.partId });
    const { data: part, error: partError } = await supabase.from("parts").select("*").eq("id", validated.partId).eq("user_id", userId).single();
    if (partError) {
      throw new Error(`Database error (part): ${partError.message}`);
    }
    if (!part) {
      throw new Error("Part not found");
    }
    const { data: relationships, error: relationshipsError } = await supabase.from("part_relationships").select("*").eq("user_id", userId).contains("parts", [validated.partId]);
    if (relationshipsError) {
      throw new Error(`Database error (relationships): ${relationshipsError.message}`);
    }
    let overview_sections = void 0;
    let part_profile_sections = void 0;
    let relationship_profiles = void 0;
    if (typeof window === "undefined" && isMemoryV2Enabled()) {
      const t0 = Date.now();
      try {
        const rels = relationships || [];
        const { readOverviewSections, readPartProfileSections, readRelationshipProfileSections } = await import('../read.mjs');
        const reads = [
          (async () => {
            const s = await readOverviewSections(userId);
            recordSnapshotUsage("overview", s ? "hit" : "miss", { latencyMs: Date.now() - t0, userId });
            return s;
          })(),
          (async () => {
            const s = await readPartProfileSections(userId, validated.partId);
            recordSnapshotUsage("part_profile", s ? "hit" : "miss", { latencyMs: Date.now() - t0, userId, partId: validated.partId });
            return s;
          })(),
          Promise.all(rels.map(async (r) => {
            const tRel = Date.now();
            try {
              const m = await readRelationshipProfileSections(userId, r.id);
              recordSnapshotUsage("relationship_profile", m ? "hit" : "miss", { latencyMs: Date.now() - tRel, userId, relId: r.id });
              return m;
            } catch (e) {
              recordSnapshotUsage("relationship_profile", "error", { latencyMs: Date.now() - tRel, userId, relId: r.id, error: e });
              return null;
            }
          }))
        ];
        const [ovv, partProf, relMaps] = await Promise.all(reads);
        overview_sections = ovv || void 0;
        part_profile_sections = partProf || void 0;
        if (relMaps && relMaps.length > 0) {
          relationship_profiles = {};
          rels.forEach((r, idx) => {
            const m = relMaps[idx];
            if (m) relationship_profiles[r.id] = m;
          });
        }
      } catch (e) {
        try {
          devLog("snapshot read (detail) error", { e });
        } catch {
        }
      }
    }
    return {
      ...part,
      relationships: relationships || [],
      ...overview_sections || part_profile_sections || relationship_profiles ? { snapshots: { overview_sections, part_profile_sections, relationship_profiles } } : {}
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}
async function createEmergingPart(input) {
  try {
    const validated = createEmergingPartSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    if (validated.evidence.length < 3) {
      throw new Error("Cannot create emerging part: At least 3 pieces of evidence are required");
    }
    if (requiresUserConfirmation(validated.userConfirmed)) {
      throw new Error("Cannot create emerging part: User confirmation is required through chat interaction");
    }
    const supabase = getSupabaseClient();
    devLog("createEmergingPart called", { userId, partName: validated.name, evidenceCount: validated.evidence.length });
    const { data: existingPart } = await supabase.from("parts").select("id, name").eq("user_id", userId).eq("name", validated.name).single();
    if (existingPart) {
      throw new Error(`A part named "${validated.name}" already exists for this user`);
    }
    const avgEvidenceConfidence = validated.evidence.reduce((sum, ev) => sum + ev.confidence, 0) / validated.evidence.length;
    const initialConfidence = Math.min(0.95, avgEvidenceConfidence * 0.8);
    const partInsert = {
      user_id: userId,
      name: validated.name,
      status: "emerging",
      category: validated.category,
      age: validated.age,
      role: validated.role,
      triggers: validated.triggers,
      emotions: validated.emotions,
      beliefs: validated.beliefs,
      somatic_markers: validated.somaticMarkers,
      confidence: initialConfidence,
      evidence_count: validated.evidence.length,
      recent_evidence: validated.evidence,
      story: {
        origin: null,
        currentState: `Newly discovered part with ${validated.evidence.length} pieces of evidence`,
        purpose: validated.role || null,
        evolution: [{
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          change: "Part created",
          trigger: "Evidence threshold reached"
        }]
      },
      visualization: {
        emoji: "\u{1F917}",
        color: "#6B7280",
        energyLevel: 0.5
      }
    };
    const { actionLogger } = await import('../action-logger.mjs').then(function (n) { return n.b; });
    const data = await actionLogger.loggedInsert(
      "parts",
      partInsert,
      userId,
      "create_emerging_part",
      {
        partName: validated.name,
        changeDescription: `Created emerging part with ${validated.evidence.length} pieces of evidence`,
        sessionId: validated.evidence[0]?.sessionId,
        evidenceCount: validated.evidence.length,
        category: validated.category,
        confidence: initialConfidence
      }
    );
    return data;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}
async function updatePart(input) {
  try {
    const validated = updatePartSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    devLog("updatePart called", { userId, partId: validated.partId });
    const { data: currentPart, error: fetchError } = await supabase.from("parts").select("*").eq("id", validated.partId).eq("user_id", userId).single();
    if (fetchError) {
      throw new Error(`Failed to fetch part: ${fetchError.message}`);
    }
    if (!currentPart) {
      throw new Error("Part not found or access denied");
    }
    const updates = {
      ...validated.updates,
      last_active: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (validated.updates.visualization) {
      const currentVis = currentPart.visualization || {};
      const nextVis = { ...currentVis, ...validated.updates.visualization };
      if (typeof nextVis.energyLevel !== "number") {
        nextVis.energyLevel = currentVis.energyLevel ?? 0.5;
      }
      updates.visualization = nextVis;
    }
    if (typeof validated.updates.confidenceBoost === "number") {
      updates.confidence = Math.min(1, Math.max(0, currentPart.confidence + validated.updates.confidenceBoost));
    }
    if (validated.evidence) {
      const currentEvidence = currentPart.recent_evidence || [];
      const newEvidence = [...currentEvidence, validated.evidence].slice(-10);
      updates.recent_evidence = newEvidence;
      updates.evidence_count = currentPart.evidence_count + 1;
    }
    const currentStory = currentPart.story || { origin: null, currentState: null, purpose: null, evolution: [] };
    const evolutionEntry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      change: validated.auditNote || "Part updated",
      trigger: "Agent tool update"
    };
    updates.story = {
      ...currentStory,
      evolution: [...currentStory.evolution || [], evolutionEntry]
    };
    if (validated.updates.somaticMarkers) {
      const somaticMarkersValue = validated.updates.somaticMarkers;
      delete updates.somaticMarkers;
      updates.somatic_markers = somaticMarkersValue;
    }
    let actionType = "update_part_attributes";
    let changeDescription = "Updated part attributes";
    if (validated.updates.name && validated.updates.name !== currentPart.name) {
      changeDescription = `renamed part from "${currentPart.name}" to "${validated.updates.name}"`;
    } else if (validated.updates.visualization) {
      changeDescription = "updated part visualization";
    } else if (typeof validated.updates.last_charge_intensity === "number") {
      actionType = "update_part_charge";
      changeDescription = `updated part charge to ${validated.updates.last_charge_intensity.toFixed(2)}`;
    } else if (typeof validated.updates.confidenceBoost === "number") {
      actionType = "update_part_confidence";
      const toVal = updates.confidence ?? currentPart.confidence;
      const direction = validated.updates.confidenceBoost >= 0 ? "increased" : "decreased";
      changeDescription = `${direction} confidence from ${currentPart.confidence} to ${toVal}`;
    } else if (validated.updates.category && validated.updates.category !== currentPart.category) {
      actionType = "update_part_category";
      changeDescription = `changed category from ${currentPart.category} to ${validated.updates.category}`;
    } else if (validated.evidence) {
      actionType = "add_part_evidence";
      changeDescription = `added evidence: ${validated.evidence.content.substring(0, 50)}...`;
    }
    const { actionLogger } = await import('../action-logger.mjs').then(function (n) { return n.b; });
    const data = await actionLogger.loggedUpdate(
      "parts",
      validated.partId,
      updates,
      userId,
      actionType,
      {
        partName: currentPart.name,
        changeDescription,
        confidenceDelta: validated.updates.confidenceBoost,
        categoryChange: validated.updates.category ? {
          from: currentPart.category,
          to: validated.updates.category
        } : void 0,
        evidenceAdded: !!validated.evidence,
        fieldChanged: Object.keys(validated.updates).join(", "),
        auditNote: validated.auditNote
      }
    );
    return data;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}
async function getPartRelationships(input) {
  try {
    const validated = getPartRelationshipsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    devLog("getPartRelationships called", { userId, partId: validated.partId });
    let query = supabase.from("part_relationships").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(validated.limit);
    if (validated.relationshipType) {
      query = query.eq("type", validated.relationshipType);
    }
    if (validated.status) {
      query = query.eq("status", validated.status);
    }
    const { data: relationships, error } = await query;
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    if (!relationships || relationships.length === 0) {
      return [];
    }
    let filtered = relationships;
    if (validated.partId) {
      const pid = validated.partId;
      filtered = relationships.filter((rel) => {
        const partIds = Array.isArray(rel.parts) ? rel.parts : [];
        return partIds.includes(pid);
      });
    }
    let partsDetails = {};
    if (validated.includePartDetails) {
      const allPartIds = filtered.reduce((acc, rel) => {
        const partIds = Array.isArray(rel.parts) ? rel.parts : [];
        return [...acc, ...partIds];
      }, []);
      const uniquePartIds = [...new Set(allPartIds)];
      if (uniquePartIds.length > 0) {
        const { data: parts, error: partsError } = await supabase.from("parts").select("id, name, status").eq("user_id", userId).in("id", uniquePartIds);
        if (partsError) {
          throw new Error(`Error fetching part details: ${partsError.message}`);
        }
        partsDetails = (parts || []).reduce((acc, part) => {
          acc[part.id] = { name: part.name, status: part.status };
          return acc;
        }, {});
      }
    }
    let relSectionMaps;
    if (typeof window === "undefined" && isMemoryV2Enabled()) {
      try {
        const { readRelationshipProfileSections } = await import('../read.mjs');
        relSectionMaps = await Promise.all(
          filtered.map(async (rel) => {
            const tRel = Date.now();
            try {
              const m = await readRelationshipProfileSections(userId, rel.id);
              recordSnapshotUsage("relationship_profile", m ? "hit" : "miss", { latencyMs: Date.now() - tRel, userId, relId: rel.id });
              return m;
            } catch (e) {
              recordSnapshotUsage("relationship_profile", "error", { latencyMs: Date.now() - tRel, userId, relId: rel.id, error: e });
              return null;
            }
          })
        );
      } catch (e) {
        try {
          devLog("snapshot read (relationships) error", { e });
        } catch {
        }
      }
    }
    const formattedRelationships = filtered.map((rel, idx) => {
      const partIds = Array.isArray(rel.parts) ? rel.parts : [];
      const snapshot_sections = relSectionMaps ? relSectionMaps[idx] : void 0;
      return {
        id: rel.id,
        type: rel.type,
        status: rel.status,
        description: rel.description,
        issue: rel.issue,
        common_ground: rel.common_ground,
        polarization_level: rel.polarization_level,
        dynamics: rel.dynamics || [],
        parts: partIds.map((partId) => ({
          id: partId,
          ...validated.includePartDetails && partsDetails[partId] ? {
            name: partsDetails[partId].name,
            status: partsDetails[partId].status
          } : {}
        })),
        last_addressed: rel.last_addressed,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
        ...snapshot_sections ? { snapshot_sections } : {}
      };
    });
    return formattedRelationships;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}
async function logRelationship(input) {
  try {
    const validated = logRelationshipSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    const partIds = [...validated.partIds].sort();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const dyn = validated.dynamic ? {
      timestamp: validated.dynamic.timestamp || nowIso,
      observation: validated.dynamic.observation,
      context: validated.dynamic.context,
      polarizationChange: typeof validated.dynamic.polarizationChange === "number" ? validated.dynamic.polarizationChange : void 0
    } : void 0;
    try {
      devLog("logRelationship called", { userId, partIds, type: validated.type });
    } catch {
    }
    let existing = null;
    if (validated.upsert) {
      const { data: candidates, error: findErr } = await supabase.from("part_relationships").select("*").eq("user_id", userId).eq("type", validated.type).order("created_at", { ascending: false }).limit(50);
      if (findErr) {
        throw new Error(`Database error (find): ${findErr.message}`);
      }
      existing = (candidates || []).find((r) => {
        const p = Array.isArray(r?.parts) ? r.parts : [];
        if (p.length !== 2) return false;
        const sorted = [...p].sort();
        return sorted[0] === partIds[0] && sorted[1] === partIds[1];
      }) || null;
    }
    if (existing) {
      const updates = {};
      let polarizationDelta;
      if (dyn) {
        const currentDynamics = existing.dynamics || [];
        updates.dynamics = [...currentDynamics, dyn];
        updates.last_addressed = validated.lastAddressed || dyn.timestamp;
        if (typeof dyn.polarizationChange === "number") {
          polarizationDelta = dyn.polarizationChange;
        }
      } else if (validated.lastAddressed) {
        updates.last_addressed = validated.lastAddressed;
      }
      if (typeof validated.description === "string") updates.description = validated.description;
      if (typeof validated.issue === "string") updates.issue = validated.issue;
      if (typeof validated.commonGround === "string") updates.common_ground = validated.commonGround;
      if (validated.status) updates.status = validated.status;
      const currentPolRaw = existing.polarization_level;
      const currentPol = typeof currentPolRaw === "number" ? currentPolRaw : parseFloat(String(currentPolRaw ?? 0.5));
      const providedAbs = validated.polarizationLevel;
      const delta = dyn && typeof dyn.polarizationChange === "number" ? parseFloat(String(dyn.polarizationChange)) : void 0;
      const computedPol = typeof providedAbs === "number" ? parseFloat(String(providedAbs)) : typeof delta === "number" ? Math.min(1, Math.max(0, currentPol + delta)) : currentPol;
      try {
        devLog("logRelationship polarization compute", { currentPol, computedPol, delta, types: { current: typeof currentPol, computed: typeof computedPol, deltaType: typeof delta } });
      } catch {
      }
      if (!dev.disablePolarizationUpdate) {
        if (computedPol !== currentPol) updates.polarization_level = computedPol;
      }
      updates.updated_at = nowIso;
      const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (typeof window === "undefined" && dev.enabled && serviceRole) {
        try {
          devLog("logRelationship update payload", updates);
          const { data: updatedDirect, error: updErr } = await supabase.from("part_relationships").update(updates).eq("id", existing.id).eq("user_id", userId).select("*").single();
          if (updErr || !updatedDirect) {
            throw new Error(`Failed to update relationship (service role): ${updErr?.message || "unknown"}`);
          }
          await supabase.from("agent_actions").insert({
            user_id: userId,
            action_type: "update_relationship",
            target_table: "part_relationships",
            target_id: existing.id,
            old_state: existing,
            new_state: updatedDirect,
            metadata: {
              changeDescription: dyn ? `Appended dynamic: ${dyn.observation.substring(0, 60)}...` : "Updated relationship fields",
              polarizationDelta,
              type: validated.type,
              partIds
            },
            created_by: "agent"
          });
          return updatedDirect;
        } catch (e) {
          throw new Error(`UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}`);
        }
      }
      try {
        const { actionLogger: actionLogger2 } = await import('../action-logger.mjs').then(function (n) { return n.b; });
        const updated = await actionLogger2.loggedUpdate(
          "part_relationships",
          existing.id,
          updates,
          userId,
          "update_relationship",
          {
            changeDescription: dyn ? `Appended dynamic: ${dyn.observation.substring(0, 60)}...` : "Updated relationship fields",
            polarizationDelta,
            type: validated.type,
            partIds
          }
        );
        return updated;
      } catch (e) {
        throw new Error(`LOGGED_UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}`);
      }
    }
    const insert = {
      user_id: userId,
      parts: partIds,
      type: validated.type,
      description: validated.description,
      issue: validated.issue || void 0,
      common_ground: validated.commonGround || void 0,
      dynamics: dyn ? [dyn] : [],
      status: validated.status || "active",
      polarization_level: typeof validated.polarizationLevel === "number" ? validated.polarizationLevel : 0.5,
      last_addressed: validated.lastAddressed || (dyn ? dyn.timestamp : null),
      created_at: nowIso,
      updated_at: nowIso
    };
    const serviceRoleCreate = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (typeof window === "undefined" && dev.enabled && serviceRoleCreate) {
      const { data: createdDirect, error: insErr } = await supabase.from("part_relationships").insert(insert).select("*").single();
      if (insErr || !createdDirect) {
        throw new Error(`Failed to create relationship (service role): ${insErr?.message || "unknown"}`);
      }
      await supabase.from("agent_actions").insert({
        user_id: userId,
        action_type: "create_relationship",
        target_table: "part_relationships",
        target_id: createdDirect.id,
        old_state: null,
        new_state: createdDirect,
        metadata: {
          changeDescription: `Created ${validated.type} relationship between parts`,
          type: validated.type,
          partIds
        },
        created_by: "agent"
      });
      return createdDirect;
    }
    const { actionLogger } = await import('../action-logger.mjs').then(function (n) { return n.b; });
    const created = await actionLogger.loggedInsert(
      "part_relationships",
      insert,
      userId,
      "create_relationship",
      {
        changeDescription: `Created ${validated.type} relationship between parts`,
        type: validated.type,
        partIds
      }
    );
    return created;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(errMsg);
  }
}

function getPartTools(userId) {
  return {
    searchParts: createTool({
      id: "searchParts",
      description: "Search for parts based on query, status, or category",
      inputSchema: searchPartsSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await searchParts(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
    getPartById: createTool({
      id: "getPartById",
      description: "Get a specific part by its ID",
      inputSchema: getPartByIdSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await getPartById(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
    getPartDetail: createTool({
      id: "getPartDetail",
      description: "Retrieves a complete dossier for a given part, including core attributes, relationships, and recent evidence.",
      inputSchema: getPartDetailSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await getPartDetail(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
    createEmergingPart: createTool({
      id: "createEmergingPart",
      description: "Create a new emerging part (requires 3+ evidence and user confirmation)",
      inputSchema: createEmergingPartSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await createEmergingPart(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
    updatePart: createTool({
      id: "updatePart",
      description: "Update an existing part with confidence increment and audit trail",
      inputSchema: updatePartSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await updatePart(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
    getPartRelationships: createTool({
      id: "getPartRelationships",
      description: "Get part relationships with optional filtering by part, type, status, and include part details",
      inputSchema: getPartRelationshipsSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await getPartRelationships(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
    logRelationship: createTool({
      id: "logRelationship",
      description: "Create or update a relationship between two parts; optionally append a dynamic observation and adjust polarization.",
      inputSchema: logRelationshipSchema$1,
      execute: async ({ context }) => {
        const secureContext = { ...context, userId };
        try {
          return await logRelationship(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    })
  };
}

export { getPartTools };
