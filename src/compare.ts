import {
  Provenance,
  BuildtriState,
  CodeLane,
  RunRecord,
  Stage,
  LaneSummary,
  ChangesLaneSummary,
  GateRunSummary,
  StageTimelineItem,
  CompareData
} from './types';

/**
 * PURE FUNCTION: Summarizes code lanes from provenance tracking.
 * Calculates per lane: file count, files with at least one linked reqId, and unique REQ ids covered.
 */
export function summarizeLanes(provenance: Provenance, _state?: BuildtriState): LaneSummary[] {
  const lanes: CodeLane[] = ['vibe', 'hybrid', 'manual'];
  const files = (provenance && Array.isArray(provenance.files)) ? provenance.files : [];

  return lanes.map((lane) => {
    const laneFiles = files.filter((f) => f.lane === lane);
    const filesWithReqs = laneFiles.filter((f) => Array.isArray(f.reqIds) && f.reqIds.length > 0).length;

    const reqIdSet = new Set<string>();
    for (const f of laneFiles) {
      if (Array.isArray(f.reqIds)) {
        for (const rId of f.reqIds) {
          if (rId && typeof rId === 'string') {
            reqIdSet.add(rId);
          }
        }
      }
    }

    const coveredReqIds = Array.from(reqIdSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    return {
      lane,
      fileCount: laneFiles.length,
      filesWithReqs,
      coveredReqIds
    };
  });
}

/**
 * PURE FUNCTION: Parses changes.md and calculates PASS and FAIL counts per lane.
 * Headings format: '## <date> · REQ-<n> · lane: <lane>'
 * Result format: '- Result: PASS' or '- Result: FAIL'
 * Ignores malformed entries.
 */
export function summarizeChanges(changesMarkdown: string): ChangesLaneSummary[] {
  const lanes: CodeLane[] = ['vibe', 'hybrid', 'manual'];
  const counts: Record<CodeLane, { pass: number; fail: number }> = {
    vibe: { pass: 0, fail: 0 },
    hybrid: { pass: 0, fail: 0 },
    manual: { pass: 0, fail: 0 }
  };

  if (!changesMarkdown || typeof changesMarkdown !== 'string') {
    return lanes.map((l) => ({ lane: l, pass: 0, fail: 0 }));
  }

  // Split content by heading '## '
  const sections = changesMarkdown.split(/^##\s+/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const headerLine = lines[0];

    // Heading format: <date> · REQ-<n> · lane: <lane>
    const laneMatch = headerLine.match(/·\s*lane:\s*(vibe|hybrid|manual)\b/i);
    if (!laneMatch) continue;

    const lane = laneMatch[1].toLowerCase() as CodeLane;

    // Search for Result: PASS or Result: FAIL
    let result: 'PASS' | 'FAIL' | null = null;
    for (const line of lines) {
      const resMatch = line.match(/^-\s*Result:\s*(PASS|FAIL)\b/i);
      if (resMatch) {
        result = resMatch[1].toUpperCase() as 'PASS' | 'FAIL';
        break;
      }
    }

    if (result === 'PASS') {
      counts[lane].pass++;
    } else if (result === 'FAIL') {
      counts[lane].fail++;
    }
  }

  return lanes.map((lane) => ({
    lane,
    pass: counts[lane].pass,
    fail: counts[lane].fail
  }));
}

/**
 * PURE FUNCTION: Summarizes runner executions per gate.
 * Returns count, passed (exit 0), failed (exit != 0), and average duration in milliseconds.
 */
export function summarizeRuns(runs: RunRecord[]): GateRunSummary[] {
  if (!Array.isArray(runs) || runs.length === 0) {
    return [];
  }

  // Group by gate name
  const byGate = new Map<string, RunRecord[]>();
  for (const r of runs) {
    const g = r.gate || 'other';
    const list = byGate.get(g) || [];
    list.push(r);
    byGate.set(g, list);
  }

  const summaries: GateRunSummary[] = [];
  for (const [gate, gateRuns] of byGate.entries()) {
    const count = gateRuns.length;
    const passed = gateRuns.filter((r) => r.exit === 0).length;
    const failed = gateRuns.filter((r) => r.exit !== 0).length;
    const totalDuration = gateRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0);
    const avgDurationMs = count > 0 ? Math.round(totalDuration / count) : 0;

    summaries.push({
      gate,
      count,
      passed,
      failed,
      avgDurationMs
    });
  }

  // Consistent ordering: test, security, release, change, others
  const order = ['test', 'security', 'release', 'change'];
  summaries.sort((a, b) => {
    const idxA = order.indexOf(a.gate);
    const idxB = order.indexOf(b.gate);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.gate.localeCompare(b.gate);
  });

  return summaries;
}

/**
 * PURE FUNCTION: Returns the current status of all 8 lifecycle stages.
 */
export function stageTimeline(stages: Stage[]): StageTimelineItem[] {
  if (!Array.isArray(stages)) {
    return [];
  }
  return stages.map((s) => ({
    id: s.id,
    status: s.status
  }));
}

/**
 * PURE FUNCTION: Combines all summary calculations for the Compare view.
 */
export function getCompareData(
  provenance: Provenance,
  state: BuildtriState,
  changesMarkdown: string
): CompareData {
  return {
    lanes: summarizeLanes(provenance, state),
    changes: summarizeChanges(changesMarkdown),
    runs: summarizeRuns(state.runs || []),
    timeline: stageTimeline(state.stages || [])
  };
}

