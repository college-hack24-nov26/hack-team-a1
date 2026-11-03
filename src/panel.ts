import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { StateManager } from './state';
import { BUILDTRI_DIR_NAME, CHANGES_FILE_NAME, UI_DIRECTORY } from './constants';
import { UiToExtensionMessage, ExtensionToUiMessage, StageId } from './types';
import { checkGateWarning, buildReleaseNotes } from './gates';
import { CommandRunner } from './runner';
import { SecretScanner } from './scan';
import { TraceabilityScanner } from './trace';
import { GeminiClient, extractCode } from './ai';
import { normalizePath } from './provenance';
import { LANE_COLORS } from './lanecolors';
import { getCompareData } from './compare';

/**
 * BuildtriStudioPanel manages the wide editor-tab WebviewPanel.
 * It serves the HTML/CSS/JS from the designated UI folder (ui-placeholder for M1/M2)
 * and handles the postMessage communication contract.
 */
export class BuildtriStudioPanel {
  public static currentPanel: BuildtriStudioPanel | undefined;
  public static readonly viewType = 'buildtri.studio';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly stateManager: StateManager;
  private readonly runner: CommandRunner;
  private readonly scanner: SecretScanner;
  private readonly traceabilityScanner: TraceabilityScanner;
  private readonly geminiClient: GeminiClient;
  private activeChangeReqId?: string;
  private selectedStage: StageId = 'requirement';
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    stateManager: StateManager,
    runner: CommandRunner,
    scanner: SecretScanner,
    traceabilityScanner: TraceabilityScanner,
    geminiClient: GeminiClient
  ): BuildtriStudioPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, reveal it.
    if (BuildtriStudioPanel.currentPanel) {
      BuildtriStudioPanel.currentPanel.panel.reveal(column);
      return BuildtriStudioPanel.currentPanel;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      BuildtriStudioPanel.viewType,
      'Buildtri Studio',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, UI_DIRECTORY))
        ]
      }
    );

    BuildtriStudioPanel.currentPanel = new BuildtriStudioPanel(
      panel,
      extensionUri,
      stateManager,
      runner,
      scanner,
      traceabilityScanner,
      geminiClient
    );
    return BuildtriStudioPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    stateManager: StateManager,
    runner: CommandRunner,
    scanner: SecretScanner,
    traceabilityScanner: TraceabilityScanner,
    geminiClient: GeminiClient
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.stateManager = stateManager;
    this.runner = runner;
    this.scanner = scanner;
    this.traceabilityScanner = traceabilityScanner;
    this.geminiClient = geminiClient;

    // Trigger state sync on impact update
    this.traceabilityScanner.onImpactUpdated = () => {
      this.broadcastState();
    };

    // Wire up runner streaming callbacks to webview
    this.runner.onOutputLine = (gate, line) => {
      this.panel.webview.postMessage({ type: 'run:output', gate, line });
    };

    this.runner.onStatusChange = (gate, status, exit) => {
      this.panel.webview.postMessage({ type: 'run:status', gate, status, exit });
    };

    // Set initial HTML content
    this.updateWebviewContent();

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages sent from the webview UI
    this.panel.webview.onDidReceiveMessage(
      (message: UiToExtensionMessage) => {
        this.handleMessage(message);
      },
      null,
      this.disposables
    );

    // Listen for state changes from the StateManager and forward to UI
    this.stateManager.onDidChangeState(
      () => {
        this.broadcastState();
      },
      null,
      this.disposables
    );
  }

  /**
   * Broadcasts the latest state, provenance, and impact to the UI.
   */
  public async broadcastState(): Promise<void> {
    const state = this.stateManager.getState();
    // Default selectedStage to active/blocked stage if not explicitly selected
    if (!this.selectedStage) {
      const activeStage = state.stages.find((s) => s.status === 'active' || s.status === 'blocked');
      this.selectedStage = activeStage ? activeStage.id : 'requirement';
    }

    const gateWarning = checkGateWarning(
      this.selectedStage,
      state,
      this.stateManager.getConfig(),
      this.stateManager.getProvenance()
    );

    const rawProvenance = this.stateManager.getProvenance();
    const workspaceRoot = this.stateManager.getWorkspaceRoot();
    const enrichedFiles = (rawProvenance.files || []).map((file) => {
      const fullPath = path.join(workspaceRoot, file.path);
      const missing = !fs.existsSync(fullPath);
      return {
        ...file,
        missing
      };
    });
    const provenance = {
      ...rawProvenance,
      files: enrichedFiles
    };

    const changesHeadings = await this.stateManager.getChangesHeadings();
    const changesContent = await this.stateManager.getChangesContent();
    const releaseNotesHeadings = await this.stateManager.getReleaseNotesHeadings();
    const compareData = getCompareData(provenance, state, changesContent);

    const aiKeySet = await this.geminiClient.isApiKeySet();
    const config = this.stateManager.getConfig();
    const aiModel = config.aiModel || '';
    const aiModelSet = aiModel.trim().length > 0;

    const message: ExtensionToUiMessage = {
      type: 'state',
      data: {
        state,
        provenance,
        impact: this.traceabilityScanner.getImpact(),
        selectedStage: this.selectedStage,
        gateWarning,
        logBuffers: this.runner.getAllLogBuffers(),
        changesHeadings,
        aiKeySet,
        aiModelSet,
        aiModel,
        laneColors: LANE_COLORS,
        deployChecklist: state.deployChecklist || [],
        compareData,
        releaseNotesHeadings
      }
    };
    this.panel.webview.postMessage(message);
  }

  public setSelectedStage(stageId: StageId): void {
    this.selectedStage = stageId;
    this.broadcastState();
  }

  /**
   * Handles incoming messages from the Webview UI.
   */
  private async handleMessage(message: UiToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        // Handshake: webview is ready to receive state
        this.broadcastState();
        break;

      case 'stage:select':
        // Change view focus in artifact viewer without modifying stage statuses
        this.selectedStage = message.stage;
        this.broadcastState();
        break;

      case 'gate:run': {
        const config = this.stateManager.getConfig();

        if (message.stage === 'test') {
          const testCmd = (config.testCommand || '').trim();
          if (testCmd) {
            await this.runner.executeCommand('test', testCmd);
          }
        } else if (message.stage === 'security') {
          // Secret scan first, then lint command
          await this.scanner.runScan();
          const lintCmd = (config.lintCommand || '').trim();
          if (lintCmd) {
            await this.runner.executeCommand('security', lintCmd);
          }
        } else if (message.stage === 'release') {
          // If buildCommand configured, run it
          const buildCmd = (config.buildCommand || '').trim();
          if (buildCmd) {
            await this.runner.executeCommand('release', buildCmd);
          }
        }

        // Evaluate gate for requested stage
        const result = await this.stateManager.runGate(message.stage);
        if (result.ok) {
          // If release stage passed, generate and append release notes
          if (message.stage === 'release') {
            const changesCount = await this.stateManager.countChangesSinceLastRelease();
            const notes = buildReleaseNotes(
              this.stateManager.getState(),
              this.stateManager.getProvenance(),
              changesCount,
              new Date().toISOString(),
              this.stateManager.getConfig()
            );
            await this.stateManager.appendReleaseNotes(notes);
          }

          // If gate passed, focus the newly activated stage
          const activeStage = this.stateManager.getState().stages.find((s) => s.status === 'active');
          if (activeStage) {
            this.selectedStage = activeStage.id;
          }
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: result.toastMessage
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: result.toastMessage
          });
        }
        this.broadcastState();
        break;
      }

      case 'deploy:check': {
        const state = this.stateManager.getState();
        const item = (state.deployChecklist || []).find((c) => c.id === message.id);
        if (!item) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Checklist item ${message.id} not found.`
          });
          break;
        }
        item.checked = !!message.checked;
        await this.stateManager.saveState(state);
        this.broadcastState();
        break;
      }

      case 'run:cancel': {
        this.runner.cancelRun(message.gate);
        break;
      }

      case 'req:save': {
        if (this.activeChangeReqId && message.req.id === this.activeChangeReqId) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Cannot update ${this.activeChangeReqId} while a change run is active for it.`
          });
          break;
        }
        const res = await this.stateManager.saveRequirement(message.req);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Validation failed for requirement.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: 'Requirement saved successfully.'
          });
        }
        this.broadcastState();
        break;
      }

      case 'req:delete': {
        if (this.activeChangeReqId && message.id === this.activeChangeReqId) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Cannot delete ${this.activeChangeReqId} while a change run is active for it.`
          });
          break;
        }
        const res = await this.stateManager.deleteRequirement(message.id);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Failed to delete requirement.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: `Requirement ${message.id} deleted.`
          });
        }
        this.broadcastState();
        break;
      }

      case 'task:save': {
        const res = await this.stateManager.saveTask(message.task);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Validation failed for task.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: 'Task saved successfully.'
          });
        }
        this.broadcastState();
        break;
      }

      case 'task:delete': {
        const res = await this.stateManager.deleteTask(message.id);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Failed to delete task.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: `Task ${message.id} deleted.`
          });
        }
        this.broadcastState();
        break;
      }

      case 'design:save': {
        const res = await this.stateManager.saveDesign(message.design);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Validation failed for design.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: 'Design spec saved successfully.'
          });
        }
        this.broadcastState();
        break;
      }

      case 'design:delete': {
        const res = await this.stateManager.deleteDesign(message.id);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Failed to delete design.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: `Design ${message.id} deleted.`
          });
        }
        this.broadcastState();
        break;
      }

      case 'lane:set': {
        const res = await this.stateManager.setLane(message.path, message.lane, message.reqIds);
        if (!res.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'Failed to set lane.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: `Lane updated to ${message.lane} for ${message.path}.`
          });
        }
        this.broadcastState();
        break;
      }

      case 'lane:remove': {
        await this.stateManager.removeTrackedFile(message.path);
        this.panel.webview.postMessage({
          type: 'toast',
          level: 'info',
          text: `Removed ${message.path} from provenance tracking.`
        });
        this.broadcastState();
        break;
      }

      case 'change:confirm': {
        const state = this.stateManager.getState();
        const req = (state.reqs || []).find((r) => r.id === message.reqId);

        if (!req) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Requirement ${message.reqId} not found.`
          });
          break;
        }

        if (req.status !== 'changed') {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Requirement ${message.reqId} is not in 'changed' status.`
          });
          break;
        }

        if (!['vibe', 'hybrid', 'manual'].includes(message.lane)) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Invalid lane ${message.lane}. Must be vibe, hybrid, or manual.`
          });
          break;
        }

        if (!vscode.workspace.isTrusted) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'Workspace is not trusted. Cannot execute change flow.'
          });
          break;
        }

        if (this.runner.isRunning()) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'Another command run is already in progress.'
          });
          break;
        }

        // Validate that reqId strictly matches REQ-<digits>
        if (!/^REQ-\d+$/.test(message.reqId)) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Invalid requirement ID: ${message.reqId}`
          });
          break;
        }

        const config = this.stateManager.getConfig();
        const rawCmd = (config.testByReqCommand || '').trim();
        if (!rawCmd) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'testByReqCommand is not configured.'
          });
          break;
        }

        // Step 1: Run testByReqCommand with only {req} replaced by REQ id
        const testCmd = rawCmd.replace(/\{req\}/g, message.reqId);
        this.activeChangeReqId = message.reqId;

        let testStatusText: string;
        let secStatusText: string = 'not run';
        let overallResult: 'PASS' | 'FAIL' = 'FAIL';

        const testRes = await this.runner.executeCommand('change', testCmd, message.reqId);

        if (!testRes.ok || testRes.exit !== 0) {
          testStatusText = testRes.exit === -1 ? 'cancelled' : `fail (exit ${testRes.exit})`;
        } else {
          testStatusText = 'pass';

          // Step 2: Run security gate (secret scan, then lintCommand)
          const scanRes = await this.scanner.runScan();
          let lintExit = 0;
          let lintFailed = false;

          if (config.lintCommand && config.lintCommand.trim()) {
            const lintRes = await this.runner.executeCommand('security', config.lintCommand.trim());
            lintExit = lintRes.exit;
            lintFailed = !lintRes.ok || lintExit !== 0;
          }

          const secretCount = (scanRes.findings || []).length;
          let secReasonsCount = secretCount;
          if (lintFailed) {
            secReasonsCount += 1;
          }

          if (secReasonsCount === 0) {
            secStatusText = 'pass';
            overallResult = 'PASS';
          } else {
            secStatusText = `fail (${secReasonsCount})`;
            overallResult = 'FAIL';
          }
        }

        // Step 3: Append entry to changes.md
        const impact = this.traceabilityScanner.getImpact();
        const reqImpact = impact.byReq[message.reqId];
        const affectedFiles =
          reqImpact && reqImpact.files.length > 0
            ? reqImpact.files.map((f) => f.path).join(', ')
            : 'none';
        const affectedTests =
          reqImpact && reqImpact.tests.length > 0
            ? reqImpact.tests.map((t) => t.path).join(', ')
            : 'none tagged';

        const changedFields =
          req.change && Array.isArray(req.change.fields) && req.change.fields.length > 0
            ? req.change.fields.join(', ')
            : 'title, criteria';

        const entry = [
          `## ${new Date().toISOString()} · ${message.reqId} · lane: ${message.lane}`,
          `- Changed fields: ${changedFields}`,
          `- Affected files: ${affectedFiles}`,
          `- Affected tests: ${affectedTests}`,
          `- Tests: ${testStatusText}`,
          `- Security: ${secStatusText}`,
          `- Result: ${overallResult}`,
          ''
        ].join('\n');

        const changesPath = path.join(this.stateManager.getWorkspaceRoot(), BUILDTRI_DIR_NAME, CHANGES_FILE_NAME);
        try {
          await fs.promises.appendFile(changesPath, entry, 'utf8');
        } catch (err) {
          console.error('Failed to append to changes.md:', err);
        }

        // Update REQ status
        if (overallResult === 'PASS') {
          req.status = 'open';
          delete req.change;
          await this.stateManager.saveState(state);
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: `Change flow PASS for ${message.reqId}. Status is open.`
          });
        } else {
          req.status = 'changed';
          await this.stateManager.saveState(state);
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: `Change flow FAIL for ${message.reqId}. Status remains changed.`
          });
        }

        this.activeChangeReqId = undefined;
        this.broadcastState();
        break;
      }

      case 'ai:ask': {
        if (this.geminiClient.isBusy()) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'An AI request is already in progress.'
          });
          break;
        }

        // Validate that all reqIds exist in state
        const state = this.stateManager.getState();
        const existingReqIds = new Set((state.reqs || []).map((r) => r.id));
        for (const rId of message.reqIds) {
          if (!existingReqIds.has(rId)) {
            this.panel.webview.postMessage({
              type: 'toast',
              level: 'error',
              text: `Requirement ${rId} does not exist.`
            });
            break;
          }
        }

        let selectedText: string | null = null;
        if (message.includeSelection) {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            this.panel.webview.postMessage({
              type: 'toast',
              level: 'error',
              text: 'No active editor found to include selection.'
            });
            break;
          }
          selectedText = editor.document.getText(editor.selection);
          if (!selectedText || selectedText.trim().length === 0) {
            this.panel.webview.postMessage({
              type: 'toast',
              level: 'error',
              text: 'Active editor has no text selected.'
            });
            break;
          }
        }

        this.panel.webview.postMessage({
          type: 'ai:status',
          status: 'running',
          message: 'Contacting Gemini...'
        });

        const config = this.stateManager.getConfig();
        const res = await this.geminiClient.ask(
          message.prompt,
          selectedText,
          config.aiModel || ''
        );

        if (res.ok && res.resultId && res.text !== undefined) {
          this.panel.webview.postMessage({
            type: 'ai:result',
            resultId: res.resultId,
            text: res.text,
            truncated: !!res.truncated
          });
          this.panel.webview.postMessage({
            type: 'ai:status',
            status: 'done'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'ai:status',
            status: 'error',
            message: res.error || 'AI generation failed'
          });
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: res.error || 'AI call failed'
          });
        }
        break;
      }

      case 'ai:cancel': {
        this.geminiClient.cancel();
        this.panel.webview.postMessage({
          type: 'ai:status',
          status: 'idle',
          message: 'Cancelled'
        });
        break;
      }

      case 'ai:insert': {
        const result = this.geminiClient.getLastResult(message.resultId);
        if (!result) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'AI result expired or not found. Please re-run prompt.'
          });
          break;
        }

        // Validate reqIds exist
        const state = this.stateManager.getState();
        const existingReqIds = new Set((state.reqs || []).map((r) => r.id));
        for (const rId of message.reqIds) {
          if (!existingReqIds.has(rId)) {
            this.panel.webview.postMessage({
              type: 'toast',
              level: 'error',
              text: `Requirement ${rId} does not exist.`
            });
            break;
          }
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'No active text editor to insert code into.'
          });
          break;
        }

        if (editor.document.isUntitled) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'Cannot insert into an untitled document. Please save the file first.'
          });
          break;
        }

        const workspaceRoot = this.stateManager.getWorkspaceRoot();
        const fsPath = editor.document.uri.fsPath;
        if (!fsPath.startsWith(workspaceRoot)) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'File must be inside the workspace.'
          });
          break;
        }

        const rawRel = path.relative(workspaceRoot, fsPath).replace(/\\/g, '/');
        const relPath = normalizePath(rawRel);
        if (!relPath) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'Cannot insert code into internal directories (.buildtri/ or node_modules/) or invalid path.'
          });
          break;
        }

        const codeToInsert = extractCode(result.text);
        const editSuccess = await editor.edit((editBuilder) => {
          editBuilder.replace(editor.selection, codeToInsert);
        });

        if (!editSuccess) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: 'Failed to insert code into active editor.'
          });
          break;
        }

        // Apply lane transition to 'vibe' with chosen reqIds and reviewed=false
        const laneRes = await this.stateManager.setLane(relPath, 'vibe', message.reqIds);
        if (!laneRes.ok) {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'error',
            text: laneRes.error || 'Failed to update code lane to vibe.'
          });
        } else {
          this.panel.webview.postMessage({
            type: 'toast',
            level: 'info',
            text: `Inserted code into ${relPath} (Lane: Vibe).`
          });
        }
        this.broadcastState();
        break;
      }

      default:
        console.log('BuildtriStudioPanel received unhandled message:', message);
        break;
    }
  }

  /**
   * Reads index.html from UI_DIRECTORY and transforms relative asset paths into webview URIs.
   * Strips external URLs and applies a strict nonce-based Content-Security-Policy.
   */
  private updateWebviewContent(): void {
    const uiDirUri = vscode.Uri.file(path.join(this.extensionUri.fsPath, UI_DIRECTORY));
    const indexPath = path.join(uiDirUri.fsPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      this.panel.webview.html = `<html><body><h3>Buildtri UI not found at: ${indexPath}</h3></body></html>`;
      return;
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    const webview = this.panel.webview;
    const nonce = crypto.randomBytes(16).toString('base64');

    // Replace relative paths with Webview URIs
    // E.g. href="style.css" or src="main.js"
    // Disallow external URLs (http/https) completely
    html = html.replace(/(href|src)="([^"]+)"/g, (_match, attr, relativePath) => {
      if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
        return `${attr}=""`;
      }
      if (relativePath.startsWith('data:')) {
        return `${attr}="${relativePath}"`;
      }
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, relativePath));
      return `${attr}="${assetUri.toString()}"`;
    });

    // Add nonce to script tags
    html = html.replace(/<script\b/g, `<script nonce="${nonce}"`);

    // Inject strict Content-Security-Policy into <head>
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src 'none'; connect-src 'none';">`;
    html = html.replace('<head>', `<head>\n  ${cspMeta}`);

    this.panel.webview.html = html;
  }

  public dispose(): void {
    BuildtriStudioPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

