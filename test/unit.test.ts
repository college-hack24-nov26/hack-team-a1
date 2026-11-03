import test from 'node:test';
import assert from 'node:assert';

import { computeGate, checkGateWarning, buildReleaseNotes } from '../src/gates';
import {
  saveRequirement,
  deleteRequirement,
  saveTask,
  deleteTask,
  saveDesign,
  deleteDesign,
  generateNextReqId
} from '../src/model';
import {
  applyLaneSet,
  normalizePath,
  removeFile
} from '../src/provenance';
import { extractTags, buildImpact } from '../src/trace';
import { scanText } from '../src/secrets';
import { buildRequest, parseResponse, extractCode } from '../src/ai';
import {
  summarizeLanes,
  summarizeChanges,
  summarizeRuns,
  stageTimeline,
  getCompareData
} from '../src/compare';
import {
  INITIAL_STATE,
  INITIAL_PROVENANCE,
  INITIAL_CONFIG,
  DEFAULT_DEPLOY_CHECKLIST,
  validateStageFilePath,
  getStageFilesForStage
} from '../src/constants';
import { getTemplateForFile, normalizeContent, isTemplateContent } from '../src/templates';
import { BuildtriState, BuildConfig, Provenance, StageFileContext } from '../src/types';

// Helper to create a deep-cloned clean state for tests
function getFreshState(): BuildtriState {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

function getFreshProvenance(): Provenance {
  return JSON.parse(JSON.stringify(INITIAL_PROVENANCE));
}

function getFreshConfig(): BuildConfig {
  return JSON.parse(JSON.stringify(INITIAL_CONFIG));
}

// ============================================================================
// 1. GATES MODULE TESTS
// ============================================================================
test('Gates - Requirement gate passing & failing conditions', () => {
  const emptyState = getFreshState();
  emptyState.reqs = [];

  const failNoReqs = computeGate('requirement', emptyState);
  assert.strictEqual(failNoReqs.ok, false);
  assert.strictEqual(failNoReqs.reasons.length, 1);
  assert.match(failNoReqs.reasons[0], /No requirements defined/);

  const stateNoCriteria: BuildtriState = {
    ...emptyState,
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: [], status: 'open' }]
  };
  const failNoCriteria = computeGate('requirement', stateNoCriteria);
  assert.strictEqual(failNoCriteria.ok, false);
  assert.strictEqual(failNoCriteria.reasons.length, 1);
  assert.match(failNoCriteria.reasons[0], /REQ-1 has no acceptance criteria/);

  const passState: BuildtriState = {
    ...emptyState,
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: ['Users can sign in'], status: 'open' }]
  };
  const pass = computeGate('requirement', passState);
  assert.strictEqual(pass.ok, true);
  assert.strictEqual(pass.reasons.length, 0);
});

test('Gates - Plan gate passing & failing conditions', () => {
  const baseState: BuildtriState = {
    ...getFreshState(),
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: ['Criterion 1'], status: 'open' }],
    tasks: []
  };
  const failNoTasks = computeGate('plan', baseState);
  assert.strictEqual(failNoTasks.ok, false);
  assert.match(failNoTasks.reasons[0], /No tasks defined/);

  const failUnmappedReq: BuildtriState = {
    ...baseState,
    reqs: [
      { id: 'REQ-1', title: 'Auth', criteria: ['C1'], status: 'open' },
      { id: 'REQ-2', title: 'Billing', criteria: ['C2'], status: 'open' }
    ],
    tasks: [{ id: 'T-1', title: 'Implement Auth', reqIds: ['REQ-1'] }]
  };
  const failUnmapped = computeGate('plan', failUnmappedReq);
  assert.strictEqual(failUnmapped.ok, false);
  assert.ok(failUnmapped.reasons.some((r) => r.includes('REQ-2 is not covered by any task in the plan.')));

  const passState: BuildtriState = {
    ...failUnmappedReq,
    tasks: [
      { id: 'T-1', title: 'Implement Auth', reqIds: ['REQ-1'] },
      { id: 'T-2', title: 'Implement Billing', reqIds: ['REQ-2'] }
    ]
  };
  const pass = computeGate('plan', passState);
  assert.strictEqual(pass.ok, true);
});

test('Gates - Design gate passing & failing conditions', () => {
  const baseState: BuildtriState = {
    ...getFreshState(),
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: ['C1'], status: 'open' }],
    designs: []
  };
  const failNoDesign = computeGate('design', baseState);
  assert.strictEqual(failNoDesign.ok, false);
  assert.ok(failNoDesign.reasons.some((r) => r.includes('REQ-1 has no linked design entry.')));

  const passState: BuildtriState = {
    ...baseState,
    designs: [{ id: 'D-1', title: 'Auth Spec', path: '', reqIds: ['REQ-1'] }]
  };
  const pass = computeGate('design', passState);
  assert.strictEqual(pass.ok, true);
});

test('Gates - Build gate blocks on unreviewed vibe files', () => {
  const state = getFreshState();
  const provWithVibe: Provenance = {
    files: [
      { path: 'src/app.ts', lane: 'vibe', reviewed: false, reqIds: ['REQ-1'], updatedAt: new Date().toISOString() },
      { path: 'src/util.ts', lane: 'manual', reviewed: true, reqIds: [], updatedAt: new Date().toISOString() }
    ]
  };
  const failVibe = computeGate('build', state, getFreshConfig(), provWithVibe);
  assert.strictEqual(failVibe.ok, false);
  assert.ok(failVibe.reasons.some((r) => r.includes('src/app.ts is Vibe and not reviewed.')));

  const provApproved: Provenance = {
    files: [
      { path: 'src/app.ts', lane: 'hybrid', reviewed: true, reqIds: ['REQ-1'], updatedAt: new Date().toISOString() },
      { path: 'src/util.ts', lane: 'manual', reviewed: true, reqIds: [], updatedAt: new Date().toISOString() }
    ]
  };
  const passApproved = computeGate('build', state, getFreshConfig(), provApproved);
  assert.strictEqual(passApproved.ok, true);
});

test('Gates - Test and Security gates require fresh passing runs and no secrets', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 10000).toISOString();
  const future = new Date(now.getTime() + 10000).toISOString();
  const config = getFreshConfig();
  config.testCommand = 'npm test';
  config.lintCommand = 'npm run lint';

  const stateStaleTest: BuildtriState = {
    ...getFreshState(),
    codeChangedAt: now.toISOString(),
    runs: [{ gate: 'test', cmd: config.testCommand, exit: 0, startedAt: past, at: past, durationMs: 50 }]
  };
  const failStale = computeGate('test', stateStaleTest, config);
  assert.strictEqual(failStale.ok, false);
  assert.ok(failStale.reasons.some((r) => r.includes('Code changed since the last test run.')));

  const stateFreshPassTest: BuildtriState = {
    ...getFreshState(),
    codeChangedAt: now.toISOString(),
    runs: [{ gate: 'test', cmd: config.testCommand, exit: 0, startedAt: future, at: future, durationMs: 50 }]
  };
  const passTest = computeGate('test', stateFreshPassTest, config);
  assert.strictEqual(passTest.ok, true);

  // Security gate: secrets block gate even if lint passed
  const stateWithSecrets: BuildtriState = {
    ...getFreshState(),
    scan: { at: future, findings: [{ path: 'config.ts', line: 10, rule: 'AWS access key' }] },
    runs: [{ gate: 'security', cmd: config.lintCommand, exit: 0, startedAt: future, at: future, durationMs: 50 }]
  };
  const failSecSecrets = computeGate('security', stateWithSecrets, config);
  assert.strictEqual(failSecSecrets.ok, false);
  assert.ok(failSecSecrets.reasons.some((r) => r.includes('possible secret')));
});

test('Gates - Release and Deploy gates lifecycle validation', () => {
  const future = new Date(Date.now() + 5000).toISOString();
  const config = getFreshConfig();
  config.testCommand = 'npm test';
  config.lintCommand = 'npm run lint';
  config.buildCommand = 'npm run build';

  const cleanState: BuildtriState = {
    ...getFreshState(),
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: ['C1'], status: 'open' }],
    runs: [
      { gate: 'test', cmd: config.testCommand, exit: 0, startedAt: future, at: future, durationMs: 50 },
      { gate: 'security', cmd: config.lintCommand, exit: 0, startedAt: future, at: future, durationMs: 50 },
      { gate: 'release', cmd: config.buildCommand, exit: 0, startedAt: future, at: future, durationMs: 100 }
    ],
    scan: { at: future, findings: [] }
  };

  // Release passes when build, test, sec pass, and zero changed REQs
  const passRelease = computeGate('release', cleanState, config, { files: [] });
  assert.strictEqual(passRelease.ok, true);

  // Release fails if any REQ is in 'changed' status
  const stateWithChangedReq: BuildtriState = {
    ...cleanState,
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: ['C1'], status: 'changed' }]
  };
  const failReleaseChanged = computeGate('release', stateWithChangedReq, config, { files: [] });
  assert.strictEqual(failReleaseChanged.ok, false);
  assert.ok(failReleaseChanged.reasons.some((r) => r.includes('REQ-1 has an unverified change')));

  // Deploy gate requires release done and all 4 checklist items confirmed
  const deployStateNotDoneRelease: BuildtriState = {
    ...cleanState,
    stages: cleanState.stages.map((s) => (s.id === 'release' ? { ...s, status: 'active' } : s)),
    deployChecklist: DEFAULT_DEPLOY_CHECKLIST.map((item) => ({ ...item, checked: true }))
  };
  const failDeployReleaseNotDone = computeGate('deploy', deployStateNotDoneRelease);
  assert.strictEqual(failDeployReleaseNotDone.ok, false);
  assert.ok(failDeployReleaseNotDone.reasons.some((r) => r.includes('Release is not done.')));

  // Deploy passes when release is done and all 4 items checked
  const deployPassState: BuildtriState = {
    ...deployStateNotDoneRelease,
    stages: deployStateNotDoneRelease.stages.map((s) => (s.id === 'release' ? { ...s, status: 'done' } : s))
  };
  const passDeploy = computeGate('deploy', deployPassState);
  assert.strictEqual(passDeploy.ok, true);
});

test('Gates - checkGateWarning and buildReleaseNotes', () => {
  const state: BuildtriState = {
    ...getFreshState(),
    stages: [
      { id: 'requirement', status: 'done' },
      { id: 'plan', status: 'active' }
    ] as any,
    reqs: [] // Emptied after completing requirement stage!
  };
  const warning = checkGateWarning('requirement', state);
  assert.ok(warning && warning.includes('Gate no longer satisfied'));

  const releaseNotes = buildReleaseNotes(
    {
      ...getFreshState(),
      reqs: [{ id: 'REQ-1', title: 'Authentication Service', criteria: ['C1'], status: 'open' }],
      runs: [{ gate: 'test', cmd: 'npm test', exit: 0, startedAt: '', at: '2026-10-31T20:00:00Z', durationMs: 200 }]
    },
    { files: [{ path: 'src/auth.ts', lane: 'hybrid', reviewed: true, reqIds: ['REQ-1'], updatedAt: '' }] },
    2,
    '2026-10-31T20:00:00.000Z',
    { workingDir: '', testCommand: '', testByReqCommand: '', lintCommand: '', buildCommand: 'npm run build' }
  );
  assert.ok(releaseNotes.includes('## Release 2026-10-31T20:00:00.000Z'));
  assert.ok(releaseNotes.includes('REQ-1: Authentication Service'));
  assert.ok(releaseNotes.includes('Lanes: Vibe: 0, Hybrid: 1, Manual: 0'));
});

// ============================================================================
// 2. MODEL MODULE TESTS
// ============================================================================
test('Model - Spec Failure Case: Deleted REQ IDs are NEVER reused, counters strictly increment', () => {
  let state = getFreshState();
  state.reqs = [];
  state.counters = { req: 0, task: 0, design: 0 };

  // 1. Create first requirement (REQ-1)
  const res1 = saveRequirement(state, { title: 'First Feature', criteria: ['Works'] });
  assert.strictEqual(res1.ok, true);
  state = res1.newState!;
  assert.strictEqual(state.reqs[0].id, 'REQ-1');
  assert.strictEqual(state.counters.req, 1);

  // 2. Create second requirement (REQ-2)
  const res2 = saveRequirement(state, { title: 'Second Feature', criteria: ['Also works'] });
  assert.strictEqual(res2.ok, true);
  state = res2.newState!;
  assert.strictEqual(state.reqs[1].id, 'REQ-2');
  assert.strictEqual(state.counters.req, 2);

  // 3. User deletes REQ-2
  const delRes = deleteRequirement(state, 'REQ-2');
  assert.strictEqual(delRes.ok, true);
  state = delRes.newState!;
  assert.strictEqual(state.reqs.length, 1);
  assert.strictEqual(state.counters.req, 2); // Counter must NOT decrement!

  // 4. Create third requirement. Must be REQ-3, NEVER REQ-2!
  const res3 = saveRequirement(state, { title: 'Third Feature', criteria: ['Still works'] });
  assert.strictEqual(res3.ok, true);
  state = res3.newState!;
  assert.strictEqual(state.reqs[1].id, 'REQ-3');
  assert.strictEqual(state.counters.req, 3);
  assert.notStrictEqual(state.reqs[1].id, 'REQ-2');

  // Verify generateNextReqId also yields REQ-4
  const nextGen = generateNextReqId(state);
  assert.strictEqual(nextGen.nextId, 'REQ-4');
  assert.strictEqual(nextGen.nextNum, 4);
});

test('Model - Validation, cascading deletion of REQs from tasks and designs', () => {
  let state = getFreshState();
  state.reqs = [];
  state.tasks = [];
  state.designs = [];

  // Validation: empty title rejected
  const badReq = saveRequirement(state, { title: '   ', criteria: ['C1'] });
  assert.strictEqual(badReq.ok, false);
  assert.match(badReq.error!, /title is required/i);

  // Create REQ-1
  state = saveRequirement(state, { title: 'Auth', criteria: ['C1'] }).newState!;

  // Create Task linking REQ-1
  state = saveTask(state, { title: 'Task 1', reqIds: ['REQ-1'] }).newState!;
  assert.strictEqual(state.tasks[0].id, 'T-1');

  // Create Design linking REQ-1
  state = saveDesign(state, { title: 'Design 1', path: 'docs/d.md', reqIds: ['REQ-1'] }).newState!;
  assert.strictEqual(state.designs[0].id, 'D-1');

  // Deleting REQ-1 cascades removal of REQ-1 from Task and Design
  state = deleteRequirement(state, 'REQ-1').newState!;
  assert.strictEqual(state.reqs.length, 0);
  assert.deepStrictEqual(state.tasks[0].reqIds, []);
  assert.deepStrictEqual(state.designs[0].reqIds, []);

  // Delete task and design
  state = deleteTask(state, 'T-1').newState!;
  assert.strictEqual(state.tasks.length, 0);

  state = deleteDesign(state, 'D-1').newState!;
  assert.strictEqual(state.designs.length, 0);
});

// ============================================================================
// 3. PROVENANCE MODULE TESTS
// ============================================================================
test('Provenance - Spec Failure Case: vibe -> manual transition is STRICTLY REJECTED', () => {
  const state = getFreshState();
  let prov = getFreshProvenance();

  // 1. Mark file as vibe
  const addVibeRes = applyLaneSet(prov, { path: 'src/calc.ts', lane: 'vibe', reqIds: [] }, state);
  assert.strictEqual(addVibeRes.ok, true);
  prov = addVibeRes.provenance!;
  assert.strictEqual(prov.files[0].lane, 'vibe');
  assert.strictEqual(prov.files[0].reviewed, false);

  // 2. Attempt direct transition vibe -> manual. MUST FAIL!
  const failManualRes = applyLaneSet(prov, { path: 'src/calc.ts', lane: 'manual' }, state);
  assert.strictEqual(failManualRes.ok, false);
  assert.match(failManualRes.error!, /cannot be marked Manual directly.*approved as Hybrid/i);

  // 3. Approve as Hybrid is allowed
  const approveRes = applyLaneSet(prov, { path: 'src/calc.ts', lane: 'hybrid' }, state);
  assert.strictEqual(approveRes.ok, true);
  prov = approveRes.provenance!;
  assert.strictEqual(prov.files[0].lane, 'hybrid');
  assert.strictEqual(prov.files[0].reviewed, true);

  // 4. Once hybrid, changing to manual is allowed
  const hybridToManualRes = applyLaneSet(prov, { path: 'src/calc.ts', lane: 'manual' }, state);
  assert.strictEqual(hybridToManualRes.ok, true);
  assert.strictEqual(hybridToManualRes.provenance!.files[0].lane, 'manual');
});

test('Provenance - Spec Failure Case: Outside-workspace and internal paths are REJECTED', () => {
  // Directory traversal
  assert.strictEqual(normalizePath('../outside.ts'), null);
  assert.strictEqual(normalizePath('src/../../outside.ts'), null);

  // Absolute paths
  assert.strictEqual(normalizePath('/etc/passwd'), null);
  assert.strictEqual(normalizePath('C:/Windows/system32/calc.exe'), null);
  assert.strictEqual(normalizePath('D:\\secret\\file.ts'), null);

  // Internal reserved directories
  assert.strictEqual(normalizePath('.buildtri/state.json'), null);
  assert.strictEqual(normalizePath('.buildtri/config.json'), null);
  assert.strictEqual(normalizePath('node_modules/lodash/index.js'), null);

  // Valid workspace-relative paths normalized with forward slashes
  assert.strictEqual(normalizePath('src\\components\\Button.tsx'), 'src/components/Button.tsx');
  assert.strictEqual(normalizePath('./src/index.ts'), 'src/index.ts');
  assert.strictEqual(normalizePath('README.md'), 'README.md');

  // Untrack file
  const prov: Provenance = {
    files: [{ path: 'src/app.ts', lane: 'manual', reviewed: true, reqIds: [], updatedAt: '' }]
  };
  const removed = removeFile(prov, 'src/app.ts');
  assert.strictEqual(removed.provenance.files.length, 0);
});

// ============================================================================
// 4. TRACEABILITY MODULE TESTS
// ============================================================================
test('Trace - Spec Failure Case: REQ-1 does NOT match REQ-10 in tag extraction', () => {
  const code = `
    // REQ-1: Initial basic authentication
    const a = 1;
    // REQ-10: Token validation logic
    const b = 2;
    // REQ-100: Edge case token handling
    const c = 3;
    /* REQ-1 logic */
  `;
  const tags = extractTags(code);

  // Exactly 4 tags: REQ-1 (line 2), REQ-10 (line 4), REQ-100 (line 6), REQ-1 (line 8)
  assert.strictEqual(tags.length, 4);

  const req1Tags = tags.filter((t) => t.req === 'REQ-1');
  const req10Tags = tags.filter((t) => t.req === 'REQ-10');
  const req100Tags = tags.filter((t) => t.req === 'REQ-100');

  assert.strictEqual(req1Tags.length, 2);
  assert.strictEqual(req10Tags.length, 1);
  assert.strictEqual(req100Tags.length, 1);

  // Exact match assertions
  assert.strictEqual(req1Tags[0].req, 'REQ-1');
  assert.strictEqual(req10Tags[0].req, 'REQ-10');
  assert.strictEqual(req100Tags[0].req, 'REQ-100');
});

test('Trace - buildImpact groups code, tests, and detects orphan tags', () => {
  const files = [
    { path: 'src/auth.ts', text: '// REQ-1 logic\nfunction auth() {}' },
    { path: 'tests/auth.test.ts', text: '// REQ-1 tests\ndescribe("auth", () => {})' },
    { path: 'src/legacy.ts', text: '// REQ-99: legacy code' } // REQ-99 does not exist!
  ];
  const knownReqIds = ['REQ-1'];

  const impact = buildImpact(files, knownReqIds, 'test|tests|spec');
  assert.ok(impact.byReq['REQ-1']);
  assert.strictEqual(impact.byReq['REQ-1'].files.length, 1);
  assert.strictEqual(impact.byReq['REQ-1'].files[0].path, 'src/auth.ts');
  assert.strictEqual(impact.byReq['REQ-1'].tests.length, 1);
  assert.strictEqual(impact.byReq['REQ-1'].tests[0].path, 'tests/auth.test.ts');

  // Verify orphan detection
  assert.strictEqual(impact.orphans.length, 1);
  assert.strictEqual(impact.orphans[0].tag, 'REQ-99');
  assert.strictEqual(impact.orphans[0].path, 'src/legacy.ts');
});

// ============================================================================
// 5. SECRETS MODULE TESTS
// ============================================================================
test('Secrets - Spec Failure Case: A secret value is NEVER returned in scan results', () => {
  const awsKey = 'AKIAIOSFODNN7EXAMPLE';
  const text = `const apiKey = "${awsKey}";`;

  const findings = scanText(text);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].line, 1);
  assert.strictEqual(findings[0].rule, 'AWS access key');

  // Strictly verify that the actual secret value does NOT appear anywhere in the finding object
  const findingJson = JSON.stringify(findings[0]);
  assert.strictEqual(findingJson.includes(awsKey), false);
  assert.strictEqual((findings[0] as any).value, undefined);
  assert.strictEqual((findings[0] as any).secret, undefined);
  assert.strictEqual((findings[0] as any).match, undefined);
});

test('Secrets - Detects common credential formats and respects suppression comment', () => {
  const githubSecret = 'ghp_' + '123456789012345678901234567890123456';
  const textWithSecrets = [
    `const token = "${githubSecret}";`,
    `const allowed = "AKIA1234567890EXAMPLE"; // buildtri:allow-secret`,
    `-----BEGIN RSA PRIVATE KEY-----`
  ].join('\n');

  const findings = scanText(textWithSecrets);
  assert.strictEqual(findings.length, 2);
  assert.strictEqual(findings[0].rule, 'GitHub token');
  assert.strictEqual(findings[1].rule, 'PEM private key');

  // Line 2 with 'buildtri:allow-secret' was safely ignored
  assert.ok(!findings.some((f) => f.line === 2));
});

// ============================================================================
// 6. AI MODULE TESTS
// ============================================================================
test('AI - buildRequest validates model name, generates valid URL and body', () => {
  // Empty or invalid model name throws
  assert.throws(() => buildRequest('Hello', null, ''), /Invalid model name/);
  assert.throws(() => buildRequest('Hello', null, 'bad model with spaces!'), /Invalid model name/);

  // Valid model request
  const valid = buildRequest('Implement quicksort', 'const arr = [5, 2, 8];', 'gemini-2.0-flash');
  assert.ok(valid.path.includes('models/gemini-2.0-flash:generateContent'));
  assert.strictEqual(valid.body.contents.length, 1);
  assert.ok(valid.body.contents[0].parts[0].text.includes('Implement quicksort'));
  assert.ok(valid.body.contents[0].parts[0].text.includes('const arr = [5, 2, 8];'));
});

test('AI - parseResponse maps friendly errors without exposing raw error or "API key not valid"', () => {
  // Successful response
  const goodJson = {
    candidates: [{ content: { parts: [{ text: '```typescript\nfunction add(a, b) { return a + b; }\n```' }] } }]
  };
  const parsedGood = parseResponse(goodJson);
  assert.strictEqual(parsedGood.ok, true);
  assert.ok(parsedGood.text && parsedGood.text.includes('function add'));

  // Friendly error mappings
  const err400 = parseResponse({ error: { code: 400, message: 'Invalid field' } });
  assert.strictEqual(err400.ok, false);
  assert.strictEqual(err400.error, 'Bad request');

  const err401 = parseResponse({ error: { code: 401, message: 'API_KEY_INVALID' } });
  assert.strictEqual(err401.ok, false);
  assert.strictEqual(err401.error, 'Gemini rejected the API key');
  assert.strictEqual(err401.error?.includes('API key not valid'), false);

  const err404 = parseResponse({ error: { code: 404, message: 'models/xyz not found' } });
  assert.strictEqual(err404.ok, false);
  assert.strictEqual(err404.error, 'Model not found: check aiModel');

  const err429 = parseResponse({ error: { code: 429, message: 'RESOURCE_EXHAUSTED' } });
  assert.strictEqual(err429.ok, false);
  assert.strictEqual(err429.error, 'Rate limit reached, try again later');

  const err500 = parseResponse({ error: { code: 500, message: 'INTERNAL' } });
  assert.strictEqual(err500.ok, false);
  assert.strictEqual(err500.error, 'Gemini service error');

  // Safety block
  const safetyBlock = parseResponse({ promptFeedback: { blockReason: 'SAFETY' } });
  assert.strictEqual(safetyBlock.ok, false);
  assert.strictEqual(safetyBlock.error, 'Prompt blocked by safety filters');
});

test('AI - extractCode strips markdown code blocks accurately', () => {
  const markdownCode = '```typescript\nfunction hello() {\n  return "world";\n}\n```';
  assert.strictEqual(extractCode(markdownCode), 'function hello() {\n  return "world";\n}');

  const genericFence = '```\nconsole.log(42);\n```';
  assert.strictEqual(extractCode(genericFence), 'console.log(42);');

  const plainCode = 'const x = 10;';
  assert.strictEqual(extractCode(plainCode), 'const x = 10;');
});

// ============================================================================
// 7. COMPARE MODULE TESTS
// ============================================================================
test('Compare - summarizeLanes, summarizeChanges, summarizeRuns, stageTimeline', () => {
  const prov: Provenance = {
    files: [
      { path: 'src/a.ts', lane: 'hybrid', reviewed: true, reqIds: ['REQ-2', 'REQ-1'], updatedAt: '' },
      { path: 'src/b.ts', lane: 'vibe', reviewed: false, reqIds: ['REQ-1'], updatedAt: '' },
      { path: 'src/c.ts', lane: 'manual', reviewed: true, reqIds: [], updatedAt: '' }
    ]
  };
  const state: BuildtriState = {
    ...getFreshState(),
    stages: getFreshState().stages.map((s) =>
      s.id === 'requirement' || s.id === 'plan' ? { ...s, status: 'done' as const } : s.id === 'design' ? { ...s, status: 'active' as const } : s
    ),
    runs: [
      { gate: 'test', cmd: 'npm test', exit: 0, startedAt: '', at: '', durationMs: 100 },
      { gate: 'test', cmd: 'npm test', exit: 1, startedAt: '', at: '', durationMs: 200 },
      { gate: 'security', cmd: 'npm run lint', exit: 0, startedAt: '', at: '', durationMs: 300 }
    ]
  };

  const lanesSummary = summarizeLanes(prov, state);
  const hybridSummary = lanesSummary.find((l) => l.lane === 'hybrid')!;
  const manualSummary = lanesSummary.find((l) => l.lane === 'manual')!;
  const vibeSummary = lanesSummary.find((l) => l.lane === 'vibe')!;

  assert.strictEqual(hybridSummary.fileCount, 1);
  assert.strictEqual(hybridSummary.filesWithReqs, 1);
  assert.deepStrictEqual(hybridSummary.coveredReqIds, ['REQ-1', 'REQ-2']);
  assert.strictEqual(manualSummary.fileCount, 1);
  assert.strictEqual(vibeSummary.fileCount, 1);

  const changesMd = `
## 2026-10-31 · REQ-1 · lane: hybrid
- Result: PASS

## 2026-10-31 · REQ-2 · lane: hybrid
- Result: FAIL

## 2026-10-31 · REQ-3 · lane: vibe
- Result: PASS
  `;
  const changesSummary = summarizeChanges(changesMd);
  const hybridChanges = changesSummary.find((c) => c.lane === 'hybrid')!;
  const vibeChanges = changesSummary.find((c) => c.lane === 'vibe')!;

  assert.strictEqual(hybridChanges.pass, 1);
  assert.strictEqual(hybridChanges.fail, 1);
  assert.strictEqual(vibeChanges.pass, 1);
  assert.strictEqual(vibeChanges.fail, 0);

  const runsSummary = summarizeRuns(state.runs);
  const testRunSummary = runsSummary.find((r) => r.gate === 'test')!;
  const secRunSummary = runsSummary.find((r) => r.gate === 'security')!;

  assert.strictEqual(testRunSummary.count, 2);
  assert.strictEqual(testRunSummary.passed, 1);
  assert.strictEqual(testRunSummary.failed, 1);
  assert.strictEqual(testRunSummary.avgDurationMs, 150);
  assert.strictEqual(secRunSummary.count, 1);
  assert.strictEqual(secRunSummary.avgDurationMs, 300);

  const timeline = stageTimeline(state.stages);
  assert.strictEqual(timeline.length, 8);
  assert.strictEqual(timeline.find((s) => s.id === 'requirement')?.status, 'done');
  assert.strictEqual(timeline.find((s) => s.id === 'design')?.status, 'active');

  const composite = getCompareData(prov, state, changesMd);
  assert.ok(composite.lanes);
  assert.ok(composite.changes);
  assert.ok(composite.runs);
  assert.ok(composite.timeline);
});

// ============================================================================
// 8. STAGE FILES, VALIDATION & TEMPLATES TESTS
// ============================================================================
test('Constants - validateStageFilePath security and relative path checks', () => {
  // Valid relative paths
  assert.strictEqual(validateStageFilePath('docs/USER_REQUIREMENT.md').valid, true);
  assert.strictEqual(validateStageFilePath('docs/PRD.md').valid, true);
  assert.strictEqual(validateStageFilePath('docs/sub/file.md').valid, true);
  assert.strictEqual(validateStageFilePath('.buildtri/release-notes.md', 'release').valid, true);

  // Invalid: empty
  assert.strictEqual(validateStageFilePath('').valid, false);

  // Invalid: absolute (Windows & Unix)
  assert.strictEqual(validateStageFilePath('C:\\docs\\PRD.md').valid, false);
  assert.strictEqual(validateStageFilePath('D:/docs/PRD.md').valid, false);
  assert.strictEqual(validateStageFilePath('/etc/passwd').valid, false);
  assert.strictEqual(validateStageFilePath('\\Windows\\System32').valid, false);

  // Invalid: directory traversal ".."
  assert.strictEqual(validateStageFilePath('../secret.txt').valid, false);
  assert.strictEqual(validateStageFilePath('docs/../../secret.txt').valid, false);
  assert.strictEqual(validateStageFilePath('docs/..').valid, false);

  // Invalid: node_modules
  assert.strictEqual(validateStageFilePath('node_modules/package/index.js').valid, false);

  // Invalid: .buildtri (not release stage)
  assert.strictEqual(validateStageFilePath('.buildtri/state.json', 'requirement').valid, false);
  assert.strictEqual(validateStageFilePath('.buildtri/config.json', 'plan').valid, false);
  assert.strictEqual(validateStageFilePath('.buildtri/release-notes.md', 'requirement').valid, false);
});

test('Constants - getStageFilesForStage resolves defaults and filters invalid', () => {
  const config = getFreshConfig();

  // Defaults
  const reqFiles = getStageFilesForStage('requirement', config);
  assert.deepStrictEqual(reqFiles.validFiles, ['docs/USER_REQUIREMENT.md']);
  assert.strictEqual(reqFiles.invalidFiles.length, 0);

  const planFiles = getStageFilesForStage('plan', config);
  assert.deepStrictEqual(planFiles.validFiles, ['docs/PRD.md', 'docs/TRD.md']);

  const deployFiles = getStageFilesForStage('deploy', config);
  assert.deepStrictEqual(deployFiles.validFiles, []);

  // Build files from provenance
  const prov: Provenance = {
    files: [
      { path: 'src/app.ts', lane: 'hybrid', reviewed: true, reqIds: ['REQ-1'], updatedAt: '' },
      { path: 'src/util.ts', lane: 'vibe', reviewed: false, reqIds: [], updatedAt: '' }
    ]
  };
  const buildFiles = getStageFilesForStage('build', config, prov);
  assert.deepStrictEqual(buildFiles.validFiles, ['src/app.ts', 'src/util.ts']);

  // Config with invalid paths containing ".."
  const badConfig: BuildConfig = {
    ...config,
    stageFiles: {
      plan: ['docs/PRD.md', '../secret.md', 'node_modules/bad.md']
    }
  };
  const filtered = getStageFilesForStage('plan', badConfig);
  assert.deepStrictEqual(filtered.validFiles, ['docs/PRD.md']);
  assert.strictEqual(filtered.invalidFiles.length, 2);
  assert.ok(filtered.invalidFiles[0].path === '../secret.md');
});

test('Templates - getTemplateForFile, normalizeContent, and isTemplateContent', () => {
  const state = getFreshState();
  state.reqs = [
    { id: 'REQ-1', title: 'User Auth', criteria: ['Sign in'], status: 'open' },
    { id: 'REQ-2', title: 'Dashboard', criteria: ['View stats'], status: 'open' }
  ];

  const prdTemplate = getTemplateForFile('docs/PRD.md', state);
  assert.ok(prdTemplate.includes('# Product Requirements Document (PRD)'));
  assert.ok(prdTemplate.includes('- [ ] REQ-1: User Auth'));
  assert.ok(prdTemplate.includes('- [ ] REQ-2: Dashboard'));

  // normalizeContent
  const raw = '   # Header \r\n\r\n Some text with spaces   \r\n ';
  const normalized = normalizeContent(raw);
  assert.strictEqual(normalized, '# Header\n\nSome text with spaces');

  // isTemplateContent
  assert.strictEqual(isTemplateContent(prdTemplate, prdTemplate), true);
  assert.strictEqual(isTemplateContent(prdTemplate + '\r\n   ', prdTemplate), true);

  const edited = prdTemplate + '\n\n## Custom Section\nReal content written by user.';
  assert.strictEqual(isTemplateContent(edited, prdTemplate), false);
});

test('Gates - Stage files missing, template, and PRD tag reasons', () => {
  const state: BuildtriState = {
    ...getFreshState(),
    reqs: [{ id: 'REQ-1', title: 'Auth', criteria: ['Login'], status: 'open' }],
    tasks: [{ id: 'T-1', title: 'Task', reqIds: ['REQ-1'] }]
  };
  const config = getFreshConfig();

  // 1. Missing file
  const fileContextMissing: StageFileContext = {
    files: {
      'docs/USER_REQUIREMENT.md': { exists: false, empty: true, isTemplate: false }
    }
  };
  const resMissing = computeGate('requirement', state, config, undefined, fileContextMissing);
  assert.strictEqual(resMissing.ok, false);
  assert.ok(resMissing.reasons.includes('docs/USER_REQUIREMENT.md is missing.'));

  // 2. Template file
  const fileContextTemplate: StageFileContext = {
    files: {
      'docs/USER_REQUIREMENT.md': { exists: true, empty: false, isTemplate: true, content: 'template' }
    }
  };
  const resTemplate = computeGate('requirement', state, config, undefined, fileContextTemplate);
  assert.strictEqual(resTemplate.ok, false);
  assert.ok(resTemplate.reasons.includes('docs/USER_REQUIREMENT.md is still the template.'));

  // 3. Filled requirement file passes
  const fileContextFilledReq: StageFileContext = {
    files: {
      'docs/USER_REQUIREMENT.md': { exists: true, empty: false, isTemplate: false, content: 'User auth reqs' }
    }
  };
  const resFilled = computeGate('requirement', state, config, undefined, fileContextFilledReq);
  assert.strictEqual(resFilled.ok, true);

  // 4. Plan: PRD.md does not mention REQ-1
  const fileContextPlanNoTag: StageFileContext = {
    files: {
      'docs/PRD.md': { exists: true, empty: false, isTemplate: false, content: 'General product description without tag' },
      'docs/TRD.md': { exists: true, empty: false, isTemplate: false, content: 'Technical architecture' }
    },
    prdReqTags: []
  };
  const resPlanNoTag = computeGate('plan', state, config, undefined, fileContextPlanNoTag);
  assert.strictEqual(resPlanNoTag.ok, false);
  assert.ok(resPlanNoTag.reasons.includes('PRD.md does not mention REQ-1.'));

  // 5. Plan: PRD.md mentions REQ-1 -> passes!
  const fileContextPlanWithTag: StageFileContext = {
    files: {
      'docs/PRD.md': { exists: true, empty: false, isTemplate: false, content: 'Product description covering REQ-1 in detail.' },
      'docs/TRD.md': { exists: true, empty: false, isTemplate: false, content: 'Technical architecture' }
    },
    prdReqTags: ['REQ-1']
  };
  const resPlanWithTag = computeGate('plan', state, config, undefined, fileContextPlanWithTag);
  assert.strictEqual(resPlanWithTag.ok, true);
  assert.strictEqual(resPlanWithTag.reasons.length, 0);
});
