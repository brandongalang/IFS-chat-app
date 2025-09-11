import { d as getStorageMode } from './part-schemas.mjs';
import { c as canonicalizeText, s as sha256Hex } from './canonicalize.mjs';

async function getStorageAdapter() {
  const mode = getStorageMode();
  if (mode === "supabase") {
    const { SupabaseStorageAdapter } = await import('./supabase-storage-adapter.mjs');
    return new SupabaseStorageAdapter();
  }
  if (typeof window !== "undefined") {
    throw new Error("Local filesystem storage is server-only. Avoid calling snapshot storage from client code.");
  }
  const { LocalFsStorageAdapter } = await import('./local-fs-adapter.mjs');
  return new LocalFsStorageAdapter();
}
function partProfilePath(userId, partId) {
  return `users/${userId}/parts/${partId}/profile.md`;
}
function userOverviewPath(userId) {
  return `users/${userId}/overview.md`;
}
function relationshipProfilePath(userId, relId) {
  return `users/${userId}/relationships/${relId}/profile.md`;
}

const ANCHOR_PATTERNS = [
  /^<!--\s*@anchor:\s*(.+?)\s*-->\s*$/,
  /^\[\/\/\]:\s*#\s*\(anchor:\s*(.+?)\s*\)\s*$/
];
function listSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      let j = i + 1;
      let anchor = null;
      while (j < lines.length && lines[j].trim().length === 0) j++;
      if (j < lines.length) {
        const m = ANCHOR_PATTERNS.map((rx) => rx.exec(lines[j])).find(Boolean);
        if (m) anchor = m[1].trim();
      }
      let k = i + 1;
      while (k < lines.length && !lines[k].startsWith("## ")) k++;
      if (anchor) sections.push({ anchor, heading, start: i, end: k });
    }
  }
  return sections;
}
function patchSectionByAnchor(input, anchor, change) {
  const lines = input.split(/\r?\n/);
  const sections = listSections(input);
  const target = sections.find((s) => s.anchor === anchor);
  if (!target) {
    throw new Error(`Section with anchor '${anchor}' not found`);
  }
  const before = canonicalizeText(input);
  let bodyLines = lines.slice(target.start, target.end);
  if (typeof change.replace === "string") {
    const head = bodyLines.slice(0, 2);
    bodyLines = head.concat(canonicalizeText(change.replace).split("\n"));
  } else if (typeof change.append === "string") {
    bodyLines = bodyLines.concat(canonicalizeText(change.append).split("\n"));
  }
  const newLines = lines.slice(0, target.start).concat(bodyLines).concat(lines.slice(target.end));
  const out = canonicalizeText(newLines.join("\n"));
  return {
    text: out,
    beforeHash: "sha256:" + sha256Hex(before),
    afterHash: "sha256:" + sha256Hex(out)
  };
}
function lintMarkdown(text) {
  const warnings = [];
  const sections = listSections(text);
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      const next = lines[i + 1] || "";
      if (!ANCHOR_PATTERNS.some((rx) => rx.test(next))) {
        warnings.push(`Missing anchor marker after H2 at line ${i + 1}`);
      }
    }
  }
  const evidence = sections.find((s) => s.anchor.toLowerCase().includes("evidence"));
  if (evidence) {
    const body = text.split(/\r?\n/).slice(evidence.start, evidence.end).join("\n");
    const bulletCount = (body.match(/^\s*[-*]\s+/gm) || []).length;
    if (bulletCount > 7) warnings.push(`Evidence items exceed soft cap (found ${bulletCount} > 7)`);
  }
  return { warnings, blocked: false };
}

export { partProfilePath as a, listSections as b, getStorageAdapter as g, lintMarkdown as l, patchSectionByAnchor as p, relationshipProfilePath as r, userOverviewPath as u };
