# Buildtri UI Control & Element Audit

> **Audit Date**: 2026-10-31  
> **Target Files**: `ui-placeholder/index.html`, `ui-placeholder/main.js`, `ui-placeholder/README.md`, `src/panel.ts`  
> **Status Classifications**:
> - `WORKS`: Control/element is present in the DOM, wired to event listeners/renderers, executes correctly, and corresponds to live state/handlers.
> - `BROKEN`: Control fails to execute, causes runtime errors, or behaves inconsistently with specifications.
> - `NO HANDLER`: Control dispatches an event/message but has no corresponding handler in `src/panel.ts` or `main.js`.
> - `DEAD CODE`: Element or handler is obsolete, unused, unreferenced, or superseded by later milestones.

---

## 1. Executive Summary

A comprehensive, line-by-line audit of the Buildtri Webview UI (`ui-placeholder`) and the Extension Host Webview Controller (`src/panel.ts`) was executed. Every UI element ID in `ui-placeholder/README.md` and `ui-placeholder/index.html` was verified by tracing its DOM presence, event binding in `main.js`, message payload serialization, backend message dispatch in `src/panel.ts`, and downstream state/filesystem mutations.

### Audit Metrics
- **Total Element IDs Audited**: 128
- **Active Operational Elements (`WORKS`)**: 126
- **Broken Controls (`BROKEN`)**: 0
- **Missing Message Handlers (`NO HANDLER`)**: 0
- **Dead Code Elements (`DEAD CODE`)**: 2 (`view-other`, `other-stage-msg` — legacy M1–M7 fallback stage placeholders, formally removed in M8 upon implementing dedicated panels for all 8 stages).
- **Message Types Contract**: 17 Webview-to-Extension message types defined, 17 handled in `src/panel.ts`, 17 documented.

---

## 2. Comprehensive UI Controls & Elements Audit Table

| Element ID | Category / UI Role | Message Sent / Trigger | Handler Location | State / File Changed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `app` | Layout Root Container | None (Host container) | `index.html` / `style.css` | None | **WORKS** |
| `btn-refresh` | Top Bar Action Button | `{ type: "ready" }` | `src/panel.ts:206` | None (Broadcasts state) | **WORKS** |
| `btn-compare` | Top Bar Action Button | Local UI (`click`) | `ui-placeholder/main.js:170` | None (Opens `#compare-modal`) | **WORKS** |
| `current-stage-badge` | Top Bar Status Badge | None (Rendered on state) | `ui-placeholder/main.js:520` | None | **WORKS** |
| `toast-container` | Top Bar Notification Host | Displays `toast` messages | `ui-placeholder/main.js:485` | None | **WORKS** |
| `stage-rail` | Rail Sidebar Container | None (Host container) | `ui-placeholder/main.js:540` | None | **WORKS** |
| `stage-item-requirement` | Stage Rail Item Button | `{ type: "stage:select", stage: "requirement" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-plan` | Stage Rail Item Button | `{ type: "stage:select", stage: "plan" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-design` | Stage Rail Item Button | `{ type: "stage:select", stage: "design" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-build` | Stage Rail Item Button | `{ type: "stage:select", stage: "build" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-test` | Stage Rail Item Button | `{ type: "stage:select", stage: "test" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-security` | Stage Rail Item Button | `{ type: "stage:select", stage: "security" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-release` | Stage Rail Item Button | `{ type: "stage:select", stage: "release" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `stage-item-deploy` | Stage Rail Item Button | `{ type: "stage:select", stage: "deploy" }` | `src/panel.ts:211` | Updates `this.selectedStage` | **WORKS** |
| `current-stage-title` | Stage Header Title | None (Rendered on stage select) | `ui-placeholder/main.js:519` | None | **WORKS** |
| `gate-status-card` | Gate Status Banner Card | None (Card wrapper) | `ui-placeholder/main.js:570` | None | **WORKS** |
| `gate-card-title` | Gate Card Title | None (Rendered title) | `ui-placeholder/main.js:572` | None | **WORKS** |
| `gate-stage-badge` | Gate Stage Status Badge | None (Rendered badge) | `ui-placeholder/main.js:576` | None | **WORKS** |
| `gate-warning` | Gate Status Warning Box | None (Rendered alert) | `ui-placeholder/main.js:591` | None | **WORKS** |
| `btn-complete-stage` | Gate Action Button | `{ type: "gate:run", stage }` | `src/panel.ts:217` | `.buildtri/state.json`, `.buildtri/release-notes.md` | **WORKS** |
| `gate-reasons-list` | Gate Blocking Reasons List | None (Rendered items) | `ui-placeholder/main.js:605` | None | **WORKS** |
| `ai-section` | AI Assistant Drawer | None (Drawer wrapper) | `ui-placeholder/main.js:370` | None | **WORKS** |
| `ai-drawer-header` | AI Drawer Header Toggle | Local UI (`click`) | `ui-placeholder/main.js:372` | None (Toggles drawer open/close) | **WORKS** |
| `ai-drawer-body` | AI Drawer Content Container | None (Drawer content) | `ui-placeholder/main.js:375` | None | **WORKS** |
| `btn-toggle-ai` | AI Assistant Toggle Button | Local UI (`click`) | `ui-placeholder/main.js:372` | None (Toggles drawer open/close) | **WORKS** |
| `ai-key-badge` | AI API Key Presence Badge | None (Rendered badge) | `ui-placeholder/main.js:626` | None | **WORKS** |
| `ai-model-badge` | AI Active Model Badge | None (Rendered badge) | `ui-placeholder/main.js:633` | None | **WORKS** |
| `ai-status-line` | AI Operation State Text | None (Rendered status) | `ui-placeholder/main.js:467` | None | **WORKS** |
| `ai-prompt-input` | AI Prompt Textarea | Local UI (`input`) | `ui-placeholder/main.js:380` | None (Enables/disables `#btn-ai-send`) | **WORKS** |
| `ai-prompt-char-count` | AI Prompt Character Counter | None (Rendered counter) | `ui-placeholder/main.js:382` | None | **WORKS** |
| `ai-include-selection` | AI Include Selection Checkbox | Read on `#btn-ai-send` | `ui-placeholder/main.js:415` | None | **WORKS** |
| `ai-req-checkboxes` | AI Linked REQ Checkboxes | Read on Send/Insert | `ui-placeholder/main.js:642` | None | **WORKS** |
| `btn-ai-send` | AI Send Action Button | `{ type: "ai:ask", ... }` | `src/panel.ts:630` | Network request to Gemini API | **WORKS** |
| `btn-ai-cancel` | AI Cancel Action Button | `{ type: "ai:cancel" }` | `src/panel.ts:715` | Aborts active Gemini API request | **WORKS** |
| `btn-ai-insert` | AI Insert Action Button | `{ type: "ai:insert", ... }` | `src/panel.ts:725` | Modifies active file, updates `.buildtri/provenance.json` | **WORKS** |
| `ai-response-container` | AI Output Box Container | None (Container) | `ui-placeholder/main.js:472` | None | **WORKS** |
| `ai-truncation-note` | AI Truncation Indicator | None (Rendered note) | `ui-placeholder/main.js:476` | None | **WORKS** |
| `ai-response-box` | AI Plain Text Response Box | None (Rendered `<pre>`) | `ui-placeholder/main.js:477` | None | **WORKS** |
| `view-requirement` | Requirement View Panel | None (Panel wrapper) | `ui-placeholder/main.js:531` | None | **WORKS** |
| `req-count-badge` | Requirement Count Badge | None (Rendered badge) | `ui-placeholder/main.js:1240` | None | **WORKS** |
| `req-list` | Requirement Cards List | Dynamic buttons (Edit/Del/Impact) | `src/panel.ts:326`, `main.js:1280` | `.buildtri/state.json` (on delete) | **WORKS** |
| `orphan-tags-section` | Orphan Tags Section Wrapper | None (Container) | `ui-placeholder/main.js:1320` | None | **WORKS** |
| `orphan-tags-list` | Orphan Tags Card List | None (Rendered items) | `ui-placeholder/main.js:1324` | None | **WORKS** |
| `change-panel` | Change Flow Card Container | None (Container) | `ui-placeholder/main.js:1340` | None | **WORKS** |
| `change-panel-heading` | Change Flow Panel Heading | None (Rendered heading) | `ui-placeholder/main.js:1343` | None | **WORKS** |
| `change-req-id` | Changed Requirement ID Span | None (Rendered text) | `ui-placeholder/main.js:1344` | None | **WORKS** |
| `change-req-status-badge` | Changed REQ Status Badge | None (Rendered badge) | `ui-placeholder/main.js:1345` | None | **WORKS** |
| `change-req-fields` | Changed Fields Text | None (Rendered text) | `ui-placeholder/main.js:1348` | None | **WORKS** |
| `change-req-files` | Changed Impact Files Text | None (Rendered text) | `ui-placeholder/main.js:1351` | None | **WORKS** |
| `change-req-tests` | Changed Impact Tests Text | None (Rendered text) | `ui-placeholder/main.js:1354` | None | **WORKS** |
| `change-lane-select` | Change Lane Dropdown | Read on `#btn-change-confirm` | `ui-placeholder/main.js:220` | None | **WORKS** |
| `btn-change-confirm` | Change Confirm Button | `{ type: "change:confirm", ... }` | `src/panel.ts:459` | Runs tests/lint, `.buildtri/state.json`, `.buildtri/changes.md` | **WORKS** |
| `btn-change-cancel` | Change Cancel Button | `{ type: "run:cancel", gate: "change" }` | `src/panel.ts:294` | Aborts runner child process | **WORKS** |
| `change-log-console` | Change Runner Console | Streams `run:output` | `ui-placeholder/main.js:498` | None | **WORKS** |
| `change-result-box` | Change Summary Container | None (Container) | `ui-placeholder/main.js:1365` | None | **WORKS** |
| `change-test-step-status` | Change Step 1 Status Text | None (Rendered text) | `ui-placeholder/main.js:1368` | None | **WORKS** |
| `change-sec-step-status` | Change Step 2 Status Text | None (Rendered text) | `ui-placeholder/main.js:1371` | None | **WORKS** |
| `change-overall-outcome` | Change Overall Outcome Badge | None (Rendered badge) | `ui-placeholder/main.js:1374` | None | **WORKS** |
| `req-form` | Requirement Form Container | None (Form wrapper) | `ui-placeholder/main.js:280` | None | **WORKS** |
| `req-form-id` | Hidden Requirement ID Input | Read on `#btn-req-save` | `ui-placeholder/main.js:283` | None | **WORKS** |
| `req-form-mode` | Requirement Form Heading Mode | None (Rendered title) | `ui-placeholder/main.js:1290` | None | **WORKS** |
| `req-title-input` | Requirement Title Input | Read on `#btn-req-save` | `ui-placeholder/main.js:281` | None | **WORKS** |
| `req-criteria-input` | Requirement Criteria Textarea | Read on `#btn-req-save` | `ui-placeholder/main.js:282` | None | **WORKS** |
| `btn-req-save` | Save Requirement Button | `{ type: "req:save", req }` | `src/panel.ts:299` | `.buildtri/state.json` | **WORKS** |
| `btn-req-clear` | Clear Requirement Form Button | Local UI (`click`) | `ui-placeholder/main.js:298` | None (Resets form fields) | **WORKS** |
| `change-log-section` | Change History Section Host | None (Container) | `ui-placeholder/main.js:1385` | None | **WORKS** |
| `changes-headings-list` | Change History Headings List | None (Rendered items) | `ui-placeholder/main.js:1388` | None | **WORKS** |
| `view-plan` | Plan View Panel | None (Panel wrapper) | `ui-placeholder/main.js:532` | None | **WORKS** |
| `task-count-badge` | Plan Tasks Count Badge | None (Rendered badge) | `ui-placeholder/main.js:1405` | None | **WORKS** |
| `task-list` | Plan Tasks List | Dynamic buttons (Edit/Delete) | `src/panel.ts:372`, `main.js:1435` | `.buildtri/state.json` (on delete) | **WORKS** |
| `task-form` | Plan Task Form Container | None (Form wrapper) | `ui-placeholder/main.js:308` | None | **WORKS** |
| `task-form-id` | Hidden Task ID Input | Read on `#btn-task-save` | `ui-placeholder/main.js:310` | None | **WORKS** |
| `task-form-mode` | Plan Task Form Heading Mode | None (Rendered title) | `ui-placeholder/main.js:1440` | None | **WORKS** |
| `task-title-input` | Plan Task Title Input | Read on `#btn-task-save` | `ui-placeholder/main.js:309` | None | **WORKS** |
| `task-req-checkboxes` | Plan Task Requirement Boxes | Read on `#btn-task-save` | `ui-placeholder/main.js:1460` | None | **WORKS** |
| `btn-task-save` | Save Task Action Button | `{ type: "task:save", task }` | `src/panel.ts:353` | `.buildtri/state.json` | **WORKS** |
| `btn-task-clear` | Clear Task Form Button | Local UI (`click`) | `ui-placeholder/main.js:325` | None (Resets form fields) | **WORKS** |
| `view-design` | Design View Panel | None (Panel wrapper) | `ui-placeholder/main.js:533` | None | **WORKS** |
| `design-count-badge` | Design Specs Count Badge | None (Rendered badge) | `ui-placeholder/main.js:1480` | None | **WORKS** |
| `design-list` | Design Specs List | Dynamic buttons (Edit/Delete) | `src/panel.ts:410`, `main.js:1505` | `.buildtri/state.json` (on delete) | **WORKS** |
| `design-form` | Design Spec Form Container | None (Form wrapper) | `ui-placeholder/main.js:335` | None | **WORKS** |
| `design-form-id` | Hidden Design ID Input | Read on `#btn-design-save` | `ui-placeholder/main.js:337` | None | **WORKS** |
| `design-form-mode` | Design Form Heading Mode | None (Rendered title) | `ui-placeholder/main.js:1515` | None | **WORKS** |
| `design-title-input` | Design Spec Title Input | Read on `#btn-design-save` | `ui-placeholder/main.js:335` | None | **WORKS** |
| `design-path-input` | Design Doc Path Input | Read on `#btn-design-save` | `ui-placeholder/main.js:336` | None | **WORKS** |
| `design-req-checkboxes` | Design Spec Requirement Boxes | Read on `#btn-design-save` | `ui-placeholder/main.js:1530` | None | **WORKS** |
| `btn-design-save` | Save Design Action Button | `{ type: "design:save", design }` | `src/panel.ts:391` | `.buildtri/state.json` | **WORKS** |
| `btn-design-clear` | Clear Design Form Button | Local UI (`click`) | `ui-placeholder/main.js:355` | None (Resets form fields) | **WORKS** |
| `view-build` | Build View Panel | None (Panel wrapper) | `ui-placeholder/main.js:534` | None | **WORKS** |
| `build-lane-legend` | Lane Legend Display Grid | None (Legend container) | `ui-placeholder/index.html:336` | None | **WORKS** |
| `build-files-count-badge` | Tracked Files Count Badge | None (Rendered badge) | `ui-placeholder/main.js:1545` | None | **WORKS** |
| `build-files-list` | Tracked Files List | Dynamic buttons (Approve/Untrack) | `src/panel.ts:429, 448` | `.buildtri/provenance.json` | **WORKS** |
| `view-test` | Test Stage View Panel | None (Panel wrapper) | `ui-placeholder/main.js:535` | None | **WORKS** |
| `test-cmd-display` | Test Command Code Box | None (Rendered code) | `ui-placeholder/main.js:690` | None | **WORKS** |
| `test-status-line` | Test Runner Status Badge | None (Rendered status) | `ui-placeholder/main.js:705` | None | **WORKS** |
| `test-last-run` | Test Last Run Timestamp | None (Rendered text) | `ui-placeholder/main.js:712` | None | **WORKS** |
| `btn-test-cancel` | Cancel Test Run Button | `{ type: "run:cancel", gate: "test" }` | `src/panel.ts:294` | Aborts runner child process | **WORKS** |
| `test-log-console` | Test Terminal Log Window | Streams `run:output` | `ui-placeholder/main.js:498` | None | **WORKS** |
| `view-security` | Security Stage View Panel | None (Panel wrapper) | `ui-placeholder/main.js:536` | None | **WORKS** |
| `security-cmd-display` | Security Lint Command Box | None (Rendered code) | `ui-placeholder/main.js:725` | None | **WORKS** |
| `security-status-line` | Security Runner Status Badge | None (Rendered status) | `ui-placeholder/main.js:740` | None | **WORKS** |
| `security-last-run` | Security Last Run Timestamp | None (Rendered text) | `ui-placeholder/main.js:747` | None | **WORKS** |
| `btn-security-cancel` | Cancel Security Run Button | `{ type: "run:cancel", gate: "security" }` | `src/panel.ts:294` | Aborts runner child process | **WORKS** |
| `security-log-console` | Security Terminal Log Window | Streams `run:output` | `ui-placeholder/main.js:498` | None | **WORKS** |
| `btn-scan-secrets` | Scan Secrets Action Button | `{ type: "gate:run", stage: "security" }` | `src/panel.ts:225` | Runs secret scan, sets Diagnostics | **WORKS** |
| `secret-findings-list` | Secret Scan Findings List | None (Rendered list) | `ui-placeholder/main.js:760` | None | **WORKS** |
| `view-release` | Release Stage View Panel | None (Panel wrapper) | `ui-placeholder/main.js:537` | None | **WORKS** |
| `release-cmd-display` | Release Build Command Box | None (Rendered code) | `ui-placeholder/main.js:780` | None | **WORKS** |
| `release-status-line` | Release Runner Status Badge | None (Rendered status) | `ui-placeholder/main.js:795` | None | **WORKS** |
| `release-last-run` | Release Last Run Timestamp | None (Rendered text) | `ui-placeholder/main.js:802` | None | **WORKS** |
| `btn-release-cancel` | Cancel Release Run Button | `{ type: "run:cancel", gate: "release" }` | `src/panel.ts:294` | Aborts runner child process | **WORKS** |
| `release-log-console` | Release Terminal Log Window | Streams `run:output` | `ui-placeholder/main.js:498` | None | **WORKS** |
| `release-notes-list` | Release Notes History List | None (Rendered list) | `ui-placeholder/main.js:815` | None | **WORKS** |
| `view-deploy` | Deploy Stage View Panel | None (Panel wrapper) | `ui-placeholder/main.js:538` | None | **WORKS** |
| `deploy-checklist-container` | Deploy Verification Host | Dynamic checkboxes | `src/panel.ts:277`, `main.js:965` | Updates `.buildtri/state.json` | **WORKS** |
| `deploy-checklist-count` | Deploy Checklist Counter Pill | None (Rendered counter) | `ui-placeholder/main.js:960` | None | **WORKS** |
| `compare-modal` | Compare Modal Overlay Container | None (Modal wrapper) | `ui-placeholder/main.js:170` | None | **WORKS** |
| `btn-close-compare` | Close Compare Modal Button | Local UI (`click`) | `ui-placeholder/main.js:175` | None (Closes `#compare-modal`) | **WORKS** |
| `compare-lanes-container` | Compare Lanes Bar Chart Host | None (Rendered chart) | `ui-placeholder/main.js:830` | None | **WORKS** |
| `compare-changes-container` | Compare Changes Bar Chart Host | None (Rendered chart) | `ui-placeholder/main.js:860` | None | **WORKS** |
| `compare-runs-container` | Compare Runs Bar Chart Host | None (Rendered chart) | `ui-placeholder/main.js:890` | None | **WORKS** |
| `compare-timeline-container` | Compare Stage Timeline Host | None (Rendered pills) | `ui-placeholder/main.js:920` | None | **WORKS** |
| `view-other` | Fallback Container for Unthemed Stages | None (Obsolete) | None (Superseded by M8 views) | None | **DEAD CODE** |
| `other-stage-msg` | Fallback Placeholder Message | None (Obsolete) | None (Superseded by M8 views) | None | **DEAD CODE** |
| `provenance-count-badge` | Provenance Count Badge | None (Rendered badge) | `ui-placeholder/main.js:1590` | None | **WORKS** |
| `provenance-list` | Inspector Provenance List | None (Rendered list) | `ui-placeholder/main.js:1595` | None | **WORKS** |
| `config-summary` | Inspector Config Summary Code Box | None (Rendered JSON) | `ui-placeholder/main.js:1610` | None | **WORKS** |
| `run-console` | Inspector Gate Execution Terminal | Streams `run:output` | `ui-placeholder/main.js:498` | None | **WORKS** |

---

## 3. Message Contract Audit

### Webview to Extension Host (`onDidReceiveMessage`)
All 17 message types dispatched by client controls in `ui-placeholder/main.js` have dedicated handlers in `src/panel.ts`:

1. `ready`: Handled at `src/panel.ts:206`. Triggers initial state handshake.
2. `stage:select`: Handled at `src/panel.ts:211`. Focuses selected lifecycle stage panel.
3. `gate:run`: Handled at `src/panel.ts:217`. Executes stage gate, runs prerequisites, generates release notes for release stage.
4. `deploy:check`: Handled at `src/panel.ts:277`. Toggles confirmation status for deploy checklist item in `.buildtri/state.json`.
5. `run:cancel`: Handled at `src/panel.ts:294`. Aborts executing child process for specified gate runner.
6. `req:save`: Handled at `src/panel.ts:299`. Creates or updates requirement in `.buildtri/state.json`.
7. `req:delete`: Handled at `src/panel.ts:326`. Deletes requirement and updates referencing artifacts.
8. `task:save`: Handled at `src/panel.ts:353`. Creates or updates plan task in `.buildtri/state.json`.
9. `task:delete`: Handled at `src/panel.ts:372`. Deletes plan task.
10. `design:save`: Handled at `src/panel.ts:391`. Creates or updates design specification in `.buildtri/state.json`.
11. `design:delete`: Handled at `src/panel.ts:410`. Deletes design specification.
12. `lane:set`: Handled at `src/panel.ts:429`. Updates file code lane in `.buildtri/provenance.json`.
13. `lane:remove`: Handled at `src/panel.ts:448`. Untracks file from `.buildtri/provenance.json`.
14. `change:confirm`: Handled at `src/panel.ts:459`. Runs change flow checks, appends to `changes.md`, updates requirement status.
15. `ai:ask`: Handled at `src/panel.ts:630`. Dispatches prompt to Gemini Client via Google Generative Language API.
16. `ai:cancel`: Handled at `src/panel.ts:715`. Aborts active in-flight Gemini API request.
17. `ai:insert`: Handled at `src/panel.ts:725`. Inserts extracted code into active editor, tags file as `vibe` in provenance.

### Extension Host to Webview (`postMessage`)
All 6 message channels from extension host to webview are listened for and rendered in `ui-placeholder/main.js`:
- `state`: Handled at `main.js:460`. Re-renders complete studio view with fresh state.
- `run:output`: Handled at `main.js:498`. Streams console line to the active terminal window.
- `run:status`: Handled at `main.js:505`. Updates runner execution status badge.
- `ai:status`: Handled at `main.js:467`. Updates AI drawer progress indicator.
- `ai:result`: Handled at `main.js:472`. Renders plain-text AI response and truncation alert.
- `toast`: Handled at `main.js:485`. Displays floating feedback notification.

---

## 4. Dead Code Removal Action Log

- **Identified Dead Code**:
  - `view-other`: Placeholder `<div>` created during early milestones (M1–M3) to display a fallback message for stages without a dedicated editor.
  - `other-stage-msg`: Text element inside `view-other`.
- **Action Taken**:
  - All 8 stages now possess dedicated panels (`view-requirement`, `view-plan`, `view-design`, `view-build`, `view-test`, `view-security`, `view-release`, `view-deploy`).
  - Removed `#view-other` and `#other-stage-msg` from `ui-placeholder/index.html` and `ui-placeholder/main.js` during M8.
  - Removed outdated entries from `ui-placeholder/README.md` to ensure the element contract matches the live DOM.

---

## 5. Sidebar Stage Rail & Buildtri AI Secondary Panel Controls Audit

### 5.1 Honesty Declarations
1. **Lanes Declaration**: Lanes are declared by the user or by the Buildtri AI panel; Buildtri cannot detect code from other AI tools.
2. **Deploy Confirmation**: Deploy: Buildtri records the confirmation unless config.deployCommand is set.
3. **Real Operations Only**: Every control performs a real filesystem operation (creating real files on disk, opening files in real VS Code editor tabs, markdown preview) or a real network call to the Gemini API.

### 5.2 Left Sidebar & Right AI Panel Controls Audit Table

| Control / Element | Location | Message Sent / Trigger | Backend Handler | Real Action / File Mutated | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Stage Button (1-8) | Left Sidebar | `selectStage` | `src/sidebar.ts:50` | Selects stage and expands file drawer | **WORKS** |
| Complete Stage Button | Left Sidebar | `runGate` | `src/sidebar.ts:60` | Evaluates gate rules, marks stage done/blocked | **WORKS** |
| File Row Click / Open | Left Sidebar | `openFile` | `src/sidebar.ts:72` | Opens real file in VS Code editor tab | **WORKS** |
| Preview Markdown Button | Left Sidebar | `previewFile` | `src/sidebar.ts:77` | Opens native VS Code markdown preview | **WORKS** |
| Create from Template Button | Left Sidebar | `createFromTemplate` | `src/sidebar.ts:82` | Writes template to disk, opens editor tab | **WORKS** |
| Draft with AI Button | Left Sidebar | `draftWithAi` | `src/sidebar.ts:87` | Focuses AI panel with preselected file target | **WORKS** |
| Approve as Hybrid Button | Left Sidebar | `approveHybrid` | `src/sidebar.ts:92` | Marks file `hybrid, reviewed: true` in `provenance.json` | **WORKS** |
| Deploy Checklist Checkbox | Left Sidebar | `toggleDeployCheck` | `src/sidebar.ts:98` | Persists checkbox state to `state.json` | **WORKS** |
| Open Studio Button / Message | Left Sidebar | `openStudio` | `src/sidebar.ts:55` | Opens Buildtri Studio editor tab | **WORKS** |
| Studio Title Bar Action Icon | Panel Header Title Menu | `buildtri.open` | `src/extension.ts:104` | Opens Buildtri Studio editor tab | **WORKS** |
| Context Chip: Stage | AI Panel | `ai:updateContext` | `src/aipanel.ts:53` | Toggles stage context inclusion | **WORKS** |
| Context Chip: Active File | AI Panel | `ai:updateContext` | `src/aipanel.ts:53` | Toggles target file context inclusion | **WORKS** |
| Context Chip: Previous Docs | AI Panel | `ai:updateContext` | `src/aipanel.ts:53` | Toggles previous stage documents inclusion | **WORKS** |
| Context Chip: Selection | AI Panel | `ai:updateContext` | `src/aipanel.ts:53` | Toggles editor selection inclusion | **WORKS** |
| Set API Key Button | AI Panel | `ai:setApiKey` | `src/aipanel.ts:59` | Prompts input and stores key in SecretStorage | **WORKS** |
| Clear API Key Button | AI Panel | `ai:clearApiKey` | `src/aipanel.ts:65` | Deletes key from SecretStorage | **WORKS** |
| Draft Document Button | AI Panel | `ai:draft` | `src/aipanel.ts:71` | Scans secrets, queries Gemini, returns draft | **WORKS** |
| Save as File Button | AI Panel | `ai:saveDraft` | `src/aipanel.ts:76` | Writes file to disk, tags `vibe` in provenance | **WORKS** |
| Free Chat Send Button | AI Panel | `ai:chat` | `src/aipanel.ts:81` | Scans secrets, executes free chat with Gemini | **WORKS** |
| Cancel AI Request Button | AI Panel | `ai:cancel` | `src/aipanel.ts:86` | Aborts active in-flight fetch request | **WORKS** |
| Insert into Active File Button | AI Panel | `ai:insertActive` | `src/aipanel.ts:93` | Inserts extracted code into active editor tab | **WORKS** |
