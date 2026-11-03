import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

test('Contract - Every message type in README.md has a handler in src/panel.ts and vice versa', () => {
  const rootDir = process.cwd();
  const readmePath = path.join(rootDir, 'ui-placeholder', 'README.md');
  const panelPath = path.join(rootDir, 'src', 'panel.ts');

  assert.ok(fs.existsSync(readmePath), 'ui-placeholder/README.md must exist');
  assert.ok(fs.existsSync(panelPath), 'src/panel.ts must exist');

  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  const panelContent = fs.readFileSync(panelPath, 'utf8');

  // Extract Webview to Extension Host message types from README.md
  // Format in README:
  // ```typescript
  // { type: 'ready' }
  // { type: 'stage:select', ... }
  // ```
  const readmeTypes: string[] = [];
  const readmeTypeRegex = /\{\s*type:\s*'([^']+)'/g;
  let match: RegExpExecArray | null;

  // Extract only from the "Webview to Extension Host:" section
  const webviewToHostSection = readmeContent.split('### Webview to Extension Host:')[1]?.split('### Extension Host to Webview:')[0] || '';
  while ((match = readmeTypeRegex.exec(webviewToHostSection)) !== null) {
    readmeTypes.push(match[1]);
  }

  assert.ok(readmeTypes.length >= 17, `Expected at least 17 message types in README, found ${readmeTypes.length}`);

  // Extract message types handled in src/panel.ts handleMessage switch statement
  const panelTypes: string[] = [];
  const panelCaseRegex = /case\s+'([^']+)':/g;
  while ((match = panelCaseRegex.exec(panelContent)) !== null) {
    panelTypes.push(match[1]);
  }

  assert.ok(panelTypes.length >= 17, `Expected at least 17 handled message types in panel.ts, found ${panelTypes.length}`);

  // Verify: Every message type in README has a handler in panel.ts
  const missingInPanel = readmeTypes.filter((t) => !panelTypes.includes(t));
  assert.deepStrictEqual(missingInPanel, [], `Message types in README missing handler in panel.ts: ${missingInPanel.join(', ')}`);

  // Verify: Every handler in panel.ts is documented in README.md
  const undocumentedInReadme = panelTypes.filter((t) => !readmeTypes.includes(t));
  assert.deepStrictEqual(undocumentedInReadme, [], `Handlers in panel.ts missing in README: ${undocumentedInReadme.join(', ')}`);
});

test('Contract - Every element ID in README.md exists in ui-placeholder/index.html', () => {
  const rootDir = process.cwd();
  const readmePath = path.join(rootDir, 'ui-placeholder', 'README.md');
  const htmlPath = path.join(rootDir, 'ui-placeholder', 'index.html');

  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Extract all `- `id`:` entries from README
  const readmeIds: string[] = [];
  const idRegex = /^- `([a-z0-9-]+)`:/gm;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(readmeContent)) !== null) {
    readmeIds.push(match[1]);
  }

  assert.ok(readmeIds.length > 0, 'README should list element IDs');

  // Extract all id="..." from index.html
  const htmlIds = new Set<string>();
  const htmlIdRegex = /id="([^"]+)"/g;
  while ((match = htmlIdRegex.exec(htmlContent)) !== null) {
    htmlIds.add(match[1]);
  }

  // Ensure every documented ID exists in index.html
  const missingInHtml = readmeIds.filter((id) => !htmlIds.has(id));
  assert.deepStrictEqual(
    missingInHtml,
    [],
    `Documented element IDs missing in index.html (DEAD CODE): ${missingInHtml.join(', ')}`
  );
});

test('Contract - UI audit documentation in docs/UI_AUDIT.md matches audited controls', () => {
  const rootDir = process.cwd();
  const auditPath = path.join(rootDir, 'docs', 'UI_AUDIT.md');
  assert.ok(fs.existsSync(auditPath), 'docs/UI_AUDIT.md must exist');

  const auditContent = fs.readFileSync(auditPath, 'utf8');

  // Verify critical sections in UI_AUDIT.md
  assert.ok(auditContent.includes('## 1. Executive Summary'), 'Must contain Executive Summary');
  assert.ok(auditContent.includes('## 2. Comprehensive UI Controls & Elements Audit Table'), 'Must contain Audit Table');
  assert.ok(auditContent.includes('## 3. Message Contract Audit'), 'Must contain Message Contract Audit');
  assert.ok(auditContent.includes('## 4. Dead Code Removal Action Log'), 'Must contain Dead Code Removal Log');

  // Verify dead code elements are documented as DEAD CODE
  assert.ok(auditContent.includes('`view-other`'));
  assert.ok(auditContent.includes('`other-stage-msg`'));
  assert.ok(auditContent.includes('DEAD CODE'));
});

