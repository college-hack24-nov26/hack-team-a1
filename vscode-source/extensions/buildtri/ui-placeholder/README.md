# Buildtri UI Element ID Contract

This document specifies all HTML element IDs used by the extension to render and interact with the UI. When replacing `/ui-placeholder` with `/ui`, ensure these IDs are preserved in the HTML so the extension logic and state updates connect seamlessly.

## Top Bar & Controls
- `app`: Root container element hosting the three-column Buildtri Studio layout.
- `btn-refresh`: Trigger button to send the `{ type: "ready" }` refresh handshake to the extension host.
- `btn-compare`: Button to open the Lane Comparison modal view.
- `current-stage-badge`: Display element showing the current active stage ID and its status.
- `toast-container`: Floating container for toast notification messages.

## Stage Rail (Left Column)
- `stage-rail`: Container element holding the list of all 8 lifecycle stages.
- `stage-item-requirement`: Item representing the Requirement stage.
- `stage-item-plan`: Item representing the Plan stage.
- `stage-item-design`: Item representing the Design stage.
- `stage-item-build`: Item representing the Build stage.
- `stage-item-test`: Item representing the Test stage.
- `stage-item-security`: Item representing the Security stage.
- `stage-item-release`: Item representing the Release stage.
- `stage-item-deploy`: Item representing the Deploy stage.

## Artifact Viewer & Gate Status (Middle Column)
- `current-stage-title`: Heading element showing the selected stage's human-readable name.
- `gate-status-card`: Status banner/card showing whether the selected stage's gate is passing, blocked, or done.
- `gate-card-title`: Header text inside the gate card identifying the selected stage.
- `gate-stage-badge`: Badge displaying the status of the selected stage (`active`, `blocked`, `done`, `locked`).
- `gate-warning`: Warning line displayed when a completed (`done`) stage no longer satisfies its gating criteria.
- `btn-complete-stage`: Action button that posts `{ type: "gate:run", stage: "<selectedStage>" }` to execute the gate.
- `gate-reasons-list`: List (`<ul>`) displaying blocking reasons or passing criteria for the gate.

### Gemini AI Assistant Drawer (`#ai-section`)
- `ai-section`: Collapsible drawer container for the Gemini AI assistant.
- `ai-drawer-header`: Clickable header element to toggle the drawer open/collapsed.
- `ai-drawer-body`: Collapsible body container holding all AI inputs and controls.
- `btn-toggle-ai`: Button to expand/collapse the AI assistant drawer.
- `ai-key-badge`: Badge displaying API key presence (`Key: set` or `Key: not set`).
- `ai-model-badge`: Badge displaying the active model name or `Set aiModel in config.json`.
- `ai-status-line`: Text indicator showing current AI operation state (`idle`, `calling Gemini...`, `done`, `error`).
- `ai-prompt-input`: Textarea input for user prompts (max 8,000 characters).
- `ai-prompt-char-count`: Character counter display (`0 / 8000`).
- `ai-include-selection`: Checkbox to append selected text from the active VS Code editor as context.
- `ai-req-checkboxes`: Checkbox group container for selecting linked requirement IDs for generated code.
- `btn-ai-send`: Action button to send prompt to Gemini (disabled when empty, >8000 chars, or calling).
- `btn-ai-cancel`: Action button to abort an in-flight Gemini API request.
- `btn-ai-insert`: Action button to replace selection in active editor with extracted code, tagged as `vibe`.
- `ai-response-container`: Container displaying the Gemini response and code extraction output.
- `ai-truncation-note`: Indicator note shown if response was truncated at 50,000 characters.
- `ai-response-box`: Read-only `<pre>` box displaying plain-text response (strictly `textContent`, never HTML).

### Requirement Editor (`#view-requirement`)
- `view-requirement`: Container for requirement stage editor view.
- `req-count-badge`: Badge displaying total count of requirements.
- `req-list`: Container list where individual requirement cards with Edit/Delete/Impact actions are rendered.
- `orphan-tags-section`: Section container for orphan tags (tags referencing non-existent REQ IDs).
- `orphan-tags-list`: List container rendering orphan tags (`<tag> in <path>:<line>`).
- `change-panel`: Panel container displayed when a requirement is in `changed` status.
- `change-panel-heading`: Heading showing `Requirement Change Flow: <REQ-ID>`.
- `change-req-id`: Text span displaying the target changed requirement ID.
- `change-req-status-badge`: Badge displaying the `changed` status.
- `change-req-fields`: Display of modified fields (e.g. `title, criteria`).
- `change-req-files`: Display of impacted workspace files from traceability scan.
- `change-req-tests`: Display of impacted test files from traceability scan (with warning when none tagged).
- `change-lane-select`: Dropdown selecting lane (`hybrid`, `vibe`, `manual`).
- `btn-change-confirm`: Action button to confirm change and execute test and security checks.
- `btn-change-cancel`: Action button to cancel an active change run.
- `change-log-console`: Live streaming terminal console displaying change test stdout/stderr.
- `change-result-box`: Status summary container showing per-step (tests, security) and overall result.
- `change-test-step-status`: Text element displaying Step 1 test result (`pass`, `fail`, `cancelled`).
- `change-sec-step-status`: Text element displaying Step 2 security result (`pass`, `fail`, `not run`).
- `change-overall-outcome`: Badge element displaying overall change outcome (`PASS` or `FAIL`).
- `req-form`: Form container for creating or editing requirements.
- `req-form-id`: Hidden input field storing the ID of the requirement currently being edited.
- `req-form-mode`: Heading text showing either "Create New Requirement" or "Edit Requirement REQ-n".
- `req-title-input`: Text input for the requirement title.
- `req-criteria-input`: Textarea for acceptance criteria (one per line).
- `btn-req-save`: Button to save (create or update) the requirement.
- `btn-req-clear`: Button to reset the requirement form back to create mode.
- `change-log-section`: Section container displaying recent entries from `changes.md`.
- `changes-headings-list`: Container list rendering the last 10 headings of `changes.md`.

### Plan Editor (`#view-plan`)
- `view-plan`: Container for plan stage editor view.
- `task-count-badge`: Badge displaying total count of plan tasks.
- `task-list`: Container list where individual task cards with Edit/Delete actions are rendered.
- `task-form`: Form container for creating or editing tasks.
- `task-form-id`: Hidden input field storing the ID of the task currently being edited.
- `task-form-mode`: Heading text showing either "Create New Task" or "Edit Task T-n".
- `task-title-input`: Text input for the task title.
- `task-req-checkboxes`: Checkbox group container for selecting linked requirement IDs.
- `btn-task-save`: Button to save (create or update) the task.
- `btn-task-clear`: Button to reset the task form back to create mode.

### Design Editor (`#view-design`)
- `view-design`: Container for design stage editor view.
- `design-count-badge`: Badge displaying total count of design specifications.
- `design-list`: Container list where individual design cards with Edit/Delete actions are rendered.
- `design-form`: Form container for creating or editing design specs.
- `design-form-id`: Hidden input field storing the ID of the design spec currently being edited.
- `design-form-mode`: Heading text showing either "Create New Design Spec" or "Edit Design D-n".
- `design-title-input`: Text input for the design title.
- `design-path-input`: Text input for the design markdown file path (optional).
- `design-req-checkboxes`: Checkbox group container for selecting linked requirement IDs.
- `btn-design-save`: Button to save (create or update) the design specification.
- `btn-design-clear`: Button to reset the design form back to create mode.

### Build Stage & Lanes Panel (`#view-build`)
- `view-build`: Container for build stage lanes & provenance viewer.
- `build-lane-legend`: Visual legend defining Vibe, Hybrid, and Manual colors and definitions.
- `build-files-count-badge`: Badge displaying total count of tracked provenance files.
- `build-files-list`: Container list rendering tracked files, lane badges, missing status, and actions.

### Test Stage Panel (`#view-test`)
- `view-test`: Container for test stage runner and telemetry view.
- `test-cmd-display`: Read-only code element displaying `testCommand` from `config.json`.
- `test-status-line`: Status badge for test execution (`idle`, `running`, `finished`, `cancelled`).
- `test-last-run`: Text element displaying the timestamp of the latest test run.
- `btn-test-cancel`: Action button to cancel an in-progress test command run (visible only while running).
- `test-log-console`: Live streaming terminal console displaying test command stdout/stderr.

### Security Stage Panel (`#view-security`)
- `view-security`: Container for security stage runner and secret scan view.
- `security-cmd-display`: Read-only code element displaying `lintCommand` from `config.json`.
- `security-status-line`: Status badge for security lint execution (`idle`, `running`, `finished`, `cancelled`).
- `security-last-run`: Text element displaying the timestamp of the latest security lint run.
- `btn-security-cancel`: Action button to cancel an in-progress security lint run (visible only while running).
- `security-log-console`: Live streaming terminal console displaying security command stdout/stderr.
- `btn-scan-secrets`: Trigger button to manually run workspace secret scanning.
- `secret-findings-list`: Container list rendering detected secret leaks as `<path>:<line>` + rule name (never exposing the secret value).

### Release Stage Panel (`#view-release`)
- `view-release`: Container for release stage build runner and release notes view.
- `release-cmd-display`: Read-only code element displaying `buildCommand` from `config.json`.
- `release-status-line`: Status badge for release build command execution (`idle`, `running`, `finished`, `cancelled`).
- `release-last-run`: Text element displaying the timestamp and duration of the latest build run.
- `btn-release-cancel`: Action button to cancel an in-progress release build run.
- `release-log-console`: Live streaming terminal console displaying release build command stdout/stderr.
- `release-notes-list`: Container list rendering historical release headings from `release-notes.md`.

### Deploy Stage Panel (`#view-deploy`)
- `view-deploy`: Container for deploy stage pre-flight confirmation checklist.
- `deploy-checklist-container`: Container rendering the 4 fixed pre-deployment verification checkboxes.
- `deploy-checklist-count`: Pill displaying confirmed items count (`n / 4`).

### Lane Comparison Modal (`#compare-modal`)
- `compare-modal`: Overlay container displaying the comprehensive "Lane comparison" dashboard.
- `btn-close-compare`: Button to close the comparison modal overlay.
- `compare-lanes-container`: Visual bar chart rendering files, req coverage, and linked REQ IDs per lane.
- `compare-changes-container`: Visual bar chart rendering PASS and FAIL change flow outcomes per lane.
- `compare-runs-container`: Visual bar chart rendering runs, pass/fail ratio, and average duration per gate.
- `compare-timeline-container`: Timeline pills showing the current live status of all 8 lifecycle stages.

## Inspector & Telemetry (Right Column)
- `provenance-count-badge`: Badge showing the count of tracked files in `provenance.json`.
- `provenance-list`: List container showing files tagged with `vibe`, `hybrid`, or `manual`.
- `config-summary`: Preformatted display showing workspace command configurations.
- `run-console`: Terminal output / log stream window for gate executions and commands.

## Message Contract (postMessage)

### Webview to Extension Host:
```typescript
{ type: 'ready' }
{ type: 'stage:select', stage: StageId }
{ type: 'req:save', req: { id?: string; title: string; criteria: string[] } }
{ type: 'req:delete', id: string }
{ type: 'task:save', task: { id?: string; title: string; reqIds: string[] } }
{ type: 'task:delete', id: string }
{ type: 'design:save', design: { id?: string; title: string; path?: string; reqIds: string[] } }
{ type: 'design:delete', id: string }
{ type: 'lane:set', path: string, lane: 'vibe' | 'hybrid' | 'manual', reqIds?: string[] }
{ type: 'lane:remove', path: string }
{ type: 'gate:run', stage: StageId }
{ type: 'change:confirm', reqId: string, lane: 'vibe' | 'hybrid' | 'manual' }
{ type: 'run:cancel', gate: string }
{ type: 'ai:ask', prompt: string, reqIds: string[], includeSelection: boolean }
{ type: 'ai:cancel' }
{ type: 'ai:insert', resultId: string, reqIds: string[] }
{ type: 'deploy:check', id: string, checked: boolean }
```

### Extension Host to Webview:
```typescript
{
  type: 'state',
  data: {
    state: BuildtriState,
    provenance: Provenance,
    impact: ImpactResult,
    selectedStage?: StageId,
    gateWarning?: string,
    logBuffers?: Record<string, string[]>,
    changesHeadings?: string[],
    aiKeySet?: boolean,
    aiModelSet?: boolean,
    aiModel?: string,
    laneColors?: Record<CodeLane, { name: string; color: string; backgroundColor: string; description: string }>,
    deployChecklist?: DeployChecklistItem[],
    compareData?: CompareData,
    releaseNotesHeadings?: string[]
  }
}
{ type: 'run:output', gate: string, line: string }
{ type: 'run:status', gate: string, status: 'idle' | 'running' | 'finished' | 'cancelled', exit?: number }
{ type: 'ai:status', status: 'idle' | 'running' | 'done' | 'error', message?: string }
{ type: 'ai:result', resultId: string, text: string, truncated: boolean }
{ type: 'toast', level: 'info' | 'warn' | 'error', text: string }
```
