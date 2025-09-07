import { randomUUID, createHmac, createHash } from 'node:crypto';

function canonicalizeText(input) {
  let s = input.replace(/\r\n?/g, "\n");
  s = s.split("\n").map((line) => line.replace(/[\t ]+$/g, "")).join("\n");
  if (!s.endsWith("\n")) s += "\n";
  return s;
}
function canonicalizeJson(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const sort = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const keys = Object.keys(v).sort();
    const out = {};
    for (const k of keys) out[k] = sort(v[k]);
    return out;
  };
  const normalized = sort(value);
  return JSON.stringify(normalized);
}
function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
function hmacSha256Hex(secret, input) {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}
function generateEventId() {
  return randomUUID();
}

export { canonicalizeJson as a, canonicalizeText as c, generateEventId as g, hmacSha256Hex as h, sha256Hex as s };
