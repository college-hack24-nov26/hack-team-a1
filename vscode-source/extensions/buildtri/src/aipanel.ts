import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from './state';
import { GeminiClient, extractCode, MAX_PROMPT_CHARS } from './ai';
import { scanText } from './secrets';
import { StageId } from './types';
import { getStagePurposeDescription } from './templates';

export interface AiPanelContextState {
  stage: StageId;
  targetFile: string;
  includeStage: boolean;
  includeActiveFile: boolean;
  includePrevDocs: boolean;
  includeEditorSelection: boolean;
}

export class BuildtriAiViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'buildtri.aiPanel';
  private view?: vscode.WebviewView;

  private currentContext: AiPanelContextState = {
    stage: 'plan',
    targetFile: 'docs/PRD.md',
    includeStage: true,
    includeActiveFile: true,
    includePrevDocs: true,
    includeEditorSelection: false
  };

  private lastDraftResult: { targetFile: string; text: string } | null = null;
  private lastChatResult: string | null = null;
  private isProcessing = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager,
    private readonly geminiClient: GeminiClient
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

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ai:updateContext': {
          this.currentContext = { ...this.currentContext, ...message.context };
          this.updateView();
          break;
        }

        case 'ai:setApiKey': {
          await vscode.commands.executeCommand('buildtri.setApiKey');
          this.updateView();
          break;
        }

        case 'ai:clearApiKey': {
          await vscode.commands.executeCommand('buildtri.clearApiKey');
          this.updateView();
          break;
        }

        case 'ai:draft': {
          await this.handleDraftRequest(message.targetFile || this.currentContext.targetFile);
          break;
        }

        case 'ai:saveDraft': {
          await this.handleSaveDraft(message.targetFile, message.text, !!message.overwriteConfirmed);
          break;
        }

        case 'ai:chat': {
          await this.handleChatRequest(message.prompt);
          break;
        }

        case 'ai:cancel': {
          this.geminiClient.cancel();
          this.isProcessing = false;
          this.postMessage({ type: 'status', status: 'idle', message: 'Request cancelled.' });
          break;
        }

        case 'ai:insertActive': {
          await this.handleInsertActiveFile(message.text);
          break;
        }
      }
    });

    this.updateView();
  }

  public async setDraftTarget(stageId: StageId, filePath: string, autoDraft = false): Promise<void> {
    this.currentContext.stage = stageId;
    this.currentContext.targetFile = filePath;

    if (this.view) {
      this.view.show?.(true);
      this.updateView();
    } else {
      await vscode.commands.executeCommand('buildtri.aiPanel.focus');
    }

    if (autoDraft) {
      await this.handleDraftRequest(filePath);
    }
  }

  public async updateView(): Promise<void> {
    if (!this.view) {
      return;
    }

    const keySet = await this.geminiClient.isApiKeySet();
    const config = this.stateManager.getConfig();
    const modelSet = !!(config.aiModel && config.aiModel.trim().length > 0);
    const activeEditor = vscode.window.activeTextEditor;
    const activeFileName = activeEditor
      ? path.relative(this.stateManager.getWorkspaceRoot(), activeEditor.document.uri.fsPath).replace(/\\/g, '/')
      : '';

    this.postMessage({
      type: 'update',
      data: {
        keySet,
        modelSet,
        modelName: config.aiModel || '',
        context: this.currentContext,
        activeFileName,
        lastDraft: this.lastDraftResult,
        lastChat: this.lastChatResult,
        isProcessing: this.isProcessing
      }
    });
  }

  private postMessage(msg: any): void {
    if (this.view) {
      this.view.webview.postMessage(msg);
    }
  }

  private async buildDraftPrompt(filePath: string): Promise<{ prompt: string; contextCode: string | null }> {
    const stageId = this.currentContext.stage;
    const state = this.stateManager.getState();
    const workspaceRoot = this.stateManager.getWorkspaceRoot();

    let prompt = getStagePurposeDescription(stageId, filePath);

    if (this.currentContext.includeStage) {
      prompt += `\nCurrent Stage: ${stageId}.`;
    }

    if (Array.isArray(state.reqs) && state.reqs.length > 0) {
      prompt += '\n\nActive Requirements that must be addressed:\n';
      for (const r of state.reqs) {
        prompt += `- ${r.id}: ${r.title}\n  Criteria: ${r.criteria.join('; ')}\n`;
      }
    }

    let contextCode = '';

    if (this.currentContext.includePrevDocs) {
      const prevFiles = this.getPreviousStageFiles(stageId, filePath);
      for (const prevPath of prevFiles) {
        const absPrev = path.join(workspaceRoot, prevPath);
        if (fs.existsSync(absPrev)) {
          try {
            const content = fs.readFileSync(absPrev, 'utf8');
            if (content.trim()) {
              contextCode += `\n\n--- Document: ${prevPath} ---\n${content}\n`;
            }
          } catch {
            // Ignore unreadable previous docs
          }
        }
      }
    }

    if (this.currentContext.includeActiveFile) {
      const absTarget = path.join(workspaceRoot, filePath);
      if (fs.existsSync(absTarget)) {
        try {
          const content = fs.readFileSync(absTarget, 'utf8');
          if (content.trim()) {
            contextCode += `\n\n--- Existing Content of ${filePath} ---\n${content}\n`;
          }
        } catch {
          // Ignore
        }
      }
    }

    return {
      prompt: prompt.trim(),
      contextCode: contextCode.trim().length > 0 ? contextCode.trim() : null
    };
  }

  private getPreviousStageFiles(_stageId: string, filePath: string): string[] {
    const norm = filePath.replace(/\\/g, '/');
    if (norm === 'docs/PRD.md') {
      return ['docs/USER_REQUIREMENT.md'];
    }
    if (norm === 'docs/TRD.md') {
      return ['docs/USER_REQUIREMENT.md', 'docs/PRD.md'];
    }
    if (norm === 'docs/DESIGN.md') {
      return ['docs/PRD.md', 'docs/TRD.md'];
    }
    if (norm === 'docs/TEST_PLAN.md') {
      return ['docs/USER_REQUIREMENT.md', 'docs/PRD.md'];
    }
    if (norm === 'docs/SECURITY.md') {
      return ['docs/DESIGN.md', 'docs/TRD.md'];
    }
    return [];
  }

  private async handleDraftRequest(filePath: string): Promise<void> {
    if (this.isProcessing) {
      vscode.window.showWarningMessage('An AI request is already in progress.');
      return;
    }

    const config = this.stateManager.getConfig();
    if (!config.aiModel) {
      this.postMessage({ type: 'error', error: 'Set aiModel in config.json' });
      return;
    }

    const keySet = await this.geminiClient.isApiKeySet();
    if (!keySet) {
      this.postMessage({
        type: 'error',
        error: 'Gemini API key is not set. Click "Set API Key" above.'
      });
      return;
    }

    const { prompt, contextCode } = await this.buildDraftPrompt(filePath);

    // Run secret scan on outgoing prompt and context
    const findings = scanText(prompt + (contextCode || ''));
    if (findings.length > 0) {
      this.postMessage({
        type: 'error',
        error: `Text contains a possible secret (${findings[0].rule}); not sent.`
      });
      return;
    }

    if (prompt.length > MAX_PROMPT_CHARS) {
      this.postMessage({
        type: 'error',
        error: `Prompt exceeds limit of ${MAX_PROMPT_CHARS} characters.`
      });
      return;
    }

    this.isProcessing = true;
    this.postMessage({ type: 'status', status: 'running', message: `Drafting ${path.basename(filePath)}...` });

    try {
      const result = await this.geminiClient.ask(prompt, contextCode, config.aiModel);
      this.isProcessing = false;

      if (!result.ok || !result.text) {
        this.postMessage({ type: 'error', error: result.error || 'Gemini error' });
      } else {
        this.lastDraftResult = {
          targetFile: filePath,
          text: result.text
        };
        this.postMessage({
          type: 'draftResult',
          targetFile: filePath,
          text: result.text,
          truncated: !!result.truncated
        });
      }
    } catch (err: any) {
      this.isProcessing = false;
      this.postMessage({ type: 'error', error: err?.message || 'Error executing AI draft' });
    }
  }

  private async handleSaveDraft(filePath: string, text: string, overwriteConfirmed: boolean): Promise<void> {
    const res = await this.stateManager.saveDraftFile(filePath, text, overwriteConfirmed);

    if (!res.success) {
      if (res.error?.includes('Overwrite confirmation required')) {
        const confirm = await vscode.window.showWarningMessage(
          `'${filePath}' already exists with real content. Do you want to overwrite it?`,
          { modal: true },
          'Overwrite',
          'Cancel'
        );
        if (confirm === 'Overwrite') {
          await this.handleSaveDraft(filePath, text, true);
        }
      } else {
        vscode.window.showErrorMessage(`Buildtri: ${res.error}`);
        this.postMessage({ type: 'error', error: res.error });
      }
      return;
    }

    vscode.window.showInformationMessage(`Buildtri: Saved draft as ${filePath} (Lane: Vibe)`);
    this.postMessage({ type: 'status', status: 'idle', message: `Saved as ${filePath} (Lane: Vibe)` });

    // Open saved file in editor
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.stateManager.getWorkspaceRoot(), filePath);
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      // Ignore open error
    }
  }

  private async handleChatRequest(prompt: string): Promise<void> {
    if (this.isProcessing) {
      vscode.window.showWarningMessage('An AI request is already in progress.');
      return;
    }

    const config = this.stateManager.getConfig();
    if (!config.aiModel) {
      this.postMessage({ type: 'error', error: 'Set aiModel in config.json' });
      return;
    }

    let selection: string | null = null;
    if (this.currentContext.includeEditorSelection) {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        selection = editor.document.getText(editor.selection);
      }
    }

    // Secret scan
    const findings = scanText(prompt + (selection || ''));
    if (findings.length > 0) {
      this.postMessage({
        type: 'error',
        error: `Text contains a possible secret (${findings[0].rule}); not sent.`
      });
      return;
    }

    this.isProcessing = true;
    this.postMessage({ type: 'status', status: 'running', message: 'Generating response...' });

    try {
      const res = await this.geminiClient.ask(prompt, selection, config.aiModel);
      this.isProcessing = false;

      if (!res.ok || !res.text) {
        this.postMessage({ type: 'error', error: res.error || 'Gemini error' });
      } else {
        this.lastChatResult = res.text;
        this.postMessage({
          type: 'chatResult',
          text: res.text,
          truncated: !!res.truncated
        });
      }
    } catch (err: any) {
      this.isProcessing = false;
      this.postMessage({ type: 'error', error: err?.message || 'Error executing AI call' });
    }
  }

  private async handleInsertActiveFile(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor tab to insert code into.');
      return;
    }

    const code = extractCode(text);
    await editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, code);
      } else {
        editBuilder.replace(editor.selection, code);
      }
    });

    vscode.window.showInformationMessage('Inserted code into active editor tab.');
  }

  private getHtmlForWebview(): string {
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
      padding: 10px;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header-bar {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border, #3c3c3c);
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    .chip {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .chip-set { background: #16825d; color: #fff; }
    .chip-unset { background: #c72e29; color: #fff; }
    .notice {
      font-size: 11px;
      opacity: 0.75;
      line-height: 1.3;
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.05));
      padding: 6px 8px;
      border-radius: 4px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .chips-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .toggle-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      background: var(--vscode-badge-background, #3a3d41);
      color: var(--vscode-badge-foreground, #fff);
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
    }
    .toggle-chip.active {
      background: #0e70c0;
      border-color: #3794ff;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
      padding: 6px;
      font-family: var(--vscode-font-family);
      font-size: 12px;
      resize: vertical;
    }
    .output-box {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 4px;
      padding: 8px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      white-space: pre-wrap;
      max-height: 240px;
      overflow-y: auto;
    }
    .actions-row {
      display: flex;
      gap: 6px;
    }
    .error-msg {
      color: #f14c4c;
      font-size: 11px;
      line-height: 1.3;
    }
    .spinner {
      font-size: 11px;
      color: #3794ff;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="status-row">
      <span>Gemini API Key: <span id="keyChip" class="chip chip-unset">Not Set</span></span>
      <div>
        <button id="btnSetKey" class="secondary" style="padding: 2px 6px; font-size: 10px;">Set Key</button>
        <button id="btnClearKey" class="secondary" style="padding: 2px 6px; font-size: 10px;">Clear</button>
      </div>
    </div>
    <div class="status-row">
      <span>AI Model: <span id="modelChip" class="chip chip-unset">Not Set</span></span>
      <span id="modelNameText" style="font-family: monospace; font-size: 10px;"></span>
    </div>
  </div>

  <div class="notice">
    Lanes are declared by the user or by the Buildtri AI panel; Buildtri cannot detect code from other AI tools.
  </div>

  <div class="section-title">Context Chips</div>
  <div class="chips-group">
    <div class="toggle-chip active" id="chipStage">Stage: <span id="chipStageName">plan</span></div>
    <div class="toggle-chip active" id="chipActiveFile">File: <span id="chipFileName">docs/PRD.md</span></div>
    <div class="toggle-chip active" id="chipPrevDocs">Include Previous Docs</div>
    <div class="toggle-chip" id="chipSelection">Editor Selection</div>
  </div>

  <div class="section-title">Draft with AI</div>
  <div style="font-size: 11px; opacity: 0.85;">
    Target: <strong id="currentTargetLabel">docs/PRD.md</strong>
  </div>
  <div class="actions-row">
    <button id="btnDraft">Draft Document</button>
    <button id="btnCancel" class="secondary" style="display: none;">Cancel</button>
  </div>

  <div id="draftStatus" class="spinner" style="display: none;"></div>
  <div id="draftError" class="error-msg" style="display: none;"></div>

  <div id="draftOutputContainer" style="display: none; flex-direction: column; gap: 6px;">
    <div class="output-box" id="draftOutput"></div>
    <button id="btnSaveDraft">Save as <span id="saveTargetLabel">docs/PRD.md</span></button>
  </div>

  <div class="section-title" style="margin-top: 10px;">Free Chat</div>
  <textarea id="chatInput" rows="3" placeholder="Ask Gemini about requirements, architecture, or code..."></textarea>
  <div class="actions-row">
    <button id="btnChatSend">Send</button>
    <button id="btnChatClear" class="secondary">Clear</button>
  </div>

  <div id="chatStatus" class="spinner" style="display: none;"></div>
  <div id="chatOutputContainer" style="display: none; flex-direction: column; gap: 6px;">
    <div class="output-box" id="chatOutput"></div>
    <button id="btnInsertActive" class="secondary">Insert into active file</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let contextState = {
      stage: 'plan',
      targetFile: 'docs/PRD.md',
      includeStage: true,
      includeActiveFile: true,
      includePrevDocs: true,
      includeEditorSelection: false
    };

    let activeDraftText = '';
    let activeChatText = '';

    // Elements
    const keyChip = document.getElementById('keyChip');
    const modelChip = document.getElementById('modelChip');
    const modelNameText = document.getElementById('modelNameText');
    const btnSetKey = document.getElementById('btnSetKey');
    const btnClearKey = document.getElementById('btnClearKey');

    const chipStage = document.getElementById('chipStage');
    const chipStageName = document.getElementById('chipStageName');
    const chipActiveFile = document.getElementById('chipActiveFile');
    const chipFileName = document.getElementById('chipFileName');
    const chipPrevDocs = document.getElementById('chipPrevDocs');
    const chipSelection = document.getElementById('chipSelection');

    const currentTargetLabel = document.getElementById('currentTargetLabel');
    const btnDraft = document.getElementById('btnDraft');
    const btnCancel = document.getElementById('btnCancel');
    const draftStatus = document.getElementById('draftStatus');
    const draftError = document.getElementById('draftError');
    const draftOutputContainer = document.getElementById('draftOutputContainer');
    const draftOutput = document.getElementById('draftOutput');
    const btnSaveDraft = document.getElementById('btnSaveDraft');
    const saveTargetLabel = document.getElementById('saveTargetLabel');

    const chatInput = document.getElementById('chatInput');
    const btnChatSend = document.getElementById('btnChatSend');
    const btnChatClear = document.getElementById('btnChatClear');
    const chatStatus = document.getElementById('chatStatus');
    const chatOutputContainer = document.getElementById('chatOutputContainer');
    const chatOutput = document.getElementById('chatOutput');
    const btnInsertActive = document.getElementById('btnInsertActive');

    // Context chip listeners
    chipStage.addEventListener('click', () => {
      contextState.includeStage = !contextState.includeStage;
      chipStage.classList.toggle('active', contextState.includeStage);
      sendContextUpdate();
    });

    chipActiveFile.addEventListener('click', () => {
      contextState.includeActiveFile = !contextState.includeActiveFile;
      chipActiveFile.classList.toggle('active', contextState.includeActiveFile);
      sendContextUpdate();
    });

    chipPrevDocs.addEventListener('click', () => {
      contextState.includePrevDocs = !contextState.includePrevDocs;
      chipPrevDocs.classList.toggle('active', contextState.includePrevDocs);
      sendContextUpdate();
    });

    chipSelection.addEventListener('click', () => {
      contextState.includeEditorSelection = !contextState.includeEditorSelection;
      chipSelection.classList.toggle('active', contextState.includeEditorSelection);
      sendContextUpdate();
    });

    function sendContextUpdate() {
      vscode.postMessage({ type: 'ai:updateContext', context: contextState });
    }

    btnSetKey.addEventListener('click', () => vscode.postMessage({ type: 'ai:setApiKey' }));
    btnClearKey.addEventListener('click', () => vscode.postMessage({ type: 'ai:clearApiKey' }));

    btnDraft.addEventListener('click', () => {
      draftError.style.display = 'none';
      vscode.postMessage({ type: 'ai:draft', targetFile: contextState.targetFile });
    });

    btnCancel.addEventListener('click', () => {
      vscode.postMessage({ type: 'ai:cancel' });
    });

    btnSaveDraft.addEventListener('click', () => {
      if (activeDraftText && contextState.targetFile) {
        vscode.postMessage({
          type: 'ai:saveDraft',
          targetFile: contextState.targetFile,
          text: activeDraftText
        });
      }
    });

    btnChatSend.addEventListener('click', () => {
      const text = chatInput.value.trim();
      if (text) {
        vscode.postMessage({ type: 'ai:chat', prompt: text });
      }
    });

    btnChatClear.addEventListener('click', () => {
      chatInput.value = '';
      chatOutputContainer.style.display = 'none';
      activeChatText = '';
    });

    btnInsertActive.addEventListener('click', () => {
      if (activeChatText) {
        vscode.postMessage({ type: 'ai:insertActive', text: activeChatText });
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'update': {
          const d = msg.data;
          keyChip.textContent = d.keySet ? 'Set' : 'Not Set';
          keyChip.className = 'chip ' + (d.keySet ? 'chip-set' : 'chip-unset');

          modelChip.textContent = d.modelSet ? 'Set' : 'Not Set';
          modelChip.className = 'chip ' + (d.modelSet ? 'chip-set' : 'chip-unset');
          modelNameText.textContent = d.modelName || '';

          if (d.context) {
            contextState = { ...contextState, ...d.context };
            chipStageName.textContent = contextState.stage;
            chipFileName.textContent = contextState.targetFile || d.activeFileName || 'None';
            currentTargetLabel.textContent = contextState.targetFile || 'docs/PRD.md';
            saveTargetLabel.textContent = contextState.targetFile || 'docs/PRD.md';

            chipStage.classList.toggle('active', !!contextState.includeStage);
            chipActiveFile.classList.toggle('active', !!contextState.includeActiveFile);
            chipPrevDocs.classList.toggle('active', !!contextState.includePrevDocs);
            chipSelection.classList.toggle('active', !!contextState.includeEditorSelection);
          }

          if (d.isProcessing) {
            btnCancel.style.display = 'inline-block';
          } else {
            btnCancel.style.display = 'none';
          }
          break;
        }

        case 'status': {
          if (msg.status === 'running') {
            draftStatus.textContent = msg.message || 'Processing...';
            draftStatus.style.display = 'block';
            chatStatus.textContent = msg.message || 'Processing...';
            chatStatus.style.display = 'block';
            btnCancel.style.display = 'inline-block';
          } else {
            draftStatus.style.display = 'none';
            chatStatus.style.display = 'none';
            btnCancel.style.display = 'none';
          }
          break;
        }

        case 'error': {
          draftStatus.style.display = 'none';
          chatStatus.style.display = 'none';
          btnCancel.style.display = 'none';
          draftError.textContent = msg.error;
          draftError.style.display = 'block';
          break;
        }

        case 'draftResult': {
          draftStatus.style.display = 'none';
          btnCancel.style.display = 'none';
          activeDraftText = msg.text;
          draftOutput.textContent = msg.text;
          draftOutputContainer.style.display = 'flex';
          saveTargetLabel.textContent = msg.targetFile;
          break;
        }

        case 'chatResult': {
          chatStatus.style.display = 'none';
          btnCancel.style.display = 'none';
          activeChatText = msg.text;
          chatOutput.textContent = msg.text;
          chatOutputContainer.style.display = 'flex';
          break;
        }
      }
    });
  </script>
</body>
</html>`;
  }
}
