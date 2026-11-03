/**
 * Core type definitions for Buildtri.
 * Keep it simple, explicit, and fully typed for strict TypeScript.
 */

export type StageId =
  | 'requirement'
  | 'plan'
  | 'design'
  | 'build'
  | 'test'
  | 'security'
  | 'release'
  | 'deploy';

export type StageStatus = 'active' | 'done' | 'locked' | 'blocked';

export interface Stage {
  id: StageId;
  status: StageStatus;
  reasons: string[];
}

export type RequirementStatus = 'open' | 'changed' | 'done';

export interface RequirementChange {
  at: string;
  fields: ('title' | 'criteria')[];
}

export interface Requirement {
  id: string;
  title: string;
  criteria: string[];
  status: RequirementStatus;
  change?: RequirementChange;
}

export interface Task {
  id: string;
  title: string;
  reqIds: string[];
}

export interface Design {
  id: string;
  title: string;
  path: string;
  reqIds: string[];
}

export interface RunRecord {
  gate: string;
  cmd: string;
  exit: number;
  startedAt: string;
  at: string;
  durationMs: number;
  reqId?: string;
}

export interface StateCounters {
  req: number;
  task: number;
  design: number;
}

export interface SecretScanFinding {
  path: string;
  line: number;
  rule: string;
}

export interface SecretScanResult {
  at: string;
  findings: SecretScanFinding[];
}

export interface DeployChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface BuildtriState {
  counters: StateCounters;
  stages: Stage[];
  reqs: Requirement[];
  tasks: Task[];
  designs: Design[];
  runs: RunRecord[];
  codeChangedAt?: string | null;
  scan?: SecretScanResult | null;
  deployChecklist?: DeployChecklistItem[];
}

export type CodeLane = 'vibe' | 'hybrid' | 'manual';

export interface ProvenanceFile {
  path: string;
  lane: CodeLane;
  reviewed: boolean;
  reqIds: string[];
  updatedAt: string;
  missing?: boolean;
}

export interface Provenance {
  files: ProvenanceFile[];
}

export interface BuildConfig {
  workingDir: string;
  testCommand: string;
  testByReqCommand: string;
  lintCommand: string;
  buildCommand: string;
  testPathRegex?: string;
  aiModel?: string;
}

export interface ImpactFileItem {
  path: string;
  lines: number[];
}

export interface ReqImpact {
  files: ImpactFileItem[];
  tests: ImpactFileItem[];
}

export interface OrphanTag {
  tag: string;
  path: string;
  line: number;
}

export interface ImpactResult {
  byReq: Record<string, ReqImpact>;
  orphans: OrphanTag[];
}

export interface LaneSummary {
  lane: CodeLane;
  fileCount: number;
  filesWithReqs: number;
  coveredReqIds: string[];
}

export interface ChangesLaneSummary {
  lane: CodeLane;
  pass: number;
  fail: number;
}

export interface GateRunSummary {
  gate: string;
  count: number;
  passed: number;
  failed: number;
  avgDurationMs: number;
}

export interface StageTimelineItem {
  id: StageId;
  status: StageStatus;
}

export interface CompareData {
  lanes: LaneSummary[];
  changes: ChangesLaneSummary[];
  runs: GateRunSummary[];
  timeline: StageTimelineItem[];
}

/**
 * Message protocol between the Webview UI and the Extension Host.
 * The UI never touches the filesystem; the extension owns all data.
 */
export type UiToExtensionMessage =
  | { type: 'ready' }
  | { type: 'stage:select'; stage: StageId }
  | { type: 'req:save'; req: { id?: string; title: string; criteria: string[] } }
  | { type: 'req:delete'; id: string }
  | { type: 'task:save'; task: { id?: string; title: string; reqIds: string[] } }
  | { type: 'task:delete'; id: string }
  | { type: 'design:save'; design: { id?: string; title: string; path?: string; reqIds: string[] } }
  | { type: 'design:delete'; id: string }
  | { type: 'lane:set'; path: string; lane: CodeLane; reqIds?: string[] }
  | { type: 'lane:remove'; path: string }
  | { type: 'gate:run'; stage: StageId }
  | { type: 'change:confirm'; reqId: string; lane: CodeLane }
  | { type: 'run:cancel'; gate: string }
  | { type: 'ai:ask'; prompt: string; reqIds: string[]; includeSelection: boolean }
  | { type: 'ai:cancel' }
  | { type: 'ai:insert'; resultId: string; reqIds: string[] }
  | { type: 'deploy:check'; id: string; checked: boolean };

export type ExtensionToUiMessage =
  | {
      type: 'state';
      data: {
        state: BuildtriState;
        provenance: Provenance;
        impact: ImpactResult;
        selectedStage?: StageId;
        gateWarning?: string;
        logBuffers?: Record<string, string[]>;
        changesHeadings?: string[];
        aiKeySet?: boolean;
        aiModelSet?: boolean;
        aiModel?: string;
        laneColors?: Record<CodeLane, { name: string; color: string; backgroundColor: string; description: string }>;
        deployChecklist?: DeployChecklistItem[];
        compareData?: CompareData;
        releaseNotesHeadings?: string[];
      };
    }
  | { type: 'run:output'; gate: string; line: string }
  | { type: 'run:status'; gate: string; status: 'idle' | 'running' | 'finished' | 'cancelled'; exit?: number }
  | { type: 'ai:status'; status: 'idle' | 'running' | 'done' | 'error'; message?: string }
  | { type: 'ai:result'; resultId: string; text: string; truncated: boolean }
  | { type: 'toast'; level: 'info' | 'warn' | 'error'; text: string };

