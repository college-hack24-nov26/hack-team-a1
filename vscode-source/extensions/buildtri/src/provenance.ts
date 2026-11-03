import {
  Provenance,
  ProvenanceFile,
  CodeLane,
  BuildtriState
} from './types';

export interface ApplyLaneResult {
  ok: boolean;
  provenance?: Provenance;
  error?: string;
}

/**
 * PURE FUNCTION: Normalizes and strictly validates a file path.
 * Must be workspace-relative with forward slashes.
 * Rejects absolute paths, '..', paths outside workspace, '/.buildtri/', and 'node_modules/'.
 */
export function normalizePath(pathStr: string): string | null {
  if (!pathStr || typeof pathStr !== 'string') {
    return null;
  }

  // Replace backslashes with forward slashes
  let clean = pathStr.replace(/\\/g, '/').trim();

  // Strip leading './'
  if (clean.startsWith('./')) {
    clean = clean.substring(2);
  }

  // Reject empty string
  if (clean.length === 0) {
    return null;
  }

  // Reject absolute paths (POSIX '/...' or Windows 'C:/...')
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) {
    return null;
  }

  // Reject directory traversal
  const segments = clean.split('/');
  if (segments.includes('..') || segments.includes('.')) {
    return null;
  }

  // Reject internal or protected directories
  if (clean === '.buildtri' || clean.startsWith('.buildtri/')) {
    return null;
  }

  if (clean === 'node_modules' || clean.startsWith('node_modules/')) {
    return null;
  }

  return clean;
}

/**
 * PURE FUNCTION: Applies a lane transition to a file in provenance.
 * Enforces transition constraints and sets the reviewed flag accordingly:
 * - vibe -> manual: NOT allowed directly (must be approved as hybrid first).
 * - vibe -> hybrid: allowed (sets reviewed=true).
 * - manual -> vibe / hybrid -> vibe: allowed (sets reviewed=false).
 * - reviewed is always true for hybrid and manual, and false for vibe.
 */
export function applyLaneSet(
  provenance: Provenance,
  input: { path: string; lane: CodeLane; reqIds?: string[] },
  state: BuildtriState
): ApplyLaneResult {
  const normPath = normalizePath(input.path);
  if (!normPath) {
    return {
      ok: false,
      error: `Invalid file path '${input.path}'. Paths must be workspace-relative and not inside .buildtri/ or node_modules/.`
    };
  }

  // Validate reqIds if supplied
  const existingReqIds = new Set((state.reqs || []).map((r) => r.id));
  const validReqIds: string[] = [];

  if (Array.isArray(input.reqIds)) {
    for (const reqId of input.reqIds) {
      if (!existingReqIds.has(reqId)) {
        return {
          ok: false,
          error: `Requirement '${reqId}' does not exist in state.`
        };
      }
      validReqIds.push(reqId);
    }
  }

  // Clone provenance
  const cloned: Provenance = JSON.parse(JSON.stringify(provenance));
  if (!Array.isArray(cloned.files)) {
    cloned.files = [];
  }

  const existingIndex = cloned.files.findIndex((f) => f.path === normPath);
  const currentLane: CodeLane = existingIndex >= 0 ? cloned.files[existingIndex].lane : 'manual';

  // Rule: vibe -> manual is NOT allowed
  if (currentLane === 'vibe' && input.lane === 'manual') {
    return {
      ok: false,
      error: `A Vibe file cannot be marked Manual directly; it must be approved as Hybrid.`
    };
  }

  // Rule: reviewed flag determination
  const reviewed = input.lane !== 'vibe';
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Update existing file entry
    const entry = cloned.files[existingIndex];
    entry.lane = input.lane;
    entry.reviewed = reviewed;
    entry.updatedAt = now;
    if (input.reqIds !== undefined) {
      entry.reqIds = validReqIds;
    }
  } else {
    // Add new file entry
    const newEntry: ProvenanceFile = {
      path: normPath,
      lane: input.lane,
      reviewed,
      reqIds: validReqIds,
      updatedAt: now
    };
    cloned.files.push(newEntry);
  }

  return {
    ok: true,
    provenance: cloned
  };
}

/**
 * PURE FUNCTION: Removes a tracked file entry from provenance.json.
 */
export function removeFile(
  provenance: Provenance,
  pathStr: string
): { ok: boolean; provenance: Provenance } {
  const normPath = normalizePath(pathStr) || pathStr.replace(/\\/g, '/');
  const cloned: Provenance = JSON.parse(JSON.stringify(provenance));

  if (Array.isArray(cloned.files)) {
    cloned.files = cloned.files.filter((f) => f.path !== normPath);
  } else {
    cloned.files = [];
  }

  return {
    ok: true,
    provenance: cloned
  };
}

