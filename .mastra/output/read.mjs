import { g as getStorageAdapter, r as relationshipProfilePath, b as listSections, u as userOverviewPath, a as partProfilePath } from './md.mjs';
import './part-schemas.mjs';
import 'zod';
import './canonicalize.mjs';
import 'node:crypto';

async function readFileText(path) {
  const storage = await getStorageAdapter();
  return await storage.getText(path);
}
function buildSectionMap(text) {
  const sections = listSections(text);
  const lines = text.split(/\r?\n/);
  const map = {};
  for (const s of sections) {
    const body = lines.slice(s.start + 2, s.end).join("\n").trim();
    map[s.anchor] = { heading: s.heading, text: body };
  }
  return map;
}
async function readOverviewSections(userId) {
  const path = userOverviewPath(userId);
  const text = await readFileText(path);
  if (!text) return null;
  return buildSectionMap(text);
}
async function readPartProfileSections(userId, partId) {
  const path = partProfilePath(userId, partId);
  const text = await readFileText(path);
  if (!text) return null;
  return buildSectionMap(text);
}
async function readRelationshipProfileSections(userId, relId) {
  const path = relationshipProfilePath(userId, relId);
  const text = await readFileText(path);
  if (!text) return null;
  return buildSectionMap(text);
}

export { readOverviewSections, readPartProfileSections, readRelationshipProfileSections };
