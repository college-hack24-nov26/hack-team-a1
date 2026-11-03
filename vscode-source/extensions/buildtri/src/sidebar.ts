import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from './state';
import { StageId } from './types';
import { STAGE_ORDER } from './constants';
import { BuildtriAiViewProvider } from './aipanel';
import { BuildtriStudioPanel } from './panel';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class BuildtriSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'buildtri.panel';
  private view?: vscode.WebviewView;
  private selectedStageId: StageId = 'requirement';
  private aiViewProvider?: BuildtriAiViewProvider;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager
  ) {
    this.stateManager.onDidChangeState(() => {
      this.updateView();
    });
    this.stateManager.onDidChangeProvenance(() => {
      this.updateView();
    });
  }

  public setAiViewProvider(provider: BuildtriAiViewProvider): void {
    this.aiViewProvider = provider;
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

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'selectStage': {
          this.selectedStageId = message.stageId;
          if (BuildtriStudioPanel.currentPanel) {
            BuildtriStudioPanel.currentPanel.setSelectedStage(message.stageId);
          }
          this.updateView();
          break;
        }

        case 'openStudio': {
          await vscode.commands.executeCommand('buildtri.open');
          break;
        }

        case 'runGate': {
          const res = await this.stateManager.runGate(message.stageId);
          if (res.ok) {
            vscode.window.showInformationMessage(res.toastMessage);
          } else {
            vscode.window.showErrorMessage(res.toastMessage);
          }
          this.updateView();
          break;
        }

        case 'openFile': {
          await this.handleOpenFile(message.filePath);
          break;
        }

        case 'previewFile': {
          await this.handlePreviewFile(message.filePath);
          break;
        }

        case 'createFromTemplate': {
          await this.handleCreateFromTemplate(message.filePath);
          break;
        }

        case 'draftWithAi': {
          await this.handleDraftWithAi(message.stageId, message.filePath);
          break;
        }

        case 'approveHybrid': {
          await this.stateManager.approveHybridFile(message.filePath);
          vscode.window.showInformationMessage(`Approved '${message.filePath}' as Hybrid.`);
          this.updateView();
          break;
        }

        case 'toggleDeployCheck': {
          const state = this.stateManager.getState();
          if (Array.isArray(state.deployChecklist)) {
            const item = state.deployChecklist.find((c) => c.id === message.itemId);
            if (item) {
              item.checked = !!message.checked;
              this.stateManager.refreshStatuses();
              await this.stateManager.saveState();
              this.updateView();
            }
          }
          break;
        }
      }
    });

    this.updateView();
  }

  public updateView(): void {
    if (!this.view) {
      return;
    }

    const state = this.stateManager.getState();

    // Default selected stage to active stage if not set
    if (!this.selectedStageId) {
      const activeStage = state.stages.find((s) => s.status === 'active' || s.status === 'blocked');
      this.selectedStageId = activeStage ? activeStage.id : 'requirement';
    }

    const stageData = STAGE_ORDER.map((id, index) => {
      const stageObj = state.stages.find((s) => s.id === id) || {
        id,
        status: 'locked' as const,
        reasons: []
      };

      const filesResult = this.stateManager.getStageFiles(id);

      return {
        id,
        index: index + 1,
        title: id.charAt(0).toUpperCase() + id.slice(1),
        status: stageObj.status,
        reasons: stageObj.reasons,
        files: filesResult.validFiles,
        invalidFiles: filesResult.invalidFiles
      };
    });

    this.view.webview.postMessage({
      command: 'updateAll',
      stages: stageData,
      selectedStageId: this.selectedStageId,
      deployChecklist: state.deployChecklist || [],
      deployCommand: this.stateManager.getConfig().deployCommand || ''
    });
  }

  private async handleOpenFile(relPath: string): Promise<void> {
    const absPath = path.isAbsolute(relPath)
      ? relPath
      : path.join(this.stateManager.getWorkspaceRoot(), relPath);

    if (!fs.existsSync(absPath)) {
      vscode.window.showWarningMessage(`File does not exist: ${relPath}`);
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open ${relPath}: ${err?.message}`);
    }
  }

  private async handlePreviewFile(relPath: string): Promise<void> {
    const absPath = path.isAbsolute(relPath)
      ? relPath
      : path.join(this.stateManager.getWorkspaceRoot(), relPath);

    if (!fs.existsSync(absPath)) {
      vscode.window.showWarningMessage(`File does not exist: ${relPath}`);
      return;
    }

    try {
      const uri = vscode.Uri.file(absPath);
      await vscode.commands.executeCommand('markdown.showPreview', uri);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open preview for ${relPath}: ${err?.message}`);
    }
  }

  private async handleCreateFromTemplate(relPath: string): Promise<void> {
    const res = await this.stateManager.createFileFromTemplate(relPath);
    if (res.error) {
      vscode.window.showErrorMessage(`Failed to create ${relPath}: ${res.error}`);
      return;
    }

    // Open in editor
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(res.path));
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      // Ignore
    }

    this.updateView();
  }

  private async handleDraftWithAi(stageId: StageId, relPath: string): Promise<void> {
    if (this.aiViewProvider) {
      await this.aiViewProvider.setDraftTarget(stageId, relPath, false);
      await vscode.commands.executeCommand('buildtri.aiPanel.focus');
    } else {
      await vscode.commands.executeCommand('buildtri.aiPanel.focus');
    }
  }

  private getHtmlForWebview(): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    :root {
      --active-blue: #0e70c0;
      --active-light: #3794ff;
      --done-green: #16825d;
      --blocked-red: #c72e29;
      --locked-gray: #8c8c8c;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      background: var(--vscode-sideBar-background);
    }
    .stage-list {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow-y: auto;
    }
    .stage-item {
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
    }
    .stage-button {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      cursor: pointer;
      user-select: none;
      background: transparent;
      border: none;
      border-left: 3px solid transparent;
      text-align: left;
      width: 100%;
      color: var(--vscode-foreground);
      font-family: inherit;
      outline: none;
      transition: background 0.15s ease;
    }
    .stage-button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .stage-button:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    }
    .stage-button.selected {
      background: var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.08));
    }
    .stage-button.status-active {
      border-left-color: var(--active-light);
    }
    .stage-button.status-done {
      border-left-color: var(--done-green);
    }
    .stage-button.status-blocked {
      border-left-color: var(--blocked-red);
    }
    .badge-circle {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .badge-active {
      background: var(--active-blue);
      color: #ffffff;
    }
    .badge-done {
      background: var(--done-green);
      color: #ffffff;
    }
    .badge-blocked {
      background: var(--blocked-red);
      color: #ffffff;
    }
    .badge-locked {
      background: transparent;
      color: var(--locked-gray);
      font-size: 13px;
    }
    .stage-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }
    .stage-name {
      font-size: 13px;
      font-weight: 600;
    }
    .stage-status-sub {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-sub-active { color: var(--active-light); }
    .status-sub-done { color: #73c991; }
    .status-sub-blocked { color: #f14c4c; }
    .status-sub-locked { color: var(--locked-gray); }

    .chevron {
      font-size: 10px;
      color: var(--locked-gray);
      flex-shrink: 0;
      transition: transform 0.15s ease;
    }
    .chevron.open {
      transform: rotate(90deg);
    }

    .stage-drawer {
      padding: 10px 14px 14px 14px;
      background: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.05));
      display: none;
      flex-direction: column;
      gap: 10px;
    }
    .stage-drawer.open {
      display: flex;
    }
    .gate-reasons {
      font-size: 11px;
      padding: 6px 8px;
      border-radius: 4px;
      line-height: 1.35;
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.05));
    }
    .gate-reasons.blocked {
      border-left: 3px solid var(--blocked-red);
      color: #f14c4c;
    }
    .gate-reasons.ready {
      border-left: 3px solid var(--done-green);
      color: #73c991;
    }
    .gate-reasons.locked {
      border-left: 3px solid var(--locked-gray);
      color: var(--locked-gray);
    }
    .files-section-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .file-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
      border-radius: 4px;
    }
    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      outline: none;
    }
    .file-header:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .file-name-text {
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-textLink-foreground, #3794ff);
      word-break: break-all;
    }
    .file-name-text:hover {
      text-decoration: underline;
    }
    .file-chip {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .chip-missing {
      border: 1px solid var(--locked-gray);
      color: var(--locked-gray);
    }
    .chip-template {
      background: #855a00;
      color: #ffffff;
    }
    .chip-filled {
      background: #0e70c0;
      color: #ffffff;
    }
    .chip-ai-draft {
      background: #6c2bd9;
      color: #ffffff;
    }
    .chip-reviewed {
      background: #16825d;
      color: #ffffff;
    }
    .file-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    button.action-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 500;
      font-family: inherit;
    }
    button.action-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    button.action-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    button.action-btn.secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    button.action-btn.secondary:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    button.complete-btn {
      width: 100%;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: bold;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
    }
    button.complete-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    button.complete-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .invalid-banner {
      background: rgba(199, 46, 41, 0.15);
      border: 1px solid var(--blocked-red);
      color: #f14c4c;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.3;
    }
    .checklist-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      cursor: pointer;
    }
    .checklist-row input:disabled {
      cursor: not-allowed;
    }
    .locked-stage-note {
      font-size: 11px;
      color: var(--locked-gray);
      font-style: italic;
      line-height: 1.3;
    }
    .footer {
      padding: 10px 14px;
      border-top: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--vscode-sideBar-background);
    }
    .ui-help {
      font-size: 10px;
      opacity: 0.75;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <div class="stage-list" id="stageList" role="navigation" aria-label="Stages"></div>

  <div class="footer">
    <div class="ui-help">
      Lanes are declared by the user or by the Buildtri AI panel; Buildtri cannot detect code from other AI tools.
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let allStages = [];
    let activeSelectedStageId = 'requirement';
    let deployChecklistItems = [];
    let deployCommandStr = '';
    const openStageIds = new Set(['requirement']);

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'updateAll') {
        allStages = msg.stages || [];
        activeSelectedStageId = msg.selectedStageId || 'requirement';
        deployChecklistItems = msg.deployChecklist || [];
        deployCommandStr = msg.deployCommand || '';
        renderStages();
      }
    });

    function toggleStageAccordion(stageId) {
      if (openStageIds.has(stageId)) {
        openStageIds.delete(stageId);
      } else {
        openStageIds.add(stageId);
      }
      activeSelectedStageId = stageId;
      vscode.postMessage({ command: 'selectStage', stageId: stageId });
      renderStages();
    }

    function renderStages() {
      const listEl = document.getElementById('stageList');
      listEl.innerHTML = '';

      allStages.forEach((stage, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'stage-item';

        const isSelected = stage.id === activeSelectedStageId;
        const isOpen = openStageIds.has(stage.id);
        const isLocked = stage.status === 'locked';

        // Stage Header Button
        const btn = document.createElement('button');
        btn.className = 'stage-button status-' + stage.status + (isSelected ? ' selected' : '');
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.setAttribute('id', 'stage-btn-' + stage.id);

        btn.onclick = () => {
          toggleStageAccordion(stage.id);
        };

        btn.onkeydown = (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIdx = (index + 1) % allStages.length;
            const nextBtn = document.getElementById('stage-btn-' + allStages[nextIdx].id);
            if (nextBtn) { nextBtn.focus(); }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIdx = (index - 1 + allStages.length) % allStages.length;
            const prevBtn = document.getElementById('stage-btn-' + allStages[prevIdx].id);
            if (prevBtn) { prevBtn.focus(); }
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleStageAccordion(stage.id);
          }
        };

        const badge = document.createElement('div');
        badge.className = 'badge-circle badge-' + stage.status;
        if (stage.status === 'done') {
          badge.textContent = '✓';
        } else if (stage.status === 'blocked') {
          badge.textContent = '!';
        } else {
          badge.textContent = stage.index;
        }

        const meta = document.createElement('div');
        meta.className = 'stage-meta';

        const name = document.createElement('div');
        name.className = 'stage-name';
        name.textContent = stage.title;

        const sub = document.createElement('div');
        sub.className = 'stage-status-sub status-sub-' + stage.status;
        sub.textContent = stage.status;

        meta.appendChild(name);
        meta.appendChild(sub);

        const chevron = document.createElement('span');
        chevron.className = 'chevron' + (isOpen ? ' open' : '');
        chevron.textContent = '▶';

        btn.appendChild(badge);
        btn.appendChild(meta);
        btn.appendChild(chevron);
        itemEl.appendChild(btn);

        // Drawer (File list and actions right below button)
        if (isOpen) {
          const drawer = document.createElement('div');
          drawer.className = 'stage-drawer open';

          // Gate reasons
          const reasonsEl = document.createElement('div');
          const isBlocked = stage.status === 'blocked';
          if (isLocked) {
            reasonsEl.className = 'gate-reasons locked';
            reasonsEl.textContent = 'Stage is locked: Preceding stages must be completed first.';
          } else if (stage.status === 'done') {
            reasonsEl.className = 'gate-reasons ready';
            reasonsEl.textContent = 'Stage completed.';
          } else {
            reasonsEl.className = 'gate-reasons' + (isBlocked ? ' blocked' : ' ready');
            if (stage.reasons && stage.reasons.length > 0) {
              reasonsEl.innerHTML = stage.reasons.join('<br>');
            } else {
              reasonsEl.textContent = 'All gate criteria met.';
            }
          }
          drawer.appendChild(reasonsEl);

          // Complete stage button
          if (stage.status === 'active' || stage.status === 'blocked') {
            const completeBtn = document.createElement('button');
            completeBtn.className = 'complete-btn';
            completeBtn.textContent = 'Complete ' + stage.title + ' Stage';
            completeBtn.onclick = () => {
              vscode.postMessage({ command: 'runGate', stageId: stage.id });
            };
            drawer.appendChild(completeBtn);
          } else if (isLocked) {
            const completeBtn = document.createElement('button');
            completeBtn.className = 'complete-btn';
            completeBtn.disabled = true;
            completeBtn.title = 'Stage is locked: Preceding stages must be completed first.';
            completeBtn.textContent = 'Complete ' + stage.title + ' Stage (Locked)';
            drawer.appendChild(completeBtn);
          }

          // Deploy Checklist or Stage Files
          if (stage.id === 'deploy') {
            const title = document.createElement('div');
            title.className = 'files-section-title';
            title.textContent = 'Deployment Checklist';
            drawer.appendChild(title);

            deployChecklistItems.forEach((c) => {
              const row = document.createElement('label');
              row.className = 'checklist-row';
              const chk = document.createElement('input');
              chk.type = 'checkbox';
              chk.checked = !!c.checked;
              if (isLocked) {
                chk.disabled = true;
              }
              chk.onchange = () => {
                vscode.postMessage({
                  command: 'toggleDeployCheck',
                  itemId: c.id,
                  checked: chk.checked
                });
              };
              const txt = document.createElement('span');
              txt.textContent = c.label;
              row.appendChild(chk);
              row.appendChild(txt);
              drawer.appendChild(row);
            });

            const depNote = document.createElement('div');
            depNote.className = 'ui-help';
            depNote.textContent = deployCommandStr
              ? 'Deploy command: ' + deployCommandStr
              : 'Deploy: Buildtri records the confirmation unless config.deployCommand is set.';
            drawer.appendChild(depNote);
          } else {
            // Invalid paths banner
            if (stage.invalidFiles && stage.invalidFiles.length > 0) {
              stage.invalidFiles.forEach((inv) => {
                const b = document.createElement('div');
                b.className = 'invalid-banner';
                b.textContent = 'Invalid path "' + inv.path + '": ' + inv.reason;
                drawer.appendChild(b);
              });
            }

            const title = document.createElement('div');
            title.className = 'files-section-title';
            title.textContent = 'Required Files';
            drawer.appendChild(title);

            if (isLocked) {
              const lockedNote = document.createElement('div');
              lockedNote.className = 'locked-stage-note';
              lockedNote.textContent = 'Stage is locked. Files are visible below; creation and AI drafting actions are disabled.';
              drawer.appendChild(lockedNote);
            }

            if (!stage.files || stage.files.length === 0) {
              const emptyMsg = document.createElement('div');
              emptyMsg.className = 'ui-help';
              emptyMsg.textContent = stage.id === 'build'
                ? 'No code files tracked yet in provenance.json.'
                : 'No files required for this stage.';
              drawer.appendChild(emptyMsg);
            } else {
              stage.files.forEach((file) => {
                const fRow = document.createElement('div');
                fRow.className = 'file-row';

                // Header
                const fHeader = document.createElement('div');
                fHeader.className = 'file-header';
                fHeader.setAttribute('tabindex', '0');
                fHeader.setAttribute('role', 'button');
                fHeader.title = 'Click to open ' + file.path;
                fHeader.onclick = () => {
                  vscode.postMessage({ command: 'openFile', filePath: file.path });
                };
                fHeader.onkeydown = (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    vscode.postMessage({ command: 'openFile', filePath: file.path });
                  }
                };

                const fName = document.createElement('span');
                fName.className = 'file-name-text';
                fName.textContent = file.path;

                const chip = document.createElement('span');
                chip.className = 'file-chip chip-' + file.status;
                chip.textContent = file.status.replace('-', ' ');

                fHeader.appendChild(fName);
                fHeader.appendChild(chip);
                fRow.appendChild(fHeader);

                // Actions
                const actions = document.createElement('div');
                actions.className = 'file-actions';

                if (file.status === 'missing') {
                  const btnTemplate = document.createElement('button');
                  btnTemplate.className = 'action-btn';
                  btnTemplate.textContent = 'Create from template';
                  if (isLocked) {
                    btnTemplate.disabled = true;
                    btnTemplate.title = 'Stage is locked: Complete preceding stages first.';
                  } else {
                    btnTemplate.onclick = () => {
                      vscode.postMessage({ command: 'createFromTemplate', filePath: file.path });
                    };
                  }
                  actions.appendChild(btnTemplate);

                  const btnAi = document.createElement('button');
                  btnAi.className = 'action-btn secondary';
                  btnAi.textContent = 'Draft with AI';
                  if (isLocked) {
                    btnAi.disabled = true;
                    btnAi.title = 'Stage is locked: Complete preceding stages first.';
                  } else {
                    btnAi.onclick = () => {
                      vscode.postMessage({
                        command: 'draftWithAi',
                        stageId: stage.id,
                        filePath: file.path
                      });
                    };
                  }
                  actions.appendChild(btnAi);
                } else if (file.status === 'template') {
                  const btnOpen = document.createElement('button');
                  btnOpen.className = 'action-btn';
                  btnOpen.textContent = 'Open';
                  btnOpen.onclick = () => {
                    vscode.postMessage({ command: 'openFile', filePath: file.path });
                  };
                  actions.appendChild(btnOpen);

                  if (file.isMd) {
                    const btnPreview = document.createElement('button');
                    btnPreview.className = 'action-btn secondary';
                    btnPreview.textContent = 'Preview';
                    btnPreview.onclick = () => {
                      vscode.postMessage({ command: 'previewFile', filePath: file.path });
                    };
                    actions.appendChild(btnPreview);
                  }
                } else if (file.status === 'filled') {
                  const btnOpen = document.createElement('button');
                  btnOpen.className = 'action-btn';
                  btnOpen.textContent = 'Open';
                  btnOpen.onclick = () => {
                    vscode.postMessage({ command: 'openFile', filePath: file.path });
                  };
                  actions.appendChild(btnOpen);

                  if (file.isMd) {
                    const btnPreview = document.createElement('button');
                    btnPreview.className = 'action-btn secondary';
                    btnPreview.textContent = 'Preview';
                    btnPreview.onclick = () => {
                      vscode.postMessage({ command: 'previewFile', filePath: file.path });
                    };
                    actions.appendChild(btnPreview);
                  }
                } else if (file.status === 'ai-draft') {
                  const btnOpen = document.createElement('button');
                  btnOpen.className = 'action-btn';
                  btnOpen.textContent = 'Open';
                  btnOpen.onclick = () => {
                    vscode.postMessage({ command: 'openFile', filePath: file.path });
                  };
                  actions.appendChild(btnOpen);

                  const btnApprove = document.createElement('button');
                  btnApprove.className = 'action-btn secondary';
                  btnApprove.textContent = 'Approve as Hybrid';
                  if (isLocked) {
                    btnApprove.disabled = true;
                    btnApprove.title = 'Stage is locked: Complete preceding stages first.';
                  } else {
                    btnApprove.onclick = () => {
                      vscode.postMessage({ command: 'approveHybrid', filePath: file.path });
                    };
                  }
                  actions.appendChild(btnApprove);

                  if (file.isMd) {
                    const btnPreview = document.createElement('button');
                    btnPreview.className = 'action-btn secondary';
                    btnPreview.textContent = 'Preview';
                    btnPreview.onclick = () => {
                      vscode.postMessage({ command: 'previewFile', filePath: file.path });
                    };
                    actions.appendChild(btnPreview);
                  }
                } else if (file.status === 'reviewed') {
                  const btnOpen = document.createElement('button');
                  btnOpen.className = 'action-btn';
                  btnOpen.textContent = 'Open';
                  btnOpen.onclick = () => {
                    vscode.postMessage({ command: 'openFile', filePath: file.path });
                  };
                  actions.appendChild(btnOpen);

                  if (file.isMd) {
                    const btnPreview = document.createElement('button');
                    btnPreview.className = 'action-btn secondary';
                    btnPreview.textContent = 'Preview';
                    btnPreview.onclick = () => {
                      vscode.postMessage({ command: 'previewFile', filePath: file.path });
                    };
                    actions.appendChild(btnPreview);
                  }
                }

                fRow.appendChild(actions);
                drawer.appendChild(fRow);
              });
            }
          }

          itemEl.appendChild(drawer);
        }

        listEl.appendChild(itemEl);
      });
    }
  </script>
</body>
</html>`;
  }
}
