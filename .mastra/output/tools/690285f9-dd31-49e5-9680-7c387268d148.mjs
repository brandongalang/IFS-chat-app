import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { a as actionLogger } from '../action-logger.mjs';
import { r as resolveUserId, d as devLog, b as requiresUserConfirmation, a as dev } from '../dev.mjs';

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
function getEnvVar(keys) {
  const nodeEnv = typeof process !== "undefined" ? process.env : void 0;
  if (nodeEnv) {
    for (const k of keys) {
      const v = nodeEnv[k];
      if (v) return v;
    }
  }
  let metaEnv;
  try {
    metaEnv = Function("try { return import.meta && import.meta.env } catch (_) { return undefined }")();
  } catch {
    metaEnv = void 0;
  }
  if (metaEnv) {
    for (const k of keys) {
      const v = metaEnv[k];
      if (v) return v;
    }
  }
  return void 0;
}
function getSupabaseClient() {
  const url = getEnvVar(["NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const anonKey = getEnvVar(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  const serviceRole = getEnvVar(["SUPABASE_SERVICE_ROLE_KEY"]);
  if (!url || !anonKey) {
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\nMissing NEXT_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.\nCheck your .env and ensure the Mastra dev server is loading it (npm run dev:mastra -- --env .env)."
    );
  }
  const devEnabled = dev.enabled;
  if (typeof window === "undefined" && devEnabled && serviceRole) {
    return createClient(url, serviceRole);
  }
  if (typeof window !== "undefined") {
    return createClient(url, anonKey);
  } else {
    return createServerClient(url, anonKey, {
      cookies: {
        getAll: () => [],
        setAll: () => {
        }
      }
    });
  }
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
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    return {
      success: true,
      data: data || [],
      confidence: 1
    };
  } catch (error) {
    const errMsg = error instanceof Error ? dev.verbose ? error.stack || error.message : error.message : "Unknown error occurred";
    return { success: false, error: errMsg };
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
        return {
          success: true,
          data: null,
          confidence: 1
        };
      }
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    return {
      success: true,
      data,
      confidence: 1
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
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
      return { success: false, error: `Database error (part): ${partError.message}` };
    }
    if (!part) {
      return { success: false, error: "Part not found" };
    }
    const { data: relationships, error: relationshipsError } = await supabase.from("part_relationships").select("*").eq("user_id", userId).contains("parts", [validated.partId]);
    if (relationshipsError) {
      return { success: false, error: `Database error (relationships): ${relationshipsError.message}` };
    }
    return {
      success: true,
      data: {
        ...part,
        relationships: relationships || []
      },
      confidence: 1
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
async function createEmergingPart(input) {
  try {
    const validated = createEmergingPartSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    if (validated.evidence.length < 3) {
      return {
        success: false,
        error: "Cannot create emerging part: At least 3 pieces of evidence are required",
        confidence: 0
      };
    }
    if (requiresUserConfirmation(validated.userConfirmed)) {
      return {
        success: false,
        error: "Cannot create emerging part: User confirmation is required through chat interaction",
        confidence: 0
      };
    }
    const supabase = getSupabaseClient();
    devLog("createEmergingPart called", { userId, partName: validated.name, evidenceCount: validated.evidence.length });
    const { data: existingPart } = await supabase.from("parts").select("id, name").eq("user_id", userId).eq("name", validated.name).single();
    if (existingPart) {
      return {
        success: false,
        error: `A part named "${validated.name}" already exists for this user`,
        confidence: 0
      };
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
    return {
      success: true,
      data,
      confidence: initialConfidence
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
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
      return {
        success: false,
        error: `Failed to fetch part: ${fetchError.message}`
      };
    }
    if (!currentPart) {
      return {
        success: false,
        error: "Part not found or access denied"
      };
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
    return {
      success: true,
      data,
      confidence: data.confidence
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
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
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    if (!relationships || relationships.length === 0) {
      return {
        success: true,
        data: [],
        confidence: 1
      };
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
          return {
            success: false,
            error: `Error fetching part details: ${partsError.message}`
          };
        }
        partsDetails = (parts || []).reduce((acc, part) => {
          acc[part.id] = { name: part.name, status: part.status };
          return acc;
        }, {});
      }
    }
    const formattedRelationships = filtered.map((rel) => {
      const partIds = Array.isArray(rel.parts) ? rel.parts : [];
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
        updated_at: rel.updated_at
      };
    });
    return {
      success: true,
      data: formattedRelationships,
      confidence: 1
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
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
        return { success: false, error: `Database error (find): ${findErr.message}` };
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
      const serviceRole = getEnvVar(["SUPABASE_SERVICE_ROLE_KEY"]);
      if (typeof window === "undefined" && dev.enabled && serviceRole) {
        try {
          devLog("logRelationship update payload", updates);
          const { data: updatedDirect, error: updErr } = await supabase.from("part_relationships").update(updates).eq("id", existing.id).eq("user_id", userId).select("*").single();
          if (updErr || !updatedDirect) {
            return { success: false, error: `Failed to update relationship (service role): ${updErr?.message || "unknown"}` };
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
          return { success: true, data: updatedDirect, confidence: 1 };
        } catch (e) {
          return { success: false, error: `UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}` };
        }
      }
      try {
        const updated = await actionLogger.loggedUpdate(
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
        return { success: true, data: updated, confidence: 1 };
      } catch (e) {
        return { success: false, error: `LOGGED_UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}` };
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
    const serviceRoleCreate = getEnvVar(["SUPABASE_SERVICE_ROLE_KEY"]);
    if (typeof window === "undefined" && dev.enabled && serviceRoleCreate) {
      const { data: createdDirect, error: insErr } = await supabase.from("part_relationships").insert(insert).select("*").single();
      if (insErr || !createdDirect) {
        return { success: false, error: `Failed to create relationship (service role): ${insErr?.message || "unknown"}` };
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
      return { success: true, data: createdDirect, confidence: 1 };
    }
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
    return { success: true, data: created, confidence: 1 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

export { createEmergingPart, getPartById, getPartDetail, getPartRelationships, logRelationship, searchParts, updatePart };
