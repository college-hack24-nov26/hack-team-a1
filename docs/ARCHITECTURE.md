# Buildtri Architecture

Buildtri transforms VS Code into a stage-gated, tech-stack-agnostic IDE. The extension host owns all state, computes stage gates, and monitors code provenance, while decoupling the user interface into a sandboxed webview.

## Modules

### `src/extension.ts`
The extension activation lifecycle manager. It initializes the `StateManager`, registers the Activity Bar sidebar view provider, registers user commands (`buildtri.open`, `buildtri.refreshState`), sets up the status bar indicator, and hooks up disposables for cleanup upon deactivation.

### `src/state.ts`
The persistence and data manager for workspace files inside `/.buildtri/`. It guarantees the existence of `state.json`, `provenance.json`, and `config.json`, caches their contents in memory, provides typed accessors, and fires event notifications whenever the workspace state is modified.

### `src/gates.ts`
The pure evaluation engine for stage gating and lifecycle state transitions. It operates without any VS Code API or filesystem dependencies, evaluating deterministic rules for requirements, plan task coverage, and design specifications, and computing state transitions (`active`, `done`, `blocked`, `locked`) and actionable gate failure reasons.

### `src/model.ts`
The pure data model manager for workspace entities. It operates without any VS Code API or filesystem dependencies, handling strict input validation, non-reusable sequential ID generation (`REQ-<n>`, `T-<n>`, `D-<n>`) powered by persistent counters, and cascade deletion logic across requirements, tasks, and designs.

### `src/types.ts`
The central type definitions for the entire extension. It strictly types the 8 development stages, requirements, tasks, designs, run records, code lanes (`vibe`, `hybrid`, `manual`), file provenance records, configuration settings, and bidirectional `postMessage` protocol contracts.

### `src/constants.ts`
Central storage for global configuration constants. It defines the single `UI_DIRECTORY` path toggle (`ui-placeholder` to `/ui`), directory and file names, the initial 8-stage sequence (Requirement through Deploy), and baseline default states.

### `src/sidebar.ts`
A lightweight `WebviewViewProvider` contributed to the VS Code Activity Bar under the "Buildtri" container. It provides a compact overview of the currently active stage, its gate reasons, and a direct button to launch the full Buildtri Studio editor panel.

### `src/panel.ts`
The wide editor-tab `WebviewPanel` manager. It loads the HTML/CSS/JS assets from the configured UI directory, translates asset paths into secure webview URIs, manages bidirectional `postMessage` communication (handling `ready` handshakes and state syncs), and disposes resources cleanly.

### `src/lanecolors.ts`
The unified single source of truth for code lane visual styling. It defines consistent color palettes, background tint values, overview ruler markers, and SVG icon asset paths for Vibe, Hybrid, and Manual lanes.

### `src/provenance.ts`
The pure provenance engine for code lane management. Free of any VS Code API or filesystem dependencies, it handles path normalization, validates linked requirement references, enforces strict lane transition rules (such as requiring Vibe code to be approved as Hybrid before becoming Manual), and updates provenance records.

### `src/lanes.ts`
The VS Code integration manager for code lanes. It applies whole-line background tints and gutter decorations to visible text editors, keeps the code lane status bar item synchronized with editor focus, and implements user commands including "Approve as Hybrid", "Mark Active File as Vibe", and "Mark Active File as Manual".

### `src/runner.ts`
The shell command execution engine for testing and security analysis. It enforces workspace trust, requires user confirmation before running new commands, validates safe working directories within the workspace root, merges and strips ANSI color codes from stdout/stderr, batches output lines every 50ms to the webview UI, retains an in-memory 2000-line circular buffer per gate, terminates full process trees on timeout (300s) or cancellation, and logs structured run telemetry into `state.json`.

### `src/secrets.ts`
The pure regex evaluation engine for credential and secret detection. Free of any VS Code API or filesystem dependencies, it scans text line-by-line against 5 high-confidence rules (PEM private keys, AWS access keys, Google API keys, GitHub tokens, and generic high-entropy secret assignments), supports inline suppression via `buildtri:allow-secret`, and reports line numbers and rule names while strictly preventing secret values from ever being captured, stored, or exposed.

### `src/scan.ts`
The workspace file scanner for static security analysis. It walks the workspace while ignoring hidden files, `.git`, `node_modules`, `.buildtri`, common build output folders, binaries, and files over 1 MB. It analyzes file contents using `src/secrets.ts`, populates `state.scan`, and publishes live VS Code diagnostics (`vscode.DiagnosticCollection`) with inline warnings across the editor.

### `src/trace.ts`
The pure traceability tag parser and workspace impact scanner. It extracts `\bREQ-(\d+)\b` tags line-by-line across all workspace files, categorizes matching files into code implementations or automated tests based on the stack-agnostic `config.testPathRegex`, identifies orphan tags referencing non-existent requirements, and updates live impact structures debounced across file edits.

### `src/ai.ts`
The Gemini AI integration module. It provides pure functions for building Gemini API payloads (`buildRequest`), parsing Gemini JSON responses (`parseResponse`), and extracting fenced code blocks (`extractCode`). Its `GeminiClient` class manages secure API key storage in VS Code `SecretStorage`, enforces workspace trust, scans outgoing text for secrets via `src/secrets.ts`, uses Node's built-in `fetch` over HTTPS strictly to `generativelanguage.googleapis.com` with a 60-second `AbortController` timeout, supports user cancellation, and enforces a 50,000-character response limit. Model names are configured strictly via `config.aiModel` without hardcoded model defaults, and error responses strictly map to friendly error strings.

### `src/compare.ts`
The pure aggregation engine for workspace metrics and telemetry. It calculates file distribution and REQ coverage per lane (`summarizeLanes`), tallies PASS and FAIL outcomes per lane from `changes.md` (`summarizeChanges`), groups runner execution records by gate with pass/fail counts and average durations (`summarizeRuns`), and produces the current 8-stage lifecycle timeline (`stageTimeline`).

### `ui-placeholder/`
A standalone, zero-dependency HTML/CSS/JS frontend serving as the interface placeholder. It implements a 3-column studio layout (Stage Rail, Artifact Viewer, Inspector) and communicates with the extension host exclusively via the element ID contract documented in `ui-placeholder/README.md`.

## Security & Runner Safety Guarantees

1. **Workspace Trust Required**: Shell commands and AI API requests are never executed if `vscode.workspace.isTrusted` is false.
2. **Explicit User Confirmation**: Before executing any command string for the first time, a modal prompt requests explicit user approval. Approved command strings are cached in `workspaceState`; modifying the command string in `config.json` immediately triggers a new confirmation dialog.
3. **Strict Path Sanitization**: Command working directories and file insertions are constrained to relative subpaths strictly within the workspace root, rejecting path traversal (`..`), absolute paths, `.buildtri/`, and `node_modules/`.
4. **No Secret Leakage**: Secret values matched during scans are never stored in memory, persisted in `state.json`, logged to consoles, or sent to webviews. Diagnostics and UI findings display solely file paths, line numbers, and rule names.
5. **Process Tree Termination**: Runs that time out (300s limit) or are cancelled by the user are killed alongside all child processes using tree-kill commands (`taskkill /PID <pid> /T /F` on Windows; process-group `kill` on POSIX).
6. **Code Change Invalidation**: A workspace file watcher sets `state.codeChangedAt` on any non-ignored file modification. Downstream Test and Security gates require their latest run timestamps (`at`) to be greater than or equal to `codeChangedAt`; otherwise gates fail with `"Code changed since the last test/security run."`. Done stages are preserved with warning banners rather than destructive reopening.

## Gemini AI Architecture & Safety Guarantees

1. **API Key in SecretStorage Only**: The Gemini API key is stored exclusively in VS Code `context.secrets.store('buildtri.geminiApiKey', key)` through the commands `Buildtri: Set Gemini API Key` (password input) and `Buildtri: Clear Gemini API Key`. It is never written to `config.json`, `state.json`, `provenance.json`, `changes.md`, settings, logs, toasts, or UI messages. The UI only ever receives a boolean badge: `Key: set` or `Key: not set`.
2. **Strict Network Allow-List**: Network calls strictly connect to `https://generativelanguage.googleapis.com` via Node's native `fetch`. The API key is sent via the `x-goog-api-key` header, never in URL query parameters. No external AI or cloud SDKs are bundled.
3. **Outgoing Secret Leak Protection**: Before dispatching any prompt or active editor selection to Gemini, the payload is scanned line-by-line using `scanText` from `src/secrets.ts`. If any secret rule is triggered, the request is blocked and an error toast is surfaced: `"Text contains a possible secret (<rule>); not sent."` without disclosing the matched content.
4. **Timeout and Cancellation**: All requests use an `AbortController` with a 60-second timeout. Users can cancel in-flight requests at any time via the UI "Cancel" button, which aborts the signal and transitions the UI back to idle.
5. **Length Bounds & Truncation**: User prompts are capped at 8,000 characters in the UI. Incoming responses over 50,000 characters are safely truncated with ` [Truncated by Buildtri]` and flagged in the UI.
6. **Safe Editor Insertion**: Code inserted via the "Insert into active file" action extracts code blocks using `extractCode` and safely replaces the active editor's selection. Insertion is rejected if the document is untitled, located outside the workspace, or inside `.buildtri` / `node_modules`. Inserted code updates `provenance.json` by tagging the file as `vibe` with `reviewed: false` and linking selected `reqIds`.
7. **XSS Prevention**: Responses are rendered strictly as plain text using `textContent` into a `<pre id="ai-response-box">` element (never `innerHTML`).

## Change Flow & Traceability Architecture

### 1. Tag Traceability & Stack-Agnostic Classification
Source code and tests reference requirements using standard `REQ-<digits>` tags (e.g. `// REQ-1 login authentication`). `src/trace.ts` classifies files using `config.testPathRegex` (defaulting to standard path segments `test/tests/__tests__/spec/specs` and suffixes `.(test|spec).` or prefixes `test_`), associating files and tests with up to 20 lines per file. Any tag whose requirement does not exist is categorized under `orphans`.

### 2. Requirement Modification & Gated Change Flow
When an existing requirement's title or criteria are updated via `req:save`, its status switches to `changed` with metadata recording `{ at, fields }`. To advance, the user triggers `change:confirm { reqId, lane }`:
- **Step 1 (Test Step)**: Replaces `{req}` in `config.testByReqCommand` strictly with the validated `REQ-<digits>` ID. If this command is unconfigured or fails (`exit != 0`, cancellation, timeout), execution halts, the requirement stays `changed`, and security is logged as `not run`.
- **Step 2 (Security Step)**: Executes workspace secret scanning followed by `config.lintCommand`.
- **Step 3 (Audit Trail)**: Appends an immutable audit entry to `/.buildtri/changes.md`. On PASS, the requirement returns to `open` status; on FAIL, it remains `changed`.

### 3. `changes.md` Record Format
Each change flow attempt writes an append-only block:
```markdown
## <ISO date> · REQ-<n> · lane: <lane>
- Changed fields: <comma-separated fields or "none">
- Affected files: <comma-separated paths or "none">
- Affected tests: <comma-separated paths or "none tagged">
- Tests: pass | fail (exit n) | cancelled | not configured
- Security: pass | fail (<number of reasons>) | not run
- Result: PASS | FAIL
```
Neither secret values nor raw command outputs are written to `changes.md`.

## Release Gate & Release Notes Architecture

### 1. Release Gate Determinism
The Release gate is evaluated live and passes only if all 4 conditions are met:
1. **Build Gate is OK**: Every provenance file with lane `vibe` must have `reviewed: true` (one reason per unreviewed file: `<path> is Vibe and not reviewed.`).
2. **Test Gate is OK**: Tests must have been run with exit code 0, matching the current test command, and fresher than `codeChangedAt`.
3. **Security Gate is OK**: Secret scan must have no findings, and the lint command must have passed fresher than `codeChangedAt`.
4. **No Unverified REQs**: No requirement may remain in `changed` status. Any requirement in `changed` produces the reason: `REQ-<n> has an unverified change.` to ensure that modified requirements have completed the change flow verification before shipping.

### 2. Optional Build Command
If `config.buildCommand` is configured, running the release gate first executes this command using the secure runner (enforcing workspace trust, explicit user modal confirmation, 300s timeout, user cancellation, ANSI stripping, and output streaming). An exit code of 0 is required; otherwise the release is blocked. If `buildCommand` is omitted, the release notes record `Build command: not configured` and the release gate relies on the 4 conditions above.

### 3. Release Notes Generation (`release-notes.md`)
Upon a successful release, `buildReleaseNotes` generates a pure markdown summary appended to `/.buildtri/release-notes.md` (append-only, never rewritten). Format:
```markdown
## Release <ISO date>
- Requirements: one line per REQ: id, title, status
- Lanes: number of tracked files per lane
- Last test run: exit code and time. Last security run: exit code and time.
- Build command: pass | not configured
- Changes since the previous release: number of entries in changes.md after the previous release heading (or all, if none)
```
Command output, command text, secrets, and source code contents are strictly prohibited from release notes.

## Deploy Gate Architecture & Confirmation Disclaimer

### 1. Verification Checklist & Gate Evaluation
The Deploy gate passes only if:
1. The `release` stage status is `done`. Reason if not: `Release is not done.`
2. Every item in `state.deployChecklist` is confirmed (`checked === true`). Reason per unchecked item: `Checklist item not confirmed: <label>`.

The 4 fixed checklist items are:
- `Release notes reviewed`
- `Rollback plan noted`
- `No secrets in the repository`
- `Deployment target confirmed`

### 2. Platform Agnostic Deployment Notice
**Buildtri does NOT deploy anything and has no deploy command.** The Deploy gate serves as the final manual gatekeeper and audit confirmation in the 8-stage lifecycle. Completing Deploy only records that all operational and architectural checks have been verified.

## Lane Comparison Architecture

The Lane Comparison view (`btn-compare`) provides a live, zero-dependency dashboard visualizing key software engineering metrics:
1. **Files per Lane**: Proportion of tracked files in Vibe, Hybrid, and Manual lanes, plus REQ linkage coverage.
2. **Change Flow Outcomes**: Tallies of `PASS` vs `FAIL` change runs per lane parsed from `changes.md`.
3. **Runner Reliability**: Total runs, pass/fail counts, and average duration in milliseconds per gate.
4. **Lifecycle Timeline**: Real-time status pills for all 8 development stages.

All metrics are computed from real data using pure functions in `src/compare.ts` without placeholder numbers or external chart libraries, rendered using CSS width bars and safe `textContent` DOM nodes.


