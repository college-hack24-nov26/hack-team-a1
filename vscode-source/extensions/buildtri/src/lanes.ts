import * as vscode from 'vscode';
import * as path from 'path';
import { StateManager } from './state';
import { LANE_COLORS } from './lanecolors';
import { CodeLane } from './types';

/**
 * LanesManager handles VS Code gutter and background decorations,
 * code lane status bar indicator, and lane command execution.
 */
export class LanesManager {
  private vibeDecorationType: vscode.TextEditorDecorationType;
  private hybridDecorationType: vscode.TextEditorDecorationType;
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(
    context: vscode.ExtensionContext,
    private readonly stateManager: StateManager,
    private readonly workspaceRoot: string
  ) {
    // 1. Create Decoration Types
    const vibeIconUri = vscode.Uri.file(
      path.join(context.extensionUri.fsPath, LANE_COLORS.vibe.iconRelativePath!)
    );
    const hybridIconUri = vscode.Uri.file(
      path.join(context.extensionUri.fsPath, LANE_COLORS.hybrid.iconRelativePath!)
    );

    this.vibeDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: LANE_COLORS.vibe.backgroundColor,
      overviewRulerColor: LANE_COLORS.vibe.overviewRulerColor,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterIconPath: vibeIconUri,
      gutterIconSize: 'contain'
    });

    this.hybridDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: LANE_COLORS.hybrid.backgroundColor,
      overviewRulerColor: LANE_COLORS.hybrid.overviewRulerColor,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterIconPath: hybridIconUri,
      gutterIconSize: 'contain'
    });

    // 2. Setup Status Bar Item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'buildtri.open';
    this.disposables.push(this.statusBarItem);

    // 3. Register Event Listeners for Live Decoration and Status Bar Updates
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateActiveEditor();
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        editors.forEach((editor) => this.decorateEditor(editor));
      })
    );

    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        const editor = vscode.window.visibleTextEditors.find(
          (e) => e.document.uri.toString() === doc.uri.toString()
        );
        if (editor) {
          this.decorateEditor(editor);
        }
      })
    );

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.visibleTextEditors.find(
          (e) => e.document.uri.toString() === event.document.uri.toString()
        );
        if (editor) {
          this.decorateEditor(editor);
        }
      })
    );

    this.disposables.push(
      this.stateManager.onDidChangeProvenance(() => {
        this.updateAllVisibleEditors();
        this.updateStatusBar();
      })
    );

    // Initial decoration pass
    this.updateAllVisibleEditors();
    this.updateStatusBar();
  }

  public getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  public updateActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.decorateEditor(editor);
    }
    this.updateStatusBar();
  }

  public updateAllVisibleEditors(): void {
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.decorateEditor(editor);
    });
  }

  /**
   * Applies line decorations across the entire file according to its lane in provenance.json.
   * Manual files have no decorations.
   */
  public decorateEditor(editor: vscode.TextEditor): void {
    if (!editor || !editor.document || editor.document.isUntitled) {
      return;
    }

    const relPath = this.getRelativePath(editor.document.uri);
    if (!relPath) {
      editor.setDecorations(this.vibeDecorationType, []);
      editor.setDecorations(this.hybridDecorationType, []);
      return;
    }

    const provenance = this.stateManager.getProvenance();
    const fileEntry = provenance.files.find((f) => f.path === relPath);
    const lane: CodeLane = fileEntry ? fileEntry.lane : 'manual';

    const lineCount = editor.document.lineCount;
    const wholeFileRange = [
      new vscode.Range(
        0,
        0,
        lineCount - 1,
        Math.max(0, editor.document.lineAt(lineCount - 1).text.length)
      )
    ];

    if (lane === 'vibe') {
      editor.setDecorations(this.vibeDecorationType, wholeFileRange);
      editor.setDecorations(this.hybridDecorationType, []);
    } else if (lane === 'hybrid') {
      editor.setDecorations(this.hybridDecorationType, wholeFileRange);
      editor.setDecorations(this.vibeDecorationType, []);
    } else {
      // Manual files have no decoration
      editor.setDecorations(this.vibeDecorationType, []);
      editor.setDecorations(this.hybridDecorationType, []);
    }
  }

  /**
   * Updates the status bar item reflecting the active file's code lane.
   * Hidden when there is no active editor.
   */
  public updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document || editor.document.isUntitled) {
      this.statusBarItem.hide();
      return;
    }

    const relPath = this.getRelativePath(editor.document.uri);
    if (!relPath) {
      this.statusBarItem.hide();
      return;
    }

    const provenance = this.stateManager.getProvenance();
    const fileEntry = provenance.files.find((f) => f.path === relPath);
    const lane: CodeLane = fileEntry ? fileEntry.lane : 'manual';
    const reviewed = fileEntry ? fileEntry.reviewed : true;

    if (lane === 'vibe') {
      const reviewText = reviewed ? 'Reviewed' : 'Unreviewed';
      this.statusBarItem.text = `$(sparkle) Lane: Vibe (${reviewText})`;
      this.statusBarItem.tooltip = `Buildtri Lane: Vibe (${reviewText}). AI-generated code.`;
      this.statusBarItem.backgroundColor = reviewed
        ? undefined
        : new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (lane === 'hybrid') {
      this.statusBarItem.text = `$(git-merge) Lane: Hybrid`;
      this.statusBarItem.tooltip = `Buildtri Lane: Hybrid. AI draft edited and approved by human.`;
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = `$(pencil) Lane: Manual`;
      this.statusBarItem.tooltip = `Buildtri Lane: Manual. Human-authored code.`;
      this.statusBarItem.backgroundColor = undefined;
    }

    this.statusBarItem.show();
  }

  /**
   * Helper to resolve workspace-relative path with forward slashes.
   */
  public getRelativePath(uri: vscode.Uri): string | null {
    const fsPath = uri.fsPath;
    if (!fsPath.startsWith(this.workspaceRoot)) {
      return null;
    }
    const rel = path.relative(this.workspaceRoot, fsPath).replace(/\\/g, '/');
    return rel;
  }

  /**
   * Command: Buildtri: Approve as Hybrid
   */
  public async approveActiveFileAsHybrid(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
      vscode.window.showWarningMessage('No active editor to approve as Hybrid.');
      return;
    }

    const relPath = this.getRelativePath(editor.document.uri);
    if (!relPath) {
      vscode.window.showWarningMessage('File is outside workspace.');
      return;
    }

    const provenance = this.stateManager.getProvenance();
    const existing = provenance.files.find((f) => f.path === relPath);

    if (!existing || existing.lane !== 'vibe') {
      vscode.window.showInformationMessage('Active file is not in Vibe lane.');
      return;
    }

    const res = await this.stateManager.setLane(relPath, 'hybrid');
    if (res.ok) {
      this.decorateEditor(editor);
      this.updateStatusBar();
      vscode.window.showInformationMessage(`Buildtri: Approved ${relPath} as Hybrid.`);
    } else {
      vscode.window.showErrorMessage(res.error || 'Failed to approve as Hybrid.');
    }
  }

  /**
   * Command: Buildtri: Mark Active File as Vibe (dev)
   */
  public async markActiveFileAsVibe(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
      vscode.window.showWarningMessage('No active editor to mark as Vibe.');
      return;
    }

    const relPath = this.getRelativePath(editor.document.uri);
    if (!relPath) {
      vscode.window.showWarningMessage('File is outside workspace.');
      return;
    }

    const res = await this.stateManager.setLane(relPath, 'vibe');
    if (res.ok) {
      this.decorateEditor(editor);
      this.updateStatusBar();
      vscode.window.showInformationMessage(`Buildtri: Marked ${relPath} as Vibe.`);
    } else {
      vscode.window.showErrorMessage(res.error || 'Failed to mark as Vibe.');
    }
  }

  /**
   * Command: Buildtri: Mark Active File as Manual (dev)
   */
  public async markActiveFileAsManual(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
      vscode.window.showWarningMessage('No active editor to mark as Manual.');
      return;
    }

    const relPath = this.getRelativePath(editor.document.uri);
    if (!relPath) {
      vscode.window.showWarningMessage('File is outside workspace.');
      return;
    }

    const res = await this.stateManager.setLane(relPath, 'manual');
    if (res.ok) {
      this.decorateEditor(editor);
      this.updateStatusBar();
      vscode.window.showInformationMessage(`Buildtri: Marked ${relPath} as Manual.`);
    } else {
      vscode.window.showErrorMessage(res.error || 'Failed to mark as Manual.');
    }
  }

  public dispose(): void {
    this.vibeDecorationType.dispose();
    this.hybridDecorationType.dispose();
    this.statusBarItem.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
