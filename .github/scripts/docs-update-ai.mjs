import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Reuse the existing globToRegExp function from docs-check.mjs
function globToRegExp(glob) {
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

function getFileDiff(base, head, filepath) {
  try {
    const cmd = `git diff ${base}...${head} -- "${filepath}"`;
    return execSync(cmd, { encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

function getPRContext() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    return {
      title: event?.pull_request?.title || '',
      body: event?.pull_request?.body || '',
      labels: (event?.pull_request?.labels || []).map(l => l.name)
    };
  } catch (e) {
    return null;
  }
}

function runOpenCode(prompt) {
  try {
    // Escape quotes in prompt for shell safety and limit length
    const truncatedPrompt = prompt.length > 8000 ? prompt.substring(0, 8000) + '...' : prompt;
    const escapedPrompt = truncatedPrompt.replace(/"/g, '\\"').replace(/`/g, '\\`');
    
    // Use the -p flag for non-interactive mode with environment variable
    const result = execSync(`GOOGLE_API_KEY="${process.env.GOOGLE_API_KEY}" opencode -p "${escapedPrompt}"`, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      timeout: 120000, // 2 minute timeout (reduced for CI)
      env: {
        ...process.env,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY
      }
    });
    return result;
  } catch (error) {
    console.error('OpenCode execution failed:', error.message);
    console.error('This may be due to API limits or configuration issues');
    return null;
  }
}

function analyzeCodeChanges(changedFiles, base, head) {
  const analyses = [];
  
  for (const file of changedFiles) {
    // Skip documentation files and non-code files
    if (file.startsWith('docs/') || file.startsWith('.github/') || 
        file.endsWith('.md') || file.endsWith('.json')) {
      continue;
    }
    
    const diff = getFileDiff(base, head, file);
    if (!diff) continue;
    
    const prompt = `Analyze this code change and summarize what functionality was modified:

File: ${file}
Changes:
${diff}

Provide a concise summary of:
1. What feature/functionality was changed
2. New APIs or interfaces added
3. Behavior changes that would affect documentation
4. Key implementation details that should be documented

Keep the response focused and under 200 words.`;
    
    const analysis = runOpenCode(prompt);
    if (analysis) {
      analyses.push({ file, analysis: analysis.trim() });
    }
  }
  
  return analyses;
}

function generateDocumentationUpdate(docFile, codeChanges, prContext) {
  const currentDoc = existsSync(docFile) ? readFileSync(docFile, 'utf8') : '';
  
  const changesContext = codeChanges.map(c => 
    `File: ${c.file}\nChanges: ${c.analysis}`
  ).join('\n\n');
  
  const prompt = `You are a technical writer updating documentation based on code changes in a PR.

PR Context:
Title: ${prContext?.title || 'Code changes'}
Description: ${prContext?.body || 'No description provided'}

Code Changes Analysis:
${changesContext}

Current Documentation:
${currentDoc || '(No existing documentation)'}

Task: Update the documentation to reflect the code changes. Follow these guidelines:

1. **Maintain existing structure and formatting**
2. **Update code paths and file references** to match current structure
3. **Add new sections for significant new features** using consistent markdown formatting
4. **Update implementation details** where code has changed
5. **Preserve existing content** that's still relevant
6. **Use consistent markdown formatting** with proper headers, code blocks, and lists
7. **Include code examples** where helpful for new functionality
8. **Update any outdated information** based on the changes

If this is a new feature that doesn't have existing documentation, create comprehensive documentation following established patterns.

Return only the updated documentation content in markdown format. Do not include explanations or metadata - just the documentation content.`;

  return runOpenCode(prompt);
}

function shouldCreateNewFeatureDoc(changedFiles, analyses) {
  // Only consider creating new docs for substantial changes
  if (analyses.length === 0) return null;
  
  const prompt = `Based on these code changes, determine if a new feature documentation file should be created:

Changed Files: ${changedFiles.join(', ')}

Code Analysis:
${analyses.map(a => `${a.file}: ${a.analysis}`).join('\n')}

Answer with JSON in this exact format:
{
  "createNew": true/false,
  "featureName": "feature-name-for-filename",
  "reason": "explanation of why new doc is/isn't needed"
}

Create a new doc if:
- This introduces a completely new user-facing feature
- New API endpoints or major functionality
- New UI components or user flows
- Features that don't fit well in existing docs

Don't create new docs for:
- Bug fixes or small improvements
- Internal refactoring
- Updates to existing features`;

  const response = runOpenCode(prompt);
  if (!response) return null;
  
  try {
    const cleaned = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse new feature analysis:', e.message);
    return null;
  }
}

async function main() {
  // Skip if bypassed
  if (process.env.DOCS_SKIP === 'true') {
    console.log('docs-update-ai: bypassed via DOCS_SKIP env');
    return;
  }

  const prContext = getPRContext();
  if (prContext?.labels.includes('docs:skip')) {
    console.log('docs-update-ai: bypassed via docs:skip label');
    return;
  }

  const docmapPath = path.join(process.cwd(), 'docs/.docmap.json');
  if (!existsSync(docmapPath)) {
    console.log('docs-update-ai: no docs/.docmap.json found; skipping');
    return;
  }

  const docmap = JSON.parse(readFileSync(docmapPath, 'utf8'));
  const base = process.env.BASE_SHA || '';
  const head = process.env.HEAD_SHA || '';
  
  if (!base || !head) {
    console.log('docs-update-ai: BASE_SHA/HEAD_SHA not set; skipping');
    return;
  }

  const changedFiles = getChangedFiles(base, head);
  if (changedFiles.length === 0) {
    console.log('docs-update-ai: no files changed');
    return;
  }

  console.log(`Analyzing ${changedFiles.length} changed files...`);
  const codeAnalyses = analyzeCodeChanges(changedFiles, base, head);
  
  if (codeAnalyses.length === 0) {
    console.log('docs-update-ai: no code changes requiring documentation updates');
    return;
  }

  // Check if we should create a new feature doc
  const newFeatureCheck = shouldCreateNewFeatureDoc(changedFiles, codeAnalyses);
  if (newFeatureCheck?.createNew) {
    console.log(`Creating new feature documentation: ${newFeatureCheck.featureName}`);
    console.log(`Reason: ${newFeatureCheck.reason}`);
    
    const newDocPath = `docs/features/${newFeatureCheck.featureName}.md`;
    const newDocContent = generateDocumentationUpdate(newDocPath, codeAnalyses, prContext);
    
    if (newDocContent && newDocContent.trim() !== '') {
      writeFileSync(newDocPath, newDocContent);
      console.log(`Created: ${newDocPath}`);
      
      // Add to docmap for future updates
      const relevantPaths = changedFiles.filter(f => 
        !f.startsWith('docs/') && 
        !f.startsWith('.github/') && 
        !f.endsWith('.md')
      );
      if (relevantPaths.length > 0) {
        docmap.mappings.push({
          paths: relevantPaths,
          docs: [newDocPath]
        });
        writeFileSync(docmapPath, JSON.stringify(docmap, null, 2));
        console.log(`Updated docmap.json with new mapping`);
      }
    }
  }

  // Update existing mapped documentation
  const updatedDocs = new Set();
  
  for (const mapping of docmap.mappings || []) {
    const patterns = (mapping.paths || []).map(globToRegExp);
    const matchingChanges = codeAnalyses.filter(change => 
      patterns.some(pattern => pattern.test(change.file))
    );
    
    if (matchingChanges.length === 0) continue;
    
    for (const docFile of mapping.docs || []) {
      if (updatedDocs.has(docFile)) continue;
      
      console.log(`Updating documentation: ${docFile}`);
      const updatedContent = generateDocumentationUpdate(docFile, matchingChanges, prContext);
      
      if (updatedContent && updatedContent.trim() !== '') {
        writeFileSync(docFile, updatedContent);
        updatedDocs.add(docFile);
        console.log(`Updated: ${docFile}`);
      }
    }
  }

  if (updatedDocs.size === 0 && !newFeatureCheck?.createNew) {
    console.log('docs-update-ai: no documentation updates needed');
  } else {
    console.log(`docs-update-ai: updated ${updatedDocs.size} existing docs, created ${newFeatureCheck?.createNew ? 1 : 0} new docs`);
  }
}

main().catch(console.error);