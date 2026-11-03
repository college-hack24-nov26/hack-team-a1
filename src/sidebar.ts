import * as vscode from 'vscode';
import { StateManager } from './state';
import { Stage } from './types';

/**
 * BuildtriSidebarProvider provides a lightweight view in the Activity Bar.
 * It displays only the current stage and its gate status, along with an
 * 'Open Buildtri' button to launch the full editor studio tab.
 */
export class BuildtriSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'buildtri.statusView';
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager
  ) {
    this.stateManager.onDidChangeState(() => {
      this.updateView();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'openStudio') {
        vscode.commands.executeCommand('buildtri.open');
      }
    });

    this.updateView();
  }

  public updateView(): void {
    if (!this.view) {
      return;
    }
    const state = this.stateManager.getState();
    const currentStage =
      state.stages.find((s) => s.status === 'active') ||
      state.stages.find((s) => s.status === 'blocked') ||
      state.stages[0];

    this.view.webview.postMessage({
      command: 'updateStatus',
      stage: currentStage
    });
  }

  private getHtmlForWebview(): string {
    const state = this.stateManager.getState();
    const currentStage: Stage =
      state.stages.find((s) => s.status === 'active') ||
      state.stages.find((s) => s.status === 'blocked') ||
      state.stages[0];

    const stageId = currentStage ? currentStage.id : 'none';
    const status = currentStage ? currentStage.status : 'locked';
    const reasons = currentStage && currentStage.reasons.length > 0
      ? currentStage.reasons.join('<br>')
      : 'No gating issues reported.';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 12px;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      padding: 12px;
    }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
      margin-bottom: 4px;
    }
    .value {
      font-size: 15px;
      font-weight: 600;
      text-transform: capitalize;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-active { background: #0e70c0; color: #fff; }
    .badge-done { background: #16825d; color: #fff; }
    .badge-blocked { background: #c72e29; color: #fff; }
    .badge-locked { background: #5a5d5e; color: #fff; }
    .reasons {
      font-size: 12px;
      margin-top: 8px;
      opacity: 0.85;
      line-height: 1.4;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 13px;
      cursor: pointer;
      width: 100%;
      font-weight: 500;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="label">Current Stage</div>
    <div class="value" id="stageName">${stageId}</div>
    <div class="label">Gate Status</div>
    <span class="badge badge-${status}" id="statusBadge">${status}</span>
    <div class="reasons" id="reasonsText">${reasons}</div>
  </div>
  <button id="openBtn">Open Buildtri</button>

  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('openBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'openStudio' });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'updateStatus' && msg.stage) {
        document.getElementById('stageName').textContent = msg.stage.id;
        const badge = document.getElementById('statusBadge');
        badge.textContent = msg.stage.status;
        badge.className = 'badge badge-' + msg.stage.status;
        document.getElementById('reasonsText').innerHTML = 
          (msg.stage.reasons && msg.stage.reasons.length > 0)
            ? msg.stage.reasons.join('<br>')
            : 'No gating issues reported.';
      }
    });
  </script>
</body>
</html>`;
  }
}

