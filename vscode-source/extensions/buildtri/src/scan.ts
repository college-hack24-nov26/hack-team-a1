import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { scanText } from './secrets';
import { SecretScanFinding, SecretScanResult } from './types';
import { StateManager } from './state';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.buildtri',
  'dist',
  'build',
  'out'
]);

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

/**
 * SecretScanner inspects the workspace for credentials and reports
 * findings via VS Code Diagnostics and state.scan.
 */
export class SecretScanner {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(
    private readonly stateManager: StateManager,
    private readonly workspaceRoot: string
  ) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('Buildtri Secrets');
  }

  public getDiagnosticCollection(): vscode.DiagnosticCollection {
    return this.diagnosticCollection;
  }

  /**
   * Scans the entire workspace for secret leaks.
   */
  public async runScan(): Promise<SecretScanResult> {
    const findings: SecretScanFinding[] = [];
    await this.scanDirectory(this.workspaceRoot, findings);

    const scanResult: SecretScanResult = {
      at: new Date().toISOString(),
      findings
    };

    // Save scan result in state.json
    const state = this.stateManager.getState();
    state.scan = scanResult;
    await this.stateManager.saveState(state);

    // Update Problems panel diagnostics
    this.updateDiagnostics(findings);

    return scanResult;
  }

  /**
   * Recursively walks directory tree and scans valid text files.
   */
  private async scanDirectory(dir: string, findings: SecretScanFinding[]): Promise<void> {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await this.scanDirectory(fullPath, findings);
        }
      } else if (entry.isFile()) {
        await this.scanFile(fullPath, findings);
      }
    }
  }

  /**
   * Checks file size and binary header before scanning text content.
   */
  private async scanFile(fullPath: string, findings: SecretScanFinding[]): Promise<void> {
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.size > MAX_FILE_SIZE_BYTES || stat.size === 0) {
        return;
      }

      // Check for binary content (NUL byte in the first 8000 bytes)
      const buffer = Buffer.alloc(Math.min(8000, stat.size));
      const fd = await fs.promises.open(fullPath, 'r');
      await fd.read(buffer, 0, buffer.length, 0);
      await fd.close();

      if (buffer.includes(0)) {
        // Binary file, skip
        return;
      }

      const text = await fs.promises.readFile(fullPath, 'utf8');
      const fileFindings = scanText(text);

      if (fileFindings.length > 0) {
        const relPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
        for (const finding of fileFindings) {
          findings.push({
            path: relPath,
            line: finding.line,
            rule: finding.rule
          });
        }
      }
    } catch (err) {
      console.warn(`[Buildtri Scan] Failed to scan file ${fullPath}:`, err);
    }
  }

  /**
   * Updates the VS Code Problems panel with diagnostic markers.
   */
  public updateDiagnostics(findings: SecretScanFinding[]): void {
    this.diagnosticCollection.clear();

    const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

    for (const f of findings) {
      const fullPath = path.join(this.workspaceRoot, f.path);
      const uri = vscode.Uri.file(fullPath);
      const uriStr = uri.toString();

      const lineIndex = Math.max(0, f.line - 1);
      const range = new vscode.Range(lineIndex, 0, lineIndex, 200);

      const diagnostic = new vscode.Diagnostic(
        range,
        `Possible secret (${f.rule})`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = 'Buildtri Secrets';

      const existing = diagnosticsByUri.get(uriStr) || [];
      existing.push(diagnostic);
      diagnosticsByUri.set(uriStr, existing);
    }

    for (const [uriStr, diagList] of diagnosticsByUri.entries()) {
      this.diagnosticCollection.set(vscode.Uri.parse(uriStr), diagList);
    }
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

