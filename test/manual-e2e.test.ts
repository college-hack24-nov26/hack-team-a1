import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StateManager } from '../src/state';
import { computeGate } from '../src/gates';
import { validateStageFilePath } from '../src/constants';

test('E2E Manual Flow - 6-Step Verification on Real Filesystem', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildtri-manual-test-'));
  try {
    const sm = new StateManager(tmpDir);
    await sm.initialize();

    // Step 1: Open an empty folder. Click Plan: PRD.md and TRD.md show Missing.
    const initialPlanFiles = sm.getStageFiles('plan');
    assert.strictEqual(initialPlanFiles.validFiles.length, 2);
    const prdInitial = initialPlanFiles.validFiles.find((f) => f.path === 'docs/PRD.md');
    const trdInitial = initialPlanFiles.validFiles.find((f) => f.path === 'docs/TRD.md');
    assert.ok(prdInitial && prdInitial.status === 'missing', 'PRD.md must initially be Missing');
    assert.ok(trdInitial && trdInitial.status === 'missing', 'TRD.md must initially be Missing');

    // Click "Create from template" on PRD.md: the file really appears on disk, opens, chip becomes Template
    const createRes = await sm.createFileFromTemplate('docs/PRD.md');
    assert.strictEqual(createRes.error, undefined);
    assert.ok(fs.existsSync(createRes.path), 'PRD.md must exist on disk');
    const prdAfterCreate = sm.getStageFiles('plan').validFiles.find((f) => f.path === 'docs/PRD.md');
    assert.strictEqual(prdAfterCreate?.status, 'template', 'PRD.md chip must be Template');

    // Step 2: Type real text, save: the chip becomes Filled
    const prdContent = fs.readFileSync(createRes.path, 'utf8');
    fs.writeFileSync(createRes.path, prdContent + '\n## Custom Features\nReal user requirement specs.\n', 'utf8');
    const prdAfterEdit = sm.getStageFiles('plan').validFiles.find((f) => f.path === 'docs/PRD.md');
    assert.strictEqual(prdAfterEdit?.status, 'filled', 'PRD.md chip must be Filled after editing');

    // Step 3: Requirement stage: create REQ-1 in the Studio.
    const reqRes = await sm.saveRequirement({
      title: 'User Authentication',
      criteria: ['User must sign in with Google or email']
    });
    assert.strictEqual(reqRes.ok, true, 'Requirement creation should succeed');
    const createdReq = sm.getState().reqs.find((r) => r.title === 'User Authentication');
    assert.strictEqual(createdReq?.id, 'REQ-1', 'Created requirement must be REQ-1');

    // Fill USER_REQUIREMENT.md and complete Requirement stage
    await sm.createFileFromTemplate('docs/USER_REQUIREMENT.md');
    fs.writeFileSync(
      path.join(tmpDir, 'docs/USER_REQUIREMENT.md'),
      '# User Requirements\nReal user requirement specification for authentication.\n',
      'utf8'
    );
    const reqGateRes = await sm.runGate('requirement');
    assert.strictEqual(reqGateRes.ok, true, 'Requirement gate should pass');

    // On Plan, "Complete stage" is blocked with "PRD.md does not mention REQ-1"
    sm.refreshStatuses();
    const planGateRes = await sm.runGate('plan');
    assert.strictEqual(planGateRes.ok, false, 'Plan gate should be blocked');
    const hasReqReason = planGateRes.reasons.some((r) => r.includes('PRD.md does not mention REQ-1'));
    assert.ok(hasReqReason, 'Plan gate must be blocked because PRD.md does not mention REQ-1');

    // Add "REQ-1" to the PRD, save: that reason disappears
    fs.appendFileSync(createRes.path, '\nReferences: REQ-1 is addressed in Section 3.\n', 'utf8');
    sm.refreshStatuses();
    const planGateAfterTag = await sm.runGate('plan');
    const stillHasReqReason = planGateAfterTag.reasons.some((r) => r.includes('PRD.md does not mention REQ-1'));
    assert.strictEqual(stillHasReqReason, false, 'REQ-1 missing reason must disappear after adding tag');

    // Step 4: "Draft with AI" on TRD.md: Save as docs/TRD.md creates file, chip is AI draft,
    // provenance has lane: vibe, reviewed: false. Build gate says unreviewed.
    const trdDraftContent = '# Technical Requirements Document\nDrafted by Gemini AI for system architecture.\n';
    const saveRes = await sm.saveDraftFile('docs/TRD.md', trdDraftContent, false);
    assert.strictEqual(saveRes.error, undefined);
    assert.ok(saveRes.path, 'TRD.md draft path must be returned');
    assert.ok(fs.existsSync(saveRes.path), 'TRD.md must exist on disk');

    const trdAfterDraft = sm.getStageFiles('plan').validFiles.find((f) => f.path === 'docs/TRD.md');
    assert.strictEqual(trdAfterDraft?.status, 'ai-draft', 'TRD.md chip must be AI draft');

    const prov = sm.getProvenance();
    const trdProv = prov.files.find((f) => f.path === 'docs/TRD.md');
    assert.ok(trdProv && trdProv.lane === 'vibe' && trdProv.reviewed === false, 'TRD must be lane vibe, reviewed false');

    const buildGateBlocked = computeGate('build', sm.getState(), sm.getConfig(), sm.getProvenance(), sm.getStageFileContext());
    const buildBlockedOnVibe = buildGateBlocked.reasons.some((r) => r.includes('is Vibe and not reviewed'));
    assert.ok(buildBlockedOnVibe, 'Build gate must block on unreviewed vibe file');

    // "Approve as Hybrid" clears it
    await sm.approveHybridFile('docs/TRD.md');
    const trdAfterApprove = sm.getStageFiles('plan').validFiles.find((f) => f.path === 'docs/TRD.md');
    assert.strictEqual(trdAfterApprove?.status, 'reviewed', 'TRD.md chip must be Reviewed after approval');

    const buildGateAfterApprove = computeGate('build', sm.getState(), sm.getConfig(), sm.getProvenance(), sm.getStageFileContext());
    const buildStillBlocked = buildGateAfterApprove.reasons.some((r) => r.includes('is Vibe and not reviewed'));
    assert.strictEqual(buildStillBlocked, false, 'Build gate must unblock after approval');

    // Step 5: Delete a file from disk: its chip becomes Missing live
    fs.unlinkSync(saveRes.path);
    const trdAfterDelete = sm.getStageFiles('plan').validFiles.find((f) => f.path === 'docs/TRD.md');
    assert.strictEqual(trdAfterDelete?.status, 'missing', 'TRD.md chip must become Missing after deletion');

    // Step 6: Configure an invalid path in config.json (e.g. "../out.md"): rejected and marked invalid
    const invalidRes1 = validateStageFilePath('../out.md');
    assert.strictEqual(invalidRes1.valid, false, 'Path with .. must be invalid');
    const invalidRes2 = validateStageFilePath('.buildtri/state.json');
    assert.strictEqual(invalidRes2.valid, false, 'Path inside .buildtri must be invalid');
    const invalidRes3 = validateStageFilePath('node_modules/pkg/index.js');
    assert.strictEqual(invalidRes3.valid, false, 'Path inside node_modules must be invalid');

    // Test with StateManager getConfig stageFiles
    const customConfig = sm.getConfig();
    customConfig.stageFiles = {
      plan: ['docs/PRD.md', '../forbidden.md', 'node_modules/fake.js']
    };
    await sm.saveConfig(customConfig);

    const stageFilesWithInvalid = sm.getStageFiles('plan');
    assert.strictEqual(stageFilesWithInvalid.validFiles.length, 1);
    assert.strictEqual(stageFilesWithInvalid.invalidFiles.length, 2);
    assert.ok(stageFilesWithInvalid.invalidFiles[0].reason.includes('..'));
    assert.ok(stageFilesWithInvalid.invalidFiles[1].reason.includes('node_modules'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
