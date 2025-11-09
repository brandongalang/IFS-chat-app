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
  // Allow explicit bypass via label
  const labels = readEventLabels();
  if (labels.includes('docs:skip')) {
    console.log('docs-reminder: bypassed via docs:skip label');
    return;
  }

  const docmapPath = path.join(process.cwd(), 'docs/.docmap.json');
  if (!existsSync(docmapPath)) {
    console.log('docs-reminder: no docs/.docmap.json found; skipping');
    return;
  }

  const docmap = JSON.parse(readFileSync(docmapPath, 'utf8'));
  const base = process.env.BASE_SHA || '';
  const head = process.env.HEAD_SHA || '';

  if (!base || !head) {
    console.log('docs-reminder: BASE_SHA/HEAD_SHA not set; skipping');
    return;
  }

  const changed = getChangedFiles(base, head);
  const changedSet = new Set(changed);

  // Check if any mapped code paths were changed
  let needsDocs = false;
  for (const mapping of docmap.mappings || []) {
    const patterns = (mapping.paths || []).map(globToRegExp);
    const touchesMappedCode = changed.some((f) => patterns.some((re) => re.test(f)));
    
    if (!touchesMappedCode) continue;

    // Code was touched, but check if docs were updated
    const expectedDocs = mapping.docs || [];
    const docsTouched = expectedDocs.some((d) => changedSet.has(d));
    
    if (!docsTouched) {
      needsDocs = true;
      console.log(`Changed code paths: ${mapping.paths.join(', ')}`);
      console.log(`Expected docs: ${expectedDocs.join(', ')}`);
      break;
    }
  }

  if (needsDocs) {
    console.log('docs-reminder: Code changes detected that may require docs updates');
    // Set output for GitHub Actions to use
    console.log('::set-output name=needs-docs::true');
  } else {
    console.log('docs-reminder: All relevant docs updated or no docs mapping required');
    console.log('::set-output name=needs-docs::false');
  }
}

main();
