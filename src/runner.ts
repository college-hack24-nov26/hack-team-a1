import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import { StateManager } from './state';
import { RunRecord } from './types';

export const DEFAULT_RUN_TIMEOUT_MS = 300_000; // 300 seconds timeout
const MAX_LOG_LINES = 2000;
const MAX_STATE_RUNS = 20;
const FLUSH_INTERVAL_MS = 50;

// ANSI escape code stripper regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export interface ActiveRun {
  gate: string;
  cmd: string;
  child: child_process.ChildProcess;
  cancelled: boolean;
  timedOut: boolean;
  timeoutHandle?: NodeJS.Timeout;
  startedAt: number;
  reqId?: string;
}

/**
 * CommandRunner executes shell commands configured in config.json.
 * It enforces workspace trust, modal confirmations, process tree termination,
 * and rate-limited output streaming to the webview UI.
 */
export class CommandRunner {
  private activeRun?: ActiveRun;
  private logBuffers: Map<string, string[]> = new Map();
  private pendingLines: Array<{ gate: string; line: string }> = [];
  private flushTimer?: NodeJS.Timeout;

  public onOutputLine?: (gate: string, line: string) => void;
  public onStatusChange?: (
    gate: string,
    status: 'idle' | 'running' | 'finished' | 'cancelled',
    exit?: number
  ) => void;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly stateManager: StateManager,
    private readonly workspaceRoot: string
  ) {}

  public isRunning(): boolean {
    return !!this.activeRun;
  }

  public getActiveGate(): string | undefined {
    return this.activeRun?.gate;
  }

  public getLogBuffer(gate: string): string[] {
    return this.logBuffers.get(gate) || [];
  }

  public getAllLogBuffers(): Record<string, string[]> {
    const res: Record<string, string[]> = {};
    for (const [gate, lines] of this.logBuffers.entries()) {
      res[gate] = lines;
    }
    return res;
  }

  /**
   * Executes a command for the given stage gate.
   */
  public async executeCommand(
    gate: string,
    cmdString: string,
    reqId?: string
  ): Promise<{ ok: boolean; exit: number; error?: string }> {
    // 1. Workspace Trust Safety Check
    if (!vscode.workspace.isTrusted) {
      const err = 'Workspace is not trusted. Buildtri refuses to run shell commands.';
      vscode.window.showErrorMessage(err);
      return { ok: false, exit: -1, error: err };
    }

    // 2. Concurrency Check: Only one command at a time
    if (this.activeRun) {
      const err = `A command is already running for gate '${this.activeRun.gate}'.`;
      vscode.window.showErrorMessage(err);
      return { ok: false, exit: -1, error: err };
    }

    // 3. Validate Working Directory
    const config = this.stateManager.getConfig();
    const rawWorkingDir = config.workingDir || '.';
    if (path.isAbsolute(rawWorkingDir) || rawWorkingDir.includes('..')) {
      const err = `Invalid workingDir '${rawWorkingDir}'. It must be relative and cannot contain '..'.`;
      vscode.window.showErrorMessage(err);
      return { ok: false, exit: -1, error: err };
    }

    const cwd = path.resolve(this.workspaceRoot, rawWorkingDir);
    if (!cwd.startsWith(this.workspaceRoot)) {
      const err = `Working directory points outside the workspace root.`;
      vscode.window.showErrorMessage(err);
      return { ok: false, exit: -1, error: err };
    }

    // 4. Modal Confirmation for First-Time Command String
    const approvedCommands = this.context.workspaceState.get<string[]>(
      'buildtri.approvedCommands',
      []
    );

    if (!approvedCommands.includes(cmdString)) {
      const relCwd = path.relative(this.workspaceRoot, cwd) || '.';
      const choice = await vscode.window.showInformationMessage(
        `Buildtri will run: "${cmdString}" in "${relCwd}"`,
        { modal: true },
        'Run',
        'Cancel'
      );

      if (choice !== 'Run') {
        return { ok: false, exit: -1, error: 'Command run cancelled by user.' };
      }

      approvedCommands.push(cmdString);
      await this.context.workspaceState.update('buildtri.approvedCommands', approvedCommands);
    }

    // 5. Initialize Buffer and Notify Running Status
    this.initBuffer(gate);
    this.emitLine(gate, `[Buildtri executing]: ${cmdString}`);
    this.notifyStatus(gate, 'running');

    return new Promise((resolve) => {
      let child: child_process.ChildProcess;
      try {
        child = child_process.spawn(cmdString, {
          shell: true,
          cwd,
          env: process.env // Never prints or exposes env vars
        });
      } catch (err: any) {
        const errMsg = `Failed to spawn process: ${err?.message || err}`;
        this.emitLine(gate, `[Error]: ${errMsg}`);
        this.notifyStatus(gate, 'finished', -1);
        resolve({ ok: false, exit: -1, error: errMsg });
        return;
      }

      const active: ActiveRun = {
        gate,
        cmd: cmdString,
        child,
        cancelled: false,
        timedOut: false,
        startedAt: Date.now(),
        reqId
      };
      this.activeRun = active;

      // Timeout watchdog
      active.timeoutHandle = setTimeout(() => {
        if (this.activeRun === active) {
          active.timedOut = true;
          this.emitLine(gate, `[Command timed out after ${DEFAULT_RUN_TIMEOUT_MS / 1000}s]`);
          this.killProcessTree(child);
        }
      }, DEFAULT_RUN_TIMEOUT_MS);

      // Line buffering
      let stdoutBuffer = '';
      let stderrBuffer = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString('utf8');
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || '';
        for (const line of lines) {
          this.emitLine(gate, line);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString('utf8');
        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || '';
        for (const line of lines) {
          this.emitLine(gate, line);
        }
      });

      const onExit = async (rawCode: number | null) => {
        if (active.timeoutHandle) {
          clearTimeout(active.timeoutHandle);
        }

        // Flush remaining buffered lines
        if (stdoutBuffer.trim().length > 0) {
          this.emitLine(gate, stdoutBuffer);
        }
        if (stderrBuffer.trim().length > 0) {
          this.emitLine(gate, stderrBuffer);
        }

        this.flushPendingLines();

        let exitCode = rawCode ?? 0;
        let status: 'finished' | 'cancelled' = 'finished';

        if (active.cancelled) {
          exitCode = -1;
          status = 'cancelled';
          this.emitLine(gate, '[Command cancelled by user]');
        } else if (active.timedOut) {
          exitCode = -1;
          status = 'cancelled';
        }

        this.emitLine(gate, `[Process exited with code ${exitCode}]`);
        this.notifyStatus(gate, status, exitCode);

        // Record run in state
        const state = this.stateManager.getState();
        const now = new Date();
        const durationMs = Date.now() - active.startedAt;
        const runRecord: RunRecord = {
          gate,
          cmd: cmdString,
          exit: exitCode,
          startedAt: new Date(active.startedAt).toISOString(),
          at: now.toISOString(),
          durationMs,
          reqId: active.reqId
        };

        if (!Array.isArray(state.runs)) {
          state.runs = [];
        }
        state.runs.push(runRecord);
        if (state.runs.length > MAX_STATE_RUNS) {
          state.runs = state.runs.slice(-MAX_STATE_RUNS);
        }

        await this.stateManager.saveState(state);
        this.activeRun = undefined;

        resolve({
          ok: exitCode === 0,
          exit: exitCode
        });
      };

      child.on('close', onExit);
      child.on('error', (err) => {
        this.emitLine(gate, `[Process error]: ${err.message}`);
        onExit(-1);
      });
    });
  }

  /**
   * Cancels the currently active run.
   */
  public cancelRun(gate?: string): void {
    if (!this.activeRun) {
      return;
    }
    if (gate && this.activeRun.gate !== gate) {
      return;
    }

    this.activeRun.cancelled = true;
    this.killProcessTree(this.activeRun.child);
  }

  /**
   * Terminates the process and its whole child process tree.
   */
  private killProcessTree(child: child_process.ChildProcess): void {
    const pid = child.pid;
    if (!pid) return;

    if (process.platform === 'win32') {
      try {
        child_process.spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
      } catch {
        child.kill('SIGKILL');
      }
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
  }

  private initBuffer(gate: string): void {
    if (!this.logBuffers.has(gate)) {
      this.logBuffers.set(gate, []);
    }
  }

  private emitLine(gate: string, rawLine: string): void {
    const clean = rawLine.replace(ANSI_REGEX, '');
    let buffer = this.logBuffers.get(gate);
    if (!buffer) {
      buffer = [];
      this.logBuffers.set(gate, buffer);
    }
    buffer.push(clean);
    if (buffer.length > MAX_LOG_LINES) {
      buffer.shift();
    }

    this.pendingLines.push({ gate, line: clean });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flushPendingLines();
    }, FLUSH_INTERVAL_MS);
  }

  private flushPendingLines(): void {
    if (this.pendingLines.length === 0) return;
    const linesToFlush = [...this.pendingLines];
    this.pendingLines = [];

    for (const item of linesToFlush) {
      this.onOutputLine?.(item.gate, item.line);
    }
  }

  private notifyStatus(
    gate: string,
    status: 'idle' | 'running' | 'finished' | 'cancelled',
    exit?: number
  ): void {
    this.onStatusChange?.(gate, status, exit);
  }
}

