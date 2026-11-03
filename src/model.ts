import {
  BuildtriState,
  Requirement,
  Task,
  Design,
  StateCounters
} from './types';

export interface ModelOperationResult {
  ok: boolean;
  newState?: BuildtriState;
  error?: string;
}

/**
 * Ensures state.counters is properly initialized with default zeroes.
 */
export function ensureCounters(state: BuildtriState): StateCounters {
  if (!state.counters) {
    state.counters = { req: 0, task: 0, design: 0 };
  }
  return state.counters;
}

/**
 * PURE FUNCTION: Generates the next sequential ID for a requirement (REQ-<n>).
 * Uses max(counter, existingMax) + 1 and never reuses a deleted number.
 */
export function generateNextReqId(state: BuildtriState): { nextId: string; nextNum: number } {
  const counters = ensureCounters(state);
  const maxExisting = (state.reqs || []).reduce((max, r) => {
    const num = parseInt(r.id.replace(/^REQ-/, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const nextNum = Math.max(counters.req || 0, maxExisting) + 1;
  return {
    nextId: `REQ-${nextNum}`,
    nextNum
  };
}

/**
 * PURE FUNCTION: Generates the next sequential ID for a task (T-<n>).
 */
export function generateNextTaskId(state: BuildtriState): { nextId: string; nextNum: number } {
  const counters = ensureCounters(state);
  const maxExisting = (state.tasks || []).reduce((max, t) => {
    const num = parseInt(t.id.replace(/^T-/, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const nextNum = Math.max(counters.task || 0, maxExisting) + 1;
  return {
    nextId: `T-${nextNum}`,
    nextNum
  };
}

/**
 * PURE FUNCTION: Generates the next sequential ID for a design spec (D-<n>).
 */
export function generateNextDesignId(state: BuildtriState): { nextId: string; nextNum: number } {
  const counters = ensureCounters(state);
  const maxExisting = (state.designs || []).reduce((max, d) => {
    const num = parseInt(d.id.replace(/^D-/, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const nextNum = Math.max(counters.design || 0, maxExisting) + 1;
  return {
    nextId: `D-${nextNum}`,
    nextNum
  };
}

/**
 * PURE FUNCTION: Saves (creates or updates) a requirement.
 * Validates that title is required and trimmed.
 * Criteria are sanitized into an array of non-empty trimmed strings.
 */
export function saveRequirement(
  state: BuildtriState,
  input: { id?: string; title: string; criteria: string[] }
): ModelOperationResult {
  const trimmedTitle = (input.title || '').trim();
  if (!trimmedTitle) {
    return { ok: false, error: 'Requirement title is required.' };
  }

  // Criteria: array of non-empty trimmed strings
  const sanitizedCriteria = Array.isArray(input.criteria)
    ? input.criteria.map((c) => (c || '').trim()).filter((c) => c.length > 0)
    : [];

  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
  ensureCounters(cloned);

  const existingIndex = input.id
    ? cloned.reqs.findIndex((r) => r.id === input.id)
    : -1;

  if (existingIndex >= 0) {
    const existing = cloned.reqs[existingIndex];
    const oldTitle = (existing.title || '').trim();
    const oldCriteria = (existing.criteria || [])
      .map((c) => (c || '').trim())
      .filter((c) => c.length > 0);

    const titleChanged = oldTitle !== trimmedTitle;
    const criteriaChanged =
      oldCriteria.length !== sanitizedCriteria.length ||
      oldCriteria.some((c, i) => c !== sanitizedCriteria[i]);

    const changedFields: ('title' | 'criteria')[] = [];
    if (titleChanged) changedFields.push('title');
    if (criteriaChanged) changedFields.push('criteria');

    cloned.reqs[existingIndex].title = trimmedTitle;
    cloned.reqs[existingIndex].criteria = sanitizedCriteria;

    // Requirement change detection (M6):
    // If title or criteria changed after normalization, mark 'changed' with change metadata
    if (changedFields.length > 0) {
      cloned.reqs[existingIndex].status = 'changed';
      cloned.reqs[existingIndex].change = {
        at: new Date().toISOString(),
        fields: changedFields
      };
    }
  } else {
    // Create new requirement
    const { nextId, nextNum } = generateNextReqId(cloned);
    cloned.counters.req = nextNum;
    const newReq: Requirement = {
      id: nextId,
      title: trimmedTitle,
      criteria: sanitizedCriteria,
      status: 'open'
    };
    cloned.reqs.push(newReq);
  }

  return { ok: true, newState: cloned };
}

/**
 * PURE FUNCTION: Deletes a requirement and cascades the removal
 * of its ID from all tasks and design specs.
 */
export function deleteRequirement(
  state: BuildtriState,
  reqId: string
): ModelOperationResult {
  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
  ensureCounters(cloned);

  // Remove the requirement
  cloned.reqs = cloned.reqs.filter((r) => r.id !== reqId);

  // Cascade: remove its id from tasks and designs
  cloned.tasks.forEach((task) => {
    if (Array.isArray(task.reqIds)) {
      task.reqIds = task.reqIds.filter((id) => id !== reqId);
    }
  });

  cloned.designs.forEach((design) => {
    if (Array.isArray(design.reqIds)) {
      design.reqIds = design.reqIds.filter((id) => id !== reqId);
    }
  });

  return { ok: true, newState: cloned };
}

/**
 * PURE FUNCTION: Saves (creates or updates) a task.
 * Validates title and ensures all linked reqIds exist.
 */
export function saveTask(
  state: BuildtriState,
  input: { id?: string; title: string; reqIds: string[] }
): ModelOperationResult {
  const trimmedTitle = (input.title || '').trim();
  if (!trimmedTitle) {
    return { ok: false, error: 'Task title is required.' };
  }

  const existingReqIds = new Set((state.reqs || []).map((r) => r.id));
  const validReqIds = Array.isArray(input.reqIds) ? input.reqIds : [];

  for (const reqId of validReqIds) {
    if (!existingReqIds.has(reqId)) {
      return { ok: false, error: `Requirement '${reqId}' does not exist.` };
    }
  }

  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
  ensureCounters(cloned);

  const existingIndex = input.id
    ? cloned.tasks.findIndex((t) => t.id === input.id)
    : -1;

  if (existingIndex >= 0) {
    // Update existing task
    cloned.tasks[existingIndex].title = trimmedTitle;
    cloned.tasks[existingIndex].reqIds = validReqIds;
  } else {
    // Create new task
    const { nextId, nextNum } = generateNextTaskId(cloned);
    cloned.counters.task = nextNum;
    const newTask: Task = {
      id: nextId,
      title: trimmedTitle,
      reqIds: validReqIds
    };
    cloned.tasks.push(newTask);
  }

  return { ok: true, newState: cloned };
}

/**
 * PURE FUNCTION: Deletes a task by ID.
 */
export function deleteTask(
  state: BuildtriState,
  taskId: string
): ModelOperationResult {
  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
  ensureCounters(cloned);

  cloned.tasks = cloned.tasks.filter((t) => t.id !== taskId);
  return { ok: true, newState: cloned };
}

/**
 * PURE FUNCTION: Saves (creates or updates) a design spec.
 * Validates title and ensures all linked reqIds exist. Path is optional text.
 */
export function saveDesign(
  state: BuildtriState,
  input: { id?: string; title: string; path?: string; reqIds: string[] }
): ModelOperationResult {
  const trimmedTitle = (input.title || '').trim();
  if (!trimmedTitle) {
    return { ok: false, error: 'Design title is required.' };
  }

  const existingReqIds = new Set((state.reqs || []).map((r) => r.id));
  const validReqIds = Array.isArray(input.reqIds) ? input.reqIds : [];

  for (const reqId of validReqIds) {
    if (!existingReqIds.has(reqId)) {
      return { ok: false, error: `Requirement '${reqId}' does not exist.` };
    }
  }

  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
  ensureCounters(cloned);

  const existingIndex = input.id
    ? cloned.designs.findIndex((d) => d.id === input.id)
    : -1;

  const pathValue = (input.path || '').trim();

  if (existingIndex >= 0) {
    // Update existing design
    cloned.designs[existingIndex].title = trimmedTitle;
    cloned.designs[existingIndex].path = pathValue;
    cloned.designs[existingIndex].reqIds = validReqIds;
  } else {
    // Create new design
    const { nextId, nextNum } = generateNextDesignId(cloned);
    cloned.counters.design = nextNum;
    const newDesign: Design = {
      id: nextId,
      title: trimmedTitle,
      path: pathValue,
      reqIds: validReqIds
    };
    cloned.designs.push(newDesign);
  }

  return { ok: true, newState: cloned };
}

/**
 * PURE FUNCTION: Deletes a design spec by ID.
 */
export function deleteDesign(
  state: BuildtriState,
  designId: string
): ModelOperationResult {
  const cloned: BuildtriState = JSON.parse(JSON.stringify(state));
  ensureCounters(cloned);

  cloned.designs = cloned.designs.filter((d) => d.id !== designId);
  return { ok: true, newState: cloned };
}

