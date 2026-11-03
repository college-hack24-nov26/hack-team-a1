import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ImpactResult, OrphanTag, ReqImpact, ImpactFileItem } from './types';
import { StateManager } from './state';
import { DEFAULT_TEST_PATH_REGEX } from './constants';

export interface TagOccurrence {
  req: string;
  line: number;
}

/**
 * PURE FUNCTION: Extracts REQ tags from text using exact digits regex.
 * Format: \bREQ-(\d+)\b
 */
export function extractTags(text: string): TagOccurrence[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const results: TagOccurrence[] = [];
  const lines = text.split(/\r?\n/);
  const tagRegex = /\bREQ-(\d+)\b/g;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const lineNumber = i + 1; // 1-based
    tagRegex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(lineText)) !== null) {
      results.push({
        req: match[0],
        line: lineNumber
      });
    }
  }

  return results;
}

/**
 * PURE FUNCTION: Convenience helper to extract unique REQ IDs from text.
 */
export function extractReqTags(text: string): string[] {
  const occurrences = extractTags(text);
  return Array.from(new Set(occurrences.map((o) => o.req)));
}

/**
 * PURE FUNCTION: Builds the traceability impact map and orphan tag list.
 * Classifies files as tests if their path matches testPathRegex.
 * Limits lines to at most 20 per file.
 */
export function buildImpact(
  files: Array<{ path: string; text: string }>,
  reqIds: string[],
  testPathRegex?: string
): ImpactResult {
  const effectiveRegexStr =
    testPathRegex && testPathRegex.trim().length > 0
      ? testPathRegex.trim()
      : DEFAULT_TEST_PATH_REGEX;

  let testRegex: RegExp;
  try {
    testRegex = new RegExp(effectiveRegexStr, 'i');
  } catch {
    testRegex = new RegExp(DEFAULT_TEST_PATH_REGEX, 'i');
  }

  const knownReqSet = new Set(reqIds);
  const byReq: Record<string, ReqImpact> = {};

  // Initialize empty structure for every known REQ
  for (const rId of reqIds) {
    byReq[rId] = {
      files: [],
      tests: []
    };
  }

  const orphans: OrphanTag[] = [];

  for (const file of files) {
    const normPath = file.path.replace(/\\/g, '/');
    const isTest = testRegex.test(normPath);
    const tags = extractTags(file.text);

    // Group line numbers by reqId in this file (deduplicating lines)
    const reqLinesMap = new Map<string, Set<number>>();

    for (const tag of tags) {
      if (knownReqSet.has(tag.req)) {
        let set = reqLinesMap.get(tag.req);
        if (!set) {
          set = new Set<number>();
          reqLinesMap.set(tag.req, set);
        }
        if (set.size < 20) {
          set.add(tag.line);
        }
      } else {
        orphans.push({
          tag: tag.req,
          path: normPath,
          line: tag.line
        });
      }
    }

    for (const [reqId, lineSet] of reqLinesMap.entries()) {
      if (!byReq[reqId]) {
        byReq[reqId] = { files: [], tests: [] };
      }
      const item: ImpactFileItem = {
        path: normPath,
        lines: Array.from(lineSet).sort((a, b) => a - b)
      };
      if (isTest) {
        byReq[reqId].tests.push(item);
      } else {
        byReq[reqId].files.push(item);
      }
    }
  }

  return {
    byReq,
    orphans
  };
}

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
 * TraceabilityScanner walks workspace text files, extracts REQ tags,
 * and maintains an in-memory ImpactResult.
 */
export class TraceabilityScanner implements vscode.Disposable {
  private currentImpact: ImpactResult = { byReq: {}, orphans: [] };
  private debounceTimer?: NodeJS.Timeout;
  private disposables: vscode.Disposable[] = [];

  public onImpactUpdated?: (impact: ImpactResult) => void;

  constructor(
    private readonly stateManager: StateManager,
    private readonly workspaceRoot: string
  ) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    watcher.onDidCreate(() => this.scheduleRescan(), this, this.disposables);
    watcher.onDidChange(() => this.scheduleRescan(), this, this.disposables);
    watcher.onDidDelete(() => this.scheduleRescan(), this, this.disposables);
    this.disposables.push(watcher);
  }

  public getImpact(): ImpactResult {
    return this.currentImpact;
  }

  public scheduleRescan(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.scanWorkspace().catch((err) => {
        console.error('[TraceabilityScanner] Rescan error:', err);
      });
    }, 1000);
  }

  public async scanWorkspace(): Promise<ImpactResult> {
    const files: Array<{ path: string; text: string }> = [];
    await this.collectFiles(this.workspaceRoot, files);

    const state = this.stateManager.getState();
    const config = this.stateManager.getConfig();
    const reqIds = (state.reqs || []).map((r) => r.id);

    const impact = buildImpact(files, reqIds, config.testPathRegex);
    this.currentImpact = impact;

    if (this.onImpactUpdated) {
      this.onImpactUpdated(impact);
    }

    return impact;
  }

  private async collectFiles(
    dir: string,
    collected: Array<{ path: string; text: string }>
  ): Promise<void> {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await this.collectFiles(fullPath, collected);
        }
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.size > MAX_FILE_SIZE_BYTES || stat.size === 0) {
            continue;
          }

          // Check for binary content (NUL byte in first 8000 bytes)
          const buffer = Buffer.alloc(Math.min(8000, stat.size));
          const fd = await fs.promises.open(fullPath, 'r');
          await fd.read(buffer, 0, buffer.length, 0);
          await fd.close();

          if (buffer.includes(0)) {
            continue;
          }

          const text = await fs.promises.readFile(fullPath, 'utf8');
          const relPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
          collected.push({ path: relPath, text });
        } catch {
          // Skip inaccessible file
        }
      }
    }
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

