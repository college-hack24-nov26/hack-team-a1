import {
  StageId,
  BuildtriState,
  BuildConfig,
  Provenance,
  Stage,
  StageFileContext
} from './types';
import { STAGE_ORDER, getStageFilesForStage } from './constants';
import { extractReqTags } from './trace';

export interface GateResult {
  ok: boolean;
  reasons: string[];
}

export interface GateRunResult {
  ok: boolean;
  newState: BuildtriState;
  reasons: string[];
  toastMessage: string;
}

/**
 * Checks whether required stage files exist, are non-empty, and differ from their template.
 */
function checkStageFiles(
  stageId: StageId,
  config: BuildConfig,
  provenance: Provenance | undefined,
  fileContext: StageFileContext | undefined,
  reasons: string[]
): void {
  if (!fileContext || !fileContext.files) {
    return;
  }
  const stageFilesResult = getStageFilesForStage(stageId, config, provenance);
  for (const filePath of stageFilesResult.validFiles) {
    const fileInfo = fileContext.files[filePath];
    if (!fileInfo || !fileInfo.exists || fileInfo.empty) {
      reasons.push(`${filePath} is missing.`);
    } else if (fileInfo.isTemplate) {
      reasons.push(`${filePath} is still the template.`);
    }
  }
}

/**
 * PURE FUNCTION: computeGate evaluates stage gating rules based purely
 * on the provided state, config, provenance data, and optional fileContext.
 * No VS Code API, no direct file system access.
 */
export function computeGate(
  stageId: StageId,
  state: BuildtriState,
  config?: BuildConfig,
  provenance?: Provenance,
  fileContext?: StageFileContext
): GateResult {
  const safeConfig = config || ({} as BuildConfig);
  const reasons: string[] = [];

  switch (stageId) {
    case 'requirement': {
      // Rule: at least 1 REQ, each with at least 1 acceptance criterion
      if (!state.reqs || state.reqs.length === 0) {
        reasons.push('No requirements defined. At least 1 requirement is needed.');
      } else {
        for (const req of state.reqs) {
          const hasCriteria =
            Array.isArray(req.criteria) &&
            req.criteria.length > 0 &&
            req.criteria.some((c) => c && c.trim().length > 0);

          if (!hasCriteria) {
            reasons.push(`${req.id} has no acceptance criteria.`);
          }
        }
      }

      // Stage file check: docs/USER_REQUIREMENT.md
      checkStageFiles('requirement', safeConfig, provenance, fileContext, reasons);
      break;
    }

    case 'plan': {
      // Rule: at least 1 task, and every REQ has at least 1 task
      if (!state.tasks || state.tasks.length === 0) {
        reasons.push('No tasks defined. At least 1 task is needed.');
      }

      if (!state.reqs || state.reqs.length === 0) {
        reasons.push('No requirements found to plan.');
      } else {
        const coveredReqIds = new Set<string>();
        if (state.tasks) {
          for (const task of state.tasks) {
            if (Array.isArray(task.reqIds)) {
              for (const reqId of task.reqIds) {
                coveredReqIds.add(reqId);
              }
            }
          }
        }

        for (const req of state.reqs) {
          if (!coveredReqIds.has(req.id)) {
            reasons.push(`${req.id} is not covered by any task in the plan.`);
          }
        }
      }

      // Stage files check: docs/PRD.md, docs/TRD.md
      checkStageFiles('plan', safeConfig, provenance, fileContext, reasons);

      // plan also: docs/PRD.md must contain a tag for EVERY existing REQ id
      if (fileContext && fileContext.files && Array.isArray(state.reqs) && state.reqs.length > 0) {
        const prdInfo = fileContext.files['docs/PRD.md'];
        if (prdInfo && prdInfo.exists && !prdInfo.empty && !prdInfo.isTemplate) {
          let prdTags: string[] = fileContext.prdReqTags || [];
          if (!prdTags.length && prdInfo.content) {
            prdTags = extractReqTags(prdInfo.content);
          }
          const tagSet = new Set(prdTags);
          for (const req of state.reqs) {
            if (!tagSet.has(req.id)) {
              reasons.push(`PRD.md does not mention ${req.id}.`);
            }
          }
        }
      }
      break;
    }

    case 'design': {
      // Rule: every REQ has at least 1 design entry
      if (!state.designs || state.designs.length === 0) {
        reasons.push('No design entries defined. Every requirement requires a design entry.');
      }

      if (!state.reqs || state.reqs.length === 0) {
        reasons.push('No requirements found for design.');
      } else {
        const coveredReqIds = new Set<string>();
        if (state.designs) {
          for (const design of state.designs) {
            if (Array.isArray(design.reqIds)) {
              for (const reqId of design.reqIds) {
                coveredReqIds.add(reqId);
              }
            }
          }
        }

        for (const req of state.reqs) {
          if (!coveredReqIds.has(req.id)) {
            reasons.push(`${req.id} has no linked design entry.`);
          }
        }
      }

      // Stage file check: docs/DESIGN.md
      checkStageFiles('design', safeConfig, provenance, fileContext, reasons);
      break;
    }

    case 'build': {
      // Build gate: ok only if every provenance file with lane 'vibe' has reviewed=true.
      // One reason per offending file: '<path> is Vibe and not reviewed.'
      // Having no tracked files passes (vacuously true).
      if (provenance && Array.isArray(provenance.files)) {
        for (const file of provenance.files) {
          if (file.lane === 'vibe' && !file.reviewed) {
            reasons.push(`${file.path} is Vibe and not reviewed.`);
          }
        }
      }
      break;
    }

    case 'test': {
      const testCmd = (safeConfig.testCommand || '').trim();
      if (!testCmd) {
        reasons.push('Test command is not configured (config.json).');
      } else {
        const testRuns = (state.runs || []).filter((r) => r.gate === 'test');
        const latestRun = testRuns[testRuns.length - 1];

        if (!latestRun) {
          reasons.push('Tests have not been run.');
        } else if (latestRun.cmd !== testCmd) {
          reasons.push('Test command changed since the last run.');
        } else if (latestRun.exit === -1) {
          reasons.push('Last test run was cancelled or timed out.');
        } else if (latestRun.exit !== 0) {
          reasons.push(`Last test run failed (exit ${latestRun.exit}).`);
        } else if (state.codeChangedAt && (!latestRun.at || latestRun.at < state.codeChangedAt)) {
          reasons.push('Code changed since the last test run.');
        }
      }

      // Stage file check: docs/TEST_PLAN.md
      checkStageFiles('test', safeConfig, provenance, fileContext, reasons);
      break;
    }

    case 'security': {
      const lintCmd = (safeConfig.lintCommand || '').trim();
      if (!lintCmd) {
        reasons.push('Lint command is not configured (config.json).');
      } else {
        const secRuns = (state.runs || []).filter((r) => r.gate === 'security');
        const latestRun = secRuns[secRuns.length - 1];

        if (!latestRun) {
          reasons.push('Lint has not been run.');
        } else if (latestRun.cmd !== lintCmd) {
          reasons.push('Lint command changed since the last run.');
        } else if (latestRun.exit === -1) {
          reasons.push('Last lint run was cancelled or timed out.');
        } else if (latestRun.exit !== 0) {
          reasons.push(`Last lint run failed (exit ${latestRun.exit}).`);
        }
      }

      // Secret scan check
      if (!state.scan) {
        reasons.push('Secret scan has not been run.');
      } else if (Array.isArray(state.scan.findings) && state.scan.findings.length > 0) {
        for (const finding of state.scan.findings) {
          reasons.push(`${finding.path}:${finding.line} possible secret (${finding.rule})`);
        }
      }

      // Code changed check for security gate
      if (state.codeChangedAt) {
        const secRuns = (state.runs || []).filter((r) => r.gate === 'security');
        const latestRun = secRuns[secRuns.length - 1];
        const lintOutdated = !latestRun?.at || latestRun.at < state.codeChangedAt;
        const scanOutdated = !state.scan?.at || state.scan.at < state.codeChangedAt;
        if (lintOutdated || scanOutdated) {
          reasons.push('Code changed since the last security run.');
        }
      }

      // Stage file check: docs/SECURITY.md
      checkStageFiles('security', safeConfig, provenance, fileContext, reasons);
      break;
    }

    case 'release': {
      // 1. Build command (if configured)
      const buildCmd = (safeConfig.buildCommand || '').trim();
      if (buildCmd) {
        const relRuns = (state.runs || []).filter((r) => r.gate === 'release');
        const latestRun = relRuns[relRuns.length - 1];

        if (!latestRun) {
          reasons.push('build: Build command has not been run.');
        } else if (latestRun.cmd !== buildCmd) {
          reasons.push('build: Build command changed since the last run.');
        } else if (latestRun.exit === -1) {
          reasons.push('build: Last build command run was cancelled or timed out.');
        } else if (latestRun.exit !== 0) {
          reasons.push(`build: Last build command run failed (exit ${latestRun.exit}).`);
        } else if (state.codeChangedAt && (!latestRun.at || latestRun.at < state.codeChangedAt)) {
          reasons.push('build: Code changed since the last build run.');
        }
      }

      // 2. Build gate check (no vibe files without reviewed=true)
      const buildGate = computeGate('build', state, config, provenance, fileContext);
      if (!buildGate.ok) {
        for (const r of buildGate.reasons) {
          reasons.push(`build: ${r}`);
        }
      }

      // 3. Test gate check (including freshness against codeChangedAt)
      const testGate = computeGate('test', state, config, provenance, fileContext);
      if (!testGate.ok) {
        for (const r of testGate.reasons) {
          reasons.push(`test: ${r}`);
        }
      }

      // 4. Security gate check
      const secGate = computeGate('security', state, config, provenance, fileContext);
      if (!secGate.ok) {
        for (const r of secGate.reasons) {
          reasons.push(`security: ${r}`);
        }
      }

      // 5. No REQ has status "changed" (unverified change rule)
      if (Array.isArray(state.reqs)) {
        for (const req of state.reqs) {
          if (req.status === 'changed') {
            reasons.push(`${req.id} has an unverified change.`);
          }
        }
      }
      break;
    }

    case 'deploy': {
      // 1. Release stage must be 'done'
      const releaseStage = (state.stages || []).find((s) => s.id === 'release');
      if (!releaseStage || releaseStage.status !== 'done') {
        reasons.push('Release is not done.');
      }

      // 2. All checklist items must be confirmed
      const checklist = state.deployChecklist || [];
      for (const item of checklist) {
        if (!item.checked) {
          reasons.push(`Checklist item not confirmed: ${item.label}`);
        }
      }
      break;
    }

    default: {
      reasons.push('Gate not implemented yet.');
      break;
    }
  }

  return {
    ok: reasons.length === 0,
    reasons
  };
}

/**
 * PURE FUNCTION: Refreshes the statuses and reasons for all stages according to state rules:
 * - done: only set when the user runs gate:run for the active stage and the gate passes.
 * - active: the first stage that is not done, only if the previous stage is done.
 * - blocked: the active stage after a gate:run that failed; cleared as soon as state changes.
 * - locked: every other stage.
 * Stages after design stay locked until previous is done, and their reason says "Gate not implemented yet".
 */
export function refreshStageStatuses(
  state: BuildtriState,
  config: BuildConfig,
  provenance: Provenance,
  options?: { preserveBlockedStageId?: StageId; fileContext?: StageFileContext }
): BuildtriState {
  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));

  // Build a map of existing stage objects for quick lookup
  const stageMap = new Map<StageId, Stage>();
  for (const s of cloned.stages) {
    stageMap.set(s.id, s);
  }

  let allPrecedingDone = true;

  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const stageId = STAGE_ORDER[i];
    let stageObj = stageMap.get(stageId);

    if (!stageObj) {
      stageObj = { id: stageId, status: 'locked', reasons: [] };
      stageMap.set(stageId, stageObj);
    }

    if (stageObj.status === 'done') {
      // Completed stage stays done
      stageObj.reasons = ['Stage completed.'];
    } else if (allPrecedingDone) {
      // First stage that is not done
      if (options?.preserveBlockedStageId === stageId) {
        stageObj.status = 'blocked';
        const gate = computeGate(stageId, cloned, config, provenance, options?.fileContext);
        stageObj.reasons = gate.reasons.length > 0 ? gate.reasons : ['Gate criteria blocked.'];
      } else {
        stageObj.status = 'active';
        const gate = computeGate(stageId, cloned, config, provenance, options?.fileContext);
        stageObj.reasons = gate.ok
          ? ['All gate criteria met. Ready to complete stage.']
          : gate.reasons;
      }
      allPrecedingDone = false;
    } else {
      // All subsequent stages are locked
      stageObj.status = 'locked';
      const prevStageId = STAGE_ORDER[i - 1];
      stageObj.reasons = [`Locked until ${prevStageId} stage is done.`];
    }
  }

  cloned.stages = STAGE_ORDER.map((id) => stageMap.get(id)!);
  return cloned;
}

/**
 * PURE FUNCTION: Evaluates and executes a gate:run for a given stage.
 * If ok, marks the stage done and activates the next stage.
 * If not, marks the stage blocked with the reasons.
 */
export function executeGateRun(
  stageId: StageId,
  state: BuildtriState,
  config: BuildConfig,
  provenance: Provenance,
  fileContext?: StageFileContext
): GateRunResult {
  const currentStage = state.stages.find((s) => s.id === stageId);

  if (!currentStage) {
    return {
      ok: false,
      newState: state,
      reasons: [`Stage '${stageId}' not found.`],
      toastMessage: `Stage '${stageId}' not found.`
    };
  }

  if (currentStage.status === 'done') {
    return {
      ok: false,
      newState: state,
      reasons: [`Stage '${stageId}' is already completed.`],
      toastMessage: `Stage '${stageId}' is already completed.`
    };
  }

  if (currentStage.status === 'locked') {
    return {
      ok: false,
      newState: state,
      reasons: [`Stage '${stageId}' is locked. Preceding stages must be completed first.`],
      toastMessage: `Stage '${stageId}' is locked.`
    };
  }

  // Evaluate the gate
  const gateResult = computeGate(stageId, state, config, provenance, fileContext);

  if (gateResult.ok) {
    // Gate passes: mark this stage as done
    const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
    const target = cloned.stages.find((s) => s.id === stageId);
    if (target) {
      target.status = 'done';
      target.reasons = ['Stage completed.'];
    }

    // Refresh stage statuses to activate the next stage
    const updatedState = refreshStageStatuses(cloned, config, provenance, { fileContext });

    return {
      ok: true,
      newState: updatedState,
      reasons: [],
      toastMessage: `Stage '${stageId}' completed successfully!`
    };
  } else {
    // Gate failed: mark this stage as blocked
    const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
    const target = cloned.stages.find((s) => s.id === stageId);
    if (target) {
      target.status = 'blocked';
      target.reasons = gateResult.reasons;
    }

    return {
      ok: false,
      newState: cloned,
      reasons: gateResult.reasons,
      toastMessage: `Stage '${stageId}' gate blocked: ${gateResult.reasons.join('; ')}`
    };
  }
}

/**
 * PURE FUNCTION: Checks if a completed stage no longer satisfies its gating criteria.
 * Returns a warning string if broken, or undefined if satisfied or not done.
 */
export function checkGateWarning(
  stageId: StageId,
  state: BuildtriState,
  config?: BuildConfig,
  provenance?: Provenance,
  fileContext?: StageFileContext
): string | undefined {
  const stage = state.stages.find((s) => s.id === stageId);
  if (!stage || stage.status !== 'done') {
    return undefined;
  }
  const result = computeGate(stageId, state, config, provenance, fileContext);
  if (!result.ok && result.reasons.length > 0) {
    return `Gate no longer satisfied: ${result.reasons.join('; ')}`;
  }
  return undefined;
}

/**
 * PURE FUNCTION: Builds the markdown content for a release section.
 * Appended to /.buildtri/release-notes.md upon completing the Release stage.
 * Never includes command output, command text, secrets, or file contents.
 */
export function buildReleaseNotes(
  state: BuildtriState,
  provenance: Provenance,
  changesSummary: number | { changesCount: number },
  nowIso: string,
  config?: BuildConfig
): string {
  const lines: string[] = [];
  lines.push(`## Release ${nowIso}`);

  // 1. Requirements: one line per REQ: id, title, status
  const reqs = state.reqs || [];
  if (reqs.length === 0) {
    lines.push('- Requirements: none');
  } else {
    lines.push('- Requirements:');
    for (const r of reqs) {
      lines.push(`  - ${r.id}: ${r.title} (${r.status})`);
    }
  }

  // 2. Lanes: number of tracked files per lane
  const files = provenance.files || [];
  const vibeCount = files.filter((f) => f.lane === 'vibe').length;
  const hybridCount = files.filter((f) => f.lane === 'hybrid').length;
  const manualCount = files.filter((f) => f.lane === 'manual').length;
  lines.push(`- Lanes: Vibe: ${vibeCount}, Hybrid: ${hybridCount}, Manual: ${manualCount}`);

  // 3. Last test run: exit code and time. Last security run: exit code and time.
  const testRuns = (state.runs || []).filter((r) => r.gate === 'test');
  const lastTest = testRuns[testRuns.length - 1];
  const testInfo = lastTest
    ? `exit ${lastTest.exit} at ${lastTest.at || lastTest.startedAt}`
    : 'never run';

  const secRuns = (state.runs || []).filter((r) => r.gate === 'security');
  const lastSec = secRuns[secRuns.length - 1];
  const secInfo = lastSec
    ? `exit ${lastSec.exit} at ${lastSec.at || lastSec.startedAt}`
    : 'never run';

  lines.push(`- Last test run: ${testInfo}. Last security run: ${secInfo}.`);

  // 4. Build command: pass | not configured
  const buildCmd = config && config.buildCommand ? config.buildCommand.trim() : '';
  const relRuns = (state.runs || []).filter((r) => r.gate === 'release');
  const lastRel = relRuns[relRuns.length - 1];
  let statusText = 'not configured';
  if (lastRel) {
    statusText = lastRel.exit === 0 ? 'pass' : 'failed';
  } else if (buildCmd) {
    statusText = 'failed';
  }
  lines.push(`- Build command: ${statusText}`);

  // 5. Changes since previous release: number of entries in changes.md after previous release heading (or all, if none)
  const changesCount = typeof changesSummary === 'number' ? changesSummary : (changesSummary?.changesCount ?? 0);
  lines.push(`- Changes since the previous release: ${changesCount}`);
  lines.push(''); // trailing blank line

  return lines.join('\n');
}

