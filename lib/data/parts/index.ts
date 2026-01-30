// Parts module - V2-only data layer
// Consolidated from parts-lite.ts, parts-server.ts, parts.schema.ts, and schema/parts-agent.ts

// Schemas and types
export * from './schema';

// Client-safe functions (browser Supabase client)
export {
  type PartsLiteDependencies,
  searchParts,
  searchPartsV2,
  getPartById,
  getPartRelationships,
} from './client';

// Server-only functions (admin client) - delegates to agent functions
export {
  type PartsServerDependencies,
  searchParts as searchPartsServer,
  getPartById as getPartByIdServer,
  getPartDetail as getPartDetailServer,
  createEmergingPart as createEmergingPartServer,
  updatePart as updatePartServer,
  upsertPart as upsertPartServer,
  getPartRelationships as getPartRelationshipsServer,
  getPartNotes as getPartNotesServer,
  logRelationship as logRelationshipServer,
  supersedePart as supersedePartServer,
  createSplitChildPart as createSplitChildPartServer,
  deletePart as deletePartServer,
} from './server';

// Agent-facing functions (low-level)
export {
  searchParts as searchPartsAgent,
  getPartById as getPartByIdAgent,
  getPartDetail as getPartDetailAgent,
  updatePart as updatePartAgent,
  upsertPart as upsertPartAgent,
  getPartRelationships as getPartRelationshipsAgent,
  getPartNotes as getPartNotesAgent,
  logRelationship as logRelationshipAgent,
  supersedePart as supersedePartAgent,
  createSplitChildPart as createSplitChildPartAgent,
  deletePart as deletePartAgent,
  type CreateSplitChildPartInput,
  type PartsAgentDependencies,
} from './agent';
