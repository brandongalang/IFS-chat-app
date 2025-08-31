import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function globToRegExp(glob) {
  // Very small glob -> regex translator supporting **, *, ?
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 2;
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '.';
      i += 1;
    } else if ('+.^$()[]{}|'.includes(c)) {
      re += '\\' + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  re += '$';
  return new RegExp(re);
}

function getChangedFiles(base, head) {
  const cmd = `git diff --name-only ${base}...${head}`;
  const out = execSync(cmd, { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function readEventLabels() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return [];
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const labels = event?.pull_request?.labels || [];
    return labels.map((l) => l.name);
  } catch (e) {
    return [];
  }
}

function main() {
  // Allow explicit bypass via env or label
  if (process.env.DOCS_SKIP === 'true') {
    console.log('docs-check: bypassed via DOCS_SKIP env');
    return;
  }
  const labels = readEventLabels();
  if (labels.includes('docs:skip')) {
    console.log('docs-check: bypassed via docs:skip label');
    return;
  }

  const docmapPath = path.join(process.cwd(), 'docs/.docmap.json');
  if (!existsSync(docmapPath)) {
    console.log('docs-check: no docs/.docmap.json found; skipping');
    return;
  }
  const docmap = JSON.parse(readFileSync(docmapPath, 'utf8'));
  const base = process.env.BASE_SHA || process.env.GITHUB_BASE_SHA || '';
  const head = process.env.HEAD_SHA || process.env.GITHUB_HEAD_SHA || '';
  if (!base || !head) {
    console.log('docs-check: BASE_SHA/HEAD_SHA not set; skipping (fail-open)');
    return;
  }
  const changed = getChangedFiles(base, head);
  const changedSet = new Set(changed);

  const violations = [];
  for (const mapping of docmap.mappings || []) {
    const patterns = (mapping.paths || []).map(globToRegExp);
    const touchesMappedCode = changed.some((f) => patterns.some((re) => re.test(f)));
    if (!touchesMappedCode) continue;

    const expectedDocs = mapping.docs || [];
    const docsTouched = expectedDocs.some((d) => changedSet.has(d));
    if (!docsTouched) {
      violations.push({ mapping, changed });
    }
  }

  if (violations.length > 0) {
    console.error('docs-check: Missing docs updates for some changed areas.');
    for (const v of violations) {
      console.error('- Changed code matched paths:', v.mapping.paths.join(', '));
      console.error('  Expected docs to be updated:', v.mapping.docs.join(', '));
    }
    console.error('\nEither update the mapped docs file(s) or apply the label "docs:skip" with justification.');
    process.exit(1);
  } else {
    console.log('docs-check: All good. Relevant docs updated.');
  }
}

main();

