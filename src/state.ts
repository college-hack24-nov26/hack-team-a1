import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  BuildtriState,
  Provenance,
  BuildConfig
} from './types';
import {
  BUILDTRI_DIR_NAME,
  STATE_FILE_NAME,
  PROVENANCE_FILE_NAME,
  CONFIG_FILE_NAME,
  CHANGES_FILE_NAME,
  INITIAL_STATE,
  INITIAL_PROVENANCE,
  INITIAL_CONFIG,
  DEMO_REQS,
  DEMO_TASKS,
  DEMO_DESIGNS,
  RELEASE_NOTES_FILE_NAME,
  DEFAULT_DEPLOY_CHECKLIST
} from './constants';
import { refreshStageStatuses, executeGateRun, GateRunResult } from './gates';
import {
  saveRequirement,
  deleteRequirement,
  saveTask,
  deleteTask,
  saveDesign,
  deleteDesign,
  ensureCounters,
  ModelOperationResult
} from './model';
import { applyLaneSet, removeFile, ApplyLaneResult } from './provenance';
import { StageId, CodeLane } from './types';

/**
 * StateManager handles reading and writing all files within /.buildtri/.
 * It ensures files exist upon startup and provides typed accessors for
 * state.json, provenance.json, and config.json.
 */
export class StateManager {
  private workspaceRoot: string;
  private buildtriDir: string;
  private state: BuildtriState;
  private provenance: Provenance;
  private config: BuildConfig;
  private configWatcher?: vscode.FileSystemWatcher;

  private onDidChangeStateEmitter = new vscode.EventEmitter<BuildtriState>();
  public readonly onDidChangeState = this.onDidChangeStateEmitter.event;

  private onDidChangeProvenanceEmitter = new vscode.EventEmitter<Provenance>();
  public readonly onDidChangeProvenance = this.onDidChangeProvenanceEmitter.event;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.buildtriDir = path.join(workspaceRoot, BUILDTRI_DIR_NAME);
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.provenance = JSON.parse(JSON.stringify(INITIAL_PROVENANCE));
    this.config = JSON.parse(JSON.stringify(INITIAL_CONFIG));
  }

  /**
   * Initializes the /.buildtri directory and files if they do not yet exist.
   */
  public async initialize(): Promise<void> {
    if (!fs.existsSync(this.buildtriDir)) {
      fs.mkdirSync(this.buildtriDir, { recursive: true });
    }

    // Load or initialize state.json
    const statePath = path.join(this.buildtriDir, STATE_FILE_NAME);
    if (fs.existsSync(statePath)) {
      try {
        const raw = fs.readFileSync(statePath, 'utf8');
        this.state = JSON.parse(raw);
        ensureCounters(this.state);
        if (!Array.isArray(this.state.deployChecklist)) {
          this.state.deployChecklist = DEFAULT_DEPLOY_CHECKLIST.map((c) => ({ ...c, checked: false }));
        }
      } catch (err) {
        console.error('Failed to parse state.json, using defaults', err);
        this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
        await this.saveState();
      }
    } else {
      await this.saveState();
    }

    // Refresh stage statuses and reasons on startup
    const blockedStage = this.state.stages.find((s) => s.status === 'blocked');
    this.state = refreshStageStatuses(this.state, this.config, this.provenance, {
      preserveBlockedStageId: blockedStage?.id
    });
    await this.saveState();

    // Load or initialize provenance.json
    const provPath = path.join(this.buildtriDir, PROVENANCE_FILE_NAME);
    if (fs.existsSync(provPath)) {
      try {
        const raw = fs.readFileSync(provPath, 'utf8');
        this.provenance = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse provenance.json, using defaults', err);
        this.provenance = JSON.parse(JSON.stringify(INITIAL_PROVENANCE));
        await this.saveProvenance();
      }
    } else {
      await this.saveProvenance();
    }

    // Load or initialize config.json
    const configPath = path.join(this.buildtriDir, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse config.json, using defaults', err);
        this.config = JSON.parse(JSON.stringify(INITIAL_CONFIG));
        await this.saveConfig();
      }
    } else {
      await this.saveConfig();
    }

    this.setupConfigWatcher();
  }

  private setupConfigWatcher(): void {
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
    const pattern = new vscode.RelativePattern(this.buildtriDir, CONFIG_FILE_NAME);
    this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.configWatcher.onDidChange(async () => {
      await this.reloadConfig();
    });
    this.configWatcher.onDidCreate(async () => {
      await this.reloadConfig();
    });
  }

  public async reloadConfig(): Promise<void> {
    const configPath = path.join(this.buildtriDir, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(raw);
        this.state = refreshStageStatuses(this.state, this.config, this.provenance);
        this.onDidChangeStateEmitter.fire(this.state);
      } catch (err) {
        console.error('Failed to reload config.json:', err);
      }
    }
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public getState(): BuildtriState {
    return this.state;
  }

  public getProvenance(): Provenance {
    return this.provenance;
  }

  public getConfig(): BuildConfig {
    return this.config;
  }

  /**
   * Persists the current state to /.buildtri/state.json.
   */
  public async saveState(newState?: BuildtriState): Promise<void> {
    if (newState) {
      this.state = newState;
    }
    const statePath = path.join(this.buildtriDir, STATE_FILE_NAME);
    await fs.promises.writeFile(statePath, JSON.stringify(this.state, null, 2), 'utf8');
    this.onDidChangeStateEmitter.fire(this.state);
  }

  /**
   * Persists the current provenance to /.buildtri/provenance.json.
   */
  public async saveProvenance(newProvenance?: Provenance): Promise<void> {
    if (newProvenance) {
      this.provenance = newProvenance;
    }
    const provPath = path.join(this.buildtriDir, PROVENANCE_FILE_NAME);
    await fs.promises.writeFile(provPath, JSON.stringify(this.provenance, null, 2), 'utf8');
    this.onDidChangeProvenanceEmitter.fire(this.provenance);
  }

  /**
   * Sets or updates the code lane for a workspace file.
   * Enforces transition constraints and updates gating live.
   */
  public async setLane(
    filePath: string,
    lane: CodeLane,
    reqIds?: string[]
  ): Promise<ApplyLaneResult> {
    const res = applyLaneSet(this.provenance, { path: filePath, lane, reqIds }, this.state);
    if (!res.ok || !res.provenance) {
      return res;
    }
    this.provenance = res.provenance;
    await this.saveProvenance();

    // Recompute stage statuses (Rule: clear blocked, update gate reasons live)
    this.state = refreshStageStatuses(this.state, this.config, this.provenance);
    await this.saveState();

    return res;
  }

  /**
   * Removes a tracked file entry from provenance.json.
   */
  public async removeTrackedFile(filePath: string): Promise<void> {
    const res = removeFile(this.provenance, filePath);
    this.provenance = res.provenance;
    await this.saveProvenance();

    // Recompute stage statuses
    this.state = refreshStageStatuses(this.state, this.config, this.provenance);
    await this.saveState();
  }

  /**
   * Evaluates and runs the gate for the requested stage.
   * If passing, marks the stage done and activates the next.
   * If blocked, marks the stage blocked with reasons.
   */
  public async runGate(stageId: StageId): Promise<GateRunResult> {
    const result = executeGateRun(stageId, this.state, this.config, this.provenance);
    this.state = result.newState;
    await this.saveState();
    return result;
  }

  /**
   * Loads demo requirements, tasks, and designs for testing gating rules.
   * Resets any blocked stage back to active and recomputes gate reasons.
   */
  public async loadDemoData(): Promise<void> {
    this.state.counters = { req: 2, task: 2, design: 2 };
    this.state.reqs = JSON.parse(JSON.stringify(DEMO_REQS));
    this.state.tasks = JSON.parse(JSON.stringify(DEMO_TASKS));
    this.state.designs = JSON.parse(JSON.stringify(DEMO_DESIGNS));
    this.state.codeChangedAt = null;
    this.state.scan = null;

    // Clear blocked status and refresh stage statuses
    this.state = refreshStageStatuses(this.state, this.config, this.provenance);
    await this.saveState();
  }

  /**
   * Restores initial state (empty reqs, tasks, designs; requirement active, rest locked).
   */
  public async resetState(): Promise<void> {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.state.codeChangedAt = null;
    this.state.scan = null;
    this.state = refreshStageStatuses(this.state, this.config, this.provenance);
    await this.saveState();
  }

  /**
   * Saves a requirement (create or update).
   * Validates input, clears blocked status, updates state.json, and returns result.
   */
  public async saveRequirement(input: { id?: string; title: string; criteria: string[] }): Promise<ModelOperationResult> {
    const res = saveRequirement(this.state, input);
    if (!res.ok || !res.newState) {
      return res;
    }
    this.state = refreshStageStatuses(res.newState, this.config, this.provenance);
    await this.saveState();
    return { ok: true, newState: this.state };
  }

  /**
   * Deletes a requirement and cascades the removal to tasks and designs.
   */
  public async deleteRequirement(reqId: string): Promise<ModelOperationResult> {
    const res = deleteRequirement(this.state, reqId);
    if (!res.ok || !res.newState) {
      return res;
    }
    this.state = refreshStageStatuses(res.newState, this.config, this.provenance);
    await this.saveState();
    return { ok: true, newState: this.state };
  }

  /**
   * Saves a task (create or update).
   */
  public async saveTask(input: { id?: string; title: string; reqIds: string[] }): Promise<ModelOperationResult> {
    const res = saveTask(this.state, input);
    if (!res.ok || !res.newState) {
      return res;
    }
    this.state = refreshStageStatuses(res.newState, this.config, this.provenance);
    await this.saveState();
    return { ok: true, newState: this.state };
  }

  /**
   * Deletes a task by ID.
   */
  public async deleteTask(taskId: string): Promise<ModelOperationResult> {
    const res = deleteTask(this.state, taskId);
    if (!res.ok || !res.newState) {
      return res;
    }
    this.state = refreshStageStatuses(res.newState, this.config, this.provenance);
    await this.saveState();
    return { ok: true, newState: this.state };
  }

  /**
   * Saves a design spec (create or update).
   */
  public async saveDesign(input: { id?: string; title: string; path?: string; reqIds: string[] }): Promise<ModelOperationResult> {
    const res = saveDesign(this.state, input);
    if (!res.ok || !res.newState) {
      return res;
    }
    this.state = refreshStageStatuses(res.newState, this.config, this.provenance);
    await this.saveState();
    return { ok: true, newState: this.state };
  }

  /**
   * Deletes a design spec by ID.
   */
  public async deleteDesign(designId: string): Promise<ModelOperationResult> {
    const res = deleteDesign(this.state, designId);
    if (!res.ok || !res.newState) {
      return res;
    }
    this.state = refreshStageStatuses(res.newState, this.config, this.provenance);
    await this.saveState();
    return { ok: true, newState: this.state };
  }

  /**
   * Persists the current configuration to /.buildtri/config.json.
   */
  public async saveConfig(newConfig?: BuildConfig): Promise<void> {
    if (newConfig) {
      this.config = newConfig;
    }
    const configPath = path.join(this.buildtriDir, CONFIG_FILE_NAME);
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  /**
   * Records that workspace code was modified, updating codeChangedAt.
   */
  public async markCodeChanged(): Promise<void> {
    this.state.codeChangedAt = new Date().toISOString();
    this.state = refreshStageStatuses(this.state, this.config, this.provenance);
    await this.saveState();
  }

  /**
   * Reads the entire contents of /.buildtri/changes.md.
   */
  public async getChangesContent(): Promise<string> {
    const changesPath = path.join(this.buildtriDir, CHANGES_FILE_NAME);
    try {
      return await fs.promises.readFile(changesPath, 'utf8');
    } catch {
      return '';
    }
  }

  /**
   * Reads the last 10 headings from /.buildtri/changes.md.
   */
  public async getChangesHeadings(): Promise<string[]> {
    const content = await this.getChangesContent();
    const lines = content.split(/\r?\n/);
    const headings = lines
      .filter((line) => line.startsWith('## '))
      .map((line) => line.substring(3).trim());
    return headings.slice(-10);
  }

  /**
   * Reads the entire contents of /.buildtri/release-notes.md.
   */
  public async getReleaseNotesContent(): Promise<string> {
    const notesPath = path.join(this.buildtriDir, RELEASE_NOTES_FILE_NAME);
    try {
      return await fs.promises.readFile(notesPath, 'utf8');
    } catch {
      return '';
    }
  }

  /**
   * Reads headings from /.buildtri/release-notes.md.
   */
  public async getReleaseNotesHeadings(): Promise<string[]> {
    try {
      const content = await this.getReleaseNotesContent();
      const lines = content.split(/\r?\n/);
      return lines
        .filter((line) => line.startsWith('## Release '))
        .map((line) => line.substring(3).trim());
    } catch {
      return [];
    }
  }

  /**
   * Calculates the number of change entries in changes.md since the previous release.
   * If there are no previous releases, counts all change entries.
   */
  public async countChangesSinceLastRelease(): Promise<number> {
    const notesContent = await this.getReleaseNotesContent();
    const changesContent = await this.getChangesContent();

    if (!changesContent.trim()) {
      return 0;
    }

    // Find the latest release timestamp if any: '## Release <ISO date>'
    const releaseMatches = Array.from(notesContent.matchAll(/^##\s+Release\s+(.+)$/gm));
    let lastReleaseIso: string | null = null;
    if (releaseMatches.length > 0) {
      lastReleaseIso = releaseMatches[releaseMatches.length - 1][1].trim();
    }

    // Match all change headings: '## <ISO date> · REQ-<n>'
    const changeMatches = Array.from(changesContent.matchAll(/^##\s+([^\s·]+)\s+·\s+REQ-/gm));

    if (!lastReleaseIso) {
      return changeMatches.length;
    }

    let count = 0;
    const lastReleaseTime = new Date(lastReleaseIso).getTime();

    for (const m of changeMatches) {
      const changeIso = m[1].trim();
      const changeTime = new Date(changeIso).getTime();
      if (!isNaN(changeTime) && !isNaN(lastReleaseTime)) {
        if (changeTime > lastReleaseTime) {
          count++;
        }
      } else if (changeIso > lastReleaseIso) {
        count++;
      }
    }

    return count;
  }

  /**
   * Appends release notes markdown to /.buildtri/release-notes.md (append-only).
   */
  public async appendReleaseNotes(markdown: string): Promise<void> {
    const notesPath = path.join(this.buildtriDir, RELEASE_NOTES_FILE_NAME);
    await fs.promises.appendFile(notesPath, markdown, 'utf8');
  }
}
