import { Stage, BuildConfig, BuildtriState, Provenance, StageId, Requirement, Task, Design, DeployChecklistItem } from './types';

/**
 * Path to the UI assets directory relative to the extension root.
 * Change this single constant when the real /ui folder is ready.
 */
export const UI_DIRECTORY = 'ui-placeholder';

export const BUILDTRI_DIR_NAME = '.buildtri';
export const STATE_FILE_NAME = 'state.json';
export const PROVENANCE_FILE_NAME = 'provenance.json';
export const CONFIG_FILE_NAME = 'config.json';
export const CHANGES_FILE_NAME = 'changes.md';
export const RELEASE_NOTES_FILE_NAME = 'release-notes.md';

/**
 * Four fixed checklist items for the Deploy gate.
 */
export const DEFAULT_DEPLOY_CHECKLIST: DeployChecklistItem[] = [
  { id: 'rel-notes', label: 'Release notes reviewed', checked: false },
  { id: 'rollback', label: 'Rollback plan noted', checked: false },
  { id: 'no-secrets', label: 'No secrets in the repository', checked: false },
  { id: 'target-confirmed', label: 'Deployment target confirmed', checked: false }
];

/**
 * The strictly ordered sequence of stages in Buildtri.
 */
export const STAGE_ORDER: StageId[] = [
  'requirement',
  'plan',
  'design',
  'build',
  'test',
  'security',
  'release',
  'deploy'
];

/**
 * Default stage flow defined by the Buildtri specification.
 * Stages are locked in sequence until preceding stage gates pass.
 */
export const DEFAULT_STAGES: Stage[] = [
  { id: 'requirement', status: 'active', reasons: ['No requirements defined. At least 1 requirement is needed.'] },
  { id: 'plan', status: 'locked', reasons: ['Locked until requirement stage is done.'] },
  { id: 'design', status: 'locked', reasons: ['Locked until plan stage is done.'] },
  { id: 'build', status: 'locked', reasons: ['Gate not implemented yet.'] },
  { id: 'test', status: 'locked', reasons: ['Gate not implemented yet.'] },
  { id: 'security', status: 'locked', reasons: ['Gate not implemented yet.'] },
  { id: 'release', status: 'locked', reasons: ['Gate not implemented yet.'] },
  { id: 'deploy', status: 'locked', reasons: ['Gate not implemented yet.'] }
];

export const DEMO_REQS: Requirement[] = [
  {
    id: 'REQ-1',
    title: 'User Authentication',
    criteria: [
      'Support email and password login',
      'Generate secure session token on successful auth'
    ],
    status: 'open'
  },
  {
    id: 'REQ-2',
    title: 'Project Dashboard',
    criteria: [
      'Display list of active projects',
      'Show project status badge and metrics'
    ],
    status: 'open'
  }
];

export const DEMO_TASKS: Task[] = [
  {
    id: 'T-1',
    title: 'Implement authentication service and token handler',
    reqIds: ['REQ-1']
  },
  {
    id: 'T-2',
    title: 'Create dashboard layout and project summary cards',
    reqIds: ['REQ-2']
  }
];

export const DEMO_DESIGNS: Design[] = [
  {
    id: 'D-1',
    title: 'Authentication Flow Architecture',
    path: 'docs/design/auth.md',
    reqIds: ['REQ-1']
  },
  {
    id: 'D-2',
    title: 'Dashboard UI Component Hierarchy',
    path: 'docs/design/dashboard.md',
    reqIds: ['REQ-2']
  }
];

export const INITIAL_STATE: BuildtriState = {
  counters: {
    req: 0,
    task: 0,
    design: 0
  },
  stages: DEFAULT_STAGES,
  reqs: [],
  tasks: [],
  designs: [],
  runs: [],
  codeChangedAt: null,
  scan: null,
  deployChecklist: DEFAULT_DEPLOY_CHECKLIST
};

export const INITIAL_PROVENANCE: Provenance = {
  files: []
};

/**
 * Default test path regex:
 * Matches directory segment named test, tests, __tests__, spec, specs
 * OR filename matching (.|_|-)(test|spec). OR starting with test_
 */
export const DEFAULT_TEST_PATH_REGEX =
  '(^|[\\\\/])(tests?|__tests__|specs?)([\\\\/].*|$)|([._-](test|spec)\\.[^\\\\/]+$)|(^|[\\\\/])test_[^\\\\/]+$';

export const INITIAL_CONFIG: BuildConfig = {
  workingDir: '.',
  testCommand: '',
  testByReqCommand: '',
  lintCommand: '',
  buildCommand: '',
  testPathRegex: DEFAULT_TEST_PATH_REGEX,
  aiModel: ''
};

