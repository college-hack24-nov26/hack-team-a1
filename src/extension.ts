import * as vscode from 'vscode';
import * as path from 'path';
import { StateManager } from './state';
import { BuildtriSidebarProvider } from './sidebar';
import { BuildtriAiViewProvider } from './aipanel';
import { BuildtriStudioPanel } from './panel';
import { LanesManager } from './lanes';
import { CommandRunner } from './runner';
import { SecretScanner } from './scan';
import { TraceabilityScanner } from './trace';
import { GeminiClient } from './ai';
import { StageId } from './types';

let stateManager: StateManager | undefined;
let lanesManager: LanesManager | undefined;
let runner: CommandRunner | undefined;
let scanner: SecretScanner | undefined;
let traceabilityScanner: TraceabilityScanner | undefined;
let geminiClient: GeminiClient | undefined;
let sidebarProvider: BuildtriSidebarProvider | undefined;
let aiProvider: BuildtriAiViewProvider | undefined;

/**
 * Extension activation entry point for Buildtri.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : process.cwd();

  // Initialize StateManager which ensures /.buildtri/ files exist
  stateManager = new StateManager(workspaceRoot);
  await stateManager.initialize();

  // Initialize CommandRunner, SecretScanner, and GeminiClient
  runner = new CommandRunner(context, stateManager, workspaceRoot);
  scanner = new SecretScanner(stateManager, workspaceRoot);
  geminiClient = new GeminiClient(context);
  context.subscriptions.push(scanner.getDiagnosticCollection());

  // Initialize TraceabilityScanner and run initial scan
  traceabilityScanner = new TraceabilityScanner(stateManager, workspaceRoot);
  context.subscriptions.push(traceabilityScanner);
  await traceabilityScanner.scanWorkspace();

  // Initialize LanesManager (decorations, status bar, and lane actions)
  lanesManager = new LanesManager(context, stateManager, workspaceRoot);
  context.subscriptions.push(lanesManager);

  // Register Activity Bar Sidebar View Provider (LEFT view)
  sidebarProvider = new BuildtriSidebarProvider(context.extensionUri, stateManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BuildtriSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register Secondary Sidebar View Provider (RIGHT Buildtri AI view)
  aiProvider = new BuildtriAiViewProvider(context.extensionUri, stateManager, geminiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BuildtriAiViewProvider.viewType,
      aiProvider
    )
  );

  // Connect sidebar to AI provider
  sidebarProvider.setAiViewProvider(aiProvider);

  // File watcher for code and documentation changes
  const codeWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  const isIgnored = (uri: vscode.Uri) => {
    const rel = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, '/');
    return (
      rel.startsWith('.git') ||
      rel.startsWith('node_modules') ||
      rel.startsWith('.buildtri') ||
      rel.startsWith('dist') ||
      rel.startsWith('build') ||
      rel.startsWith('out')
    );
  };

  const handleFileChange = async (uri: vscode.Uri) => {
    if (!isIgnored(uri) && stateManager) {
      await stateManager.markCodeChanged();
      sidebarProvider?.updateView();
      aiProvider?.updateView();
      if (BuildtriStudioPanel.currentPanel) {
        BuildtriStudioPanel.currentPanel.broadcastState();
      }
    }
  };

  codeWatcher.onDidCreate(handleFileChange, null, context.subscriptions);
  codeWatcher.onDidChange(handleFileChange, null, context.subscriptions);
  codeWatcher.onDidDelete(handleFileChange, null, context.subscriptions);
  context.subscriptions.push(codeWatcher);

  // Register Command: Open Buildtri Studio (Editor Webview Panel)
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.open', () => {
      if (stateManager && runner && scanner && traceabilityScanner && geminiClient) {
        BuildtriStudioPanel.createOrShow(
          context.extensionUri,
          stateManager,
          runner,
          scanner,
          traceabilityScanner,
          geminiClient
        );
      }
    })
  );

  // Register Command: Focus AI Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.focusAiPanel', async () => {
      await vscode.commands.executeCommand('buildtri.aiPanel.focus');
    })
  );

  // Register Command: Draft File With AI
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.draftWithAi', async (stageId: StageId, filePath: string) => {
      if (aiProvider) {
        await aiProvider.setDraftTarget(stageId, filePath, false);
      }
      await vscode.commands.executeCommand('buildtri.aiPanel.focus');
    })
  );

  // Register Command: Set Gemini API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        password: true,
        ignoreFocusOut: true,
        prompt: 'Enter your Gemini API key (stored securely in SecretStorage)'
      });
      if (key !== undefined) {
        if (geminiClient) {
          await geminiClient.setApiKey(key);
          if (BuildtriStudioPanel.currentPanel) {
            BuildtriStudioPanel.currentPanel.broadcastState();
          }
          vscode.window.showInformationMessage('Buildtri: Gemini API key saved to SecretStorage.');
        }
      }
    })
  );

  // Register Command: Clear Gemini API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.clearApiKey', async () => {
      if (geminiClient) {
        await geminiClient.clearApiKey();
        if (BuildtriStudioPanel.currentPanel) {
          BuildtriStudioPanel.currentPanel.broadcastState();
        }
        vscode.window.showInformationMessage('Buildtri: Gemini API key cleared from SecretStorage.');
      }
    })
  );

  // Register Command: Refresh Traceability
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.refreshTraceability', async () => {
      if (traceabilityScanner) {
        await traceabilityScanner.scanWorkspace();
        if (BuildtriStudioPanel.currentPanel) {
          BuildtriStudioPanel.currentPanel.broadcastState();
        }
        vscode.window.showInformationMessage('Buildtri: Traceability scan refreshed.');
      }
    })
  );

  // Register Command: Scan for Secrets
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.scanSecrets', async () => {
      if (scanner && stateManager) {
        const res = await scanner.runScan();
        if (BuildtriStudioPanel.currentPanel) {
          BuildtriStudioPanel.currentPanel.broadcastState();
        }
        if (res.findings.length === 0) {
          vscode.window.showInformationMessage('Buildtri: Secret scan completed. No secrets found.');
        } else {
          vscode.window.showErrorMessage(
            `Buildtri: Secret scan found ${res.findings.length} possible secret(s). Check Problems panel.`
          );
        }
      }
    })
  );

  // Register Command: Refresh State
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.refreshState', async () => {
      if (stateManager) {
        await stateManager.initialize();
        if (BuildtriStudioPanel.currentPanel) {
          BuildtriStudioPanel.currentPanel.broadcastState();
        }
        vscode.window.showInformationMessage('Buildtri state reloaded from disk.');
      }
    })
  );

  // Register Command: Load Demo Data (Dev-only helper)
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.loadDemoData', async () => {
      if (stateManager) {
        await stateManager.loadDemoData();
        if (BuildtriStudioPanel.currentPanel) {
          BuildtriStudioPanel.currentPanel.broadcastState();
        }
        vscode.window.showInformationMessage('Buildtri: Demo data loaded (2 REQs, 2 Tasks, 2 Designs).');
      }
    })
  );

  // Register Command: Reset State (Dev-only helper)
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.resetState', async () => {
      if (stateManager) {
        await stateManager.resetState();
        if (BuildtriStudioPanel.currentPanel) {
          BuildtriStudioPanel.currentPanel.broadcastState();
        }
        vscode.window.showInformationMessage('Buildtri: State reset to initial.');
      }
    })
  );

  // Register Command: Approve as Hybrid
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.approveHybrid', async () => {
      if (lanesManager) {
        await lanesManager.approveActiveFileAsHybrid();
      }
    })
  );

  // Register Command: Mark Active File as Vibe (dev)
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.markVibe', async () => {
      if (lanesManager) {
        await lanesManager.markActiveFileAsVibe();
      }
    })
  );

  // Register Command: Mark Active File as Manual (dev)
  context.subscriptions.push(
    vscode.commands.registerCommand('buildtri.markManual', async () => {
      if (lanesManager) {
        await lanesManager.markActiveFileAsManual();
      }
    })
  );

  console.log('Buildtri extension is now active.');
}

export function deactivate(): void {
  lanesManager?.dispose();
}

