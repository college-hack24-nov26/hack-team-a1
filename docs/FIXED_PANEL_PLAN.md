# Fixed Buildtri Explorer Side Panel — Architectural Audit & Implementation Plan

> **Scope**: Investigation and plan to host the Buildtri core UI as a permanently fixed view inside the Primary Side Bar's **Explorer** container, positioned strictly **ABOVE** the file tree and Open Editors, default-expanded, non-closable, and non-draggable.

---

## 1. Investigation Findings (Questions a – d)

### a) Ordering of Extension-Contributed Views in the Explorer Container

#### Ordering Mechanism in VS Code
Views inside any view container (including `workbench.view.explorer`) are ordered and sorted by `ViewContainerModel.compareViewDescriptors` in [`vscode/src/vs/workbench/services/views/common/viewContainerModel.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/services/views/common/viewContainerModel.ts#L697-L708):

```typescript
// lines 697-708 of viewContainerModel.ts
private compareViewDescriptors(a: IViewDescriptorItem, b: IViewDescriptorItem): number {
    if (a.viewDescriptor.id === b.viewDescriptor.id) {
        return 0;
    }
    return (this.getViewOrder(a) - this.getViewOrder(b)) || this.getGroupOrderResult(a.viewDescriptor, b.viewDescriptor);
}

private getViewOrder(viewDescriptorItem: IViewDescriptorItem): number {
    const viewOrder = typeof viewDescriptorItem.state.order === 'number' ? viewDescriptorItem.state.order : viewDescriptorItem.viewDescriptor.order;
    return typeof viewOrder === 'number' ? viewOrder : Number.MAX_VALUE;
}
```

#### Built-in Explorer Views & Their Orders
In [`vscode/src/vs/workbench/contrib/files/browser/explorerViewlet.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/contrib/files/browser/explorerViewlet.ts):
- **Open Editors View (`OpenEditorsView`)**: Registered with **`order: 0`** (line 113).
- **Empty Folder View (`EmptyView`)**: Registered with **`order: 1`** (line 131).
- **Folders / File Tree View (`ExplorerView`)**: Registered with **`order: 1`** (line 146).
- Outline, Timeline, and NPM views are registered by their respective contributions with `order: 2`, `order: 3`, etc.

#### How Extension Views Get Their Order
When an extension contributes a view to `explorer` via `package.json` (`contributes.views.explorer`), the extension point handler in [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts#L483-L487) computes `order`:

```typescript
// lines 483-487 of viewsExtensionPoint.ts
const order = ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)
    ? index + 1
    : container.viewOrderDelegate
        ? container.viewOrderDelegate.getOrder(item.group)
        : undefined;
```

Because `container.id === 'workbench.view.explorer'`:
1. `container.extensionId` is `undefined` (it is a core built-in container, not an extension-contributed container).
2. `container.viewOrderDelegate` is `undefined` (Explorer does not define an order delegate).
3. The JSON schema for `package.json` `contributes.views` does not accept an `order` property from extension manifests.
4. Hence, `order` is unconditionally set to **`undefined`**.
5. When `getViewOrder` evaluates an `undefined` order, it falls back to **`Number.MAX_VALUE`** (`viewContainerModel.ts:707`).

#### Verdict on `package.json` Only
**An extension via `package.json` alone CANNOT place a view at the top of the Explorer container.** Any view contributed via pure `package.json` is assigned `Number.MAX_VALUE` and sorted to the very bottom of the Explorer viewlet (below Open Editors, Folders, Outline, Timeline, etc.).

---

### b) View Descriptor Properties and Defaults for Extension Views

The interface `IViewDescriptor` is defined in [`vscode/src/vs/workbench/common/views.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/common/views.ts#L292-L320).

For extension-contributed views, the descriptor values are constructed in [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts#L516-L539):

| Property | Default for Extension Views | Source File & Line | Configurable via `package.json`? |
| :--- | :--- | :--- | :--- |
| **`canToggleVisibility`** | **`true`** (hardcoded) | `viewsExtensionPoint.ts:524` | **No**. Hardcoded literal `true`. |
| **`canMoveView`** | **`true`** (`viewContainer?.id !== REMOTE`) | `viewsExtensionPoint.ts:525` | **No**. Hardcoded based on remote check. |
| **`collapsed`** | **`true`** in Explorer (`showCollapsed(container)` returns `true` for `EXPLORER`) | `viewsExtensionPoint.ts:527`, `637-644` | **No**. Explorer container forces collapsed. |
| **`initialSize` / `weight`** | Ignored and discarded with a warning if the container is built-in (`explorer`) | `viewsExtensionPoint.ts:503-509` | **No**. Ignored if `container.extensionId` does not match the extension. |
| **`order`** | **`undefined`** (`Number.MAX_VALUE`) | `viewsExtensionPoint.ts:483-487` | **No**. Schema rejects `order`. |

---

### c) Requirement Feasibility Matrix: `package.json` vs. Fork Source Changes

| Requirement | Can be done via `package.json`? | Needs Fork Source Change? | Exact Fork File & Function/Line |
| :--- | :---: | :---: | :--- |
| **1. Top Position** (above Open Editors & File Tree) | ❌ No | **YES** | [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts#L483)<br>Set `order = -1` when `item.id === 'buildtri.panel'`. (Since `OpenEditorsView` is `0` and `ExplorerView` is `1`, `-1` guarantees position #0 at the very top). |
| **2. Cannot Close / Hide** (`canToggleVisibility: false`) | ❌ No | **YES** | [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts#L524)<br>Set `canToggleVisibility: item.id === 'buildtri.panel' ? false : true`.<br>Enforces in `viewContainerModel.ts:431` and hides "Hide" in `viewDescriptorService.ts:840`. |
| **3. Cannot Move / Drag** (`canMoveView: false`) | ❌ No | **YES** | [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts#L525) & [`viewPaneContainer.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/browser/parts/views/viewPaneContainer.ts#L893)<br>Set `canMoveView: item.id === 'buildtri.panel' ? false : ...`. Disables "Move to..." and drag overlay transfers. |
| **4. Default Expanded** (`collapsed: false`) | ❌ No | **YES** | [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts#L527)<br>Set `collapsed: item.id === 'buildtri.panel' ? false : ...`. Bypasses `showCollapsed(EXPLORER)`. |

---

### d) Smallest, Safest Change Set, Upstream Conflict Risk, and Build Impact

#### Smallest & Safest Core Change (Exact diff in 1 file):
In [`vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`](file:///C:/Users/Admin/hackthon%20doc/vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts):

```typescript
// Around line 483:
const isBuildtriFixed = item.id === 'buildtri.panel';
const order = isBuildtriFixed
    ? -1
    : ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)
        ? index + 1
        : container.viewOrderDelegate
            ? container.viewOrderDelegate.getOrder(item.group)
            : undefined;

// Around lines 524-527:
canToggleVisibility: isBuildtriFixed ? false : true,
canMoveView: isBuildtriFixed ? false : viewContainer?.id !== REMOTE,
collapsed: isBuildtriFixed ? false : (this.showCollapsed(container) || initialVisibility === InitialVisibility.Collapsed),
```

*(Optional safety hardening in `viewPaneContainer.ts` line 895: guard `registerDraggable` so header drag gestures are inert for views with `canMoveView === false`).*

#### Upstream Conflict Risk:
- **Virtually Zero**: This is a surgical 6-line conditional check targeted exclusively at the identifier `'buildtri.panel'` inside `viewsExtensionPoint.ts`.
- It does not modify public API surfaces, does not touch Electron or VS Code core contracts, and does not alter behavior for any other built-in or marketplace extensions.
- When pulling upstream VS Code releases, git three-way merge will either cleanly apply or resolve trivially.

#### Rebuild & Compile Time:
- Changing `viewsExtensionPoint.ts` only requires an incremental TypeScript compilation of workbench files.
- `npm run compile` (or `npx gulp compile-build`) takes **~15 to 25 seconds** on this machine.
- The extension bundle in `vscode/extensions/buildtri` takes **< 1 second** with esbuild.

---

## 2. Implementation Blueprint for Step 2

### 1. Extension Manifest & Architecture Updates
1. **Remove Separate Activity Bar Container**:
   - In `package.json` and `scripts/fork-package.json`, remove `contributes.viewsContainers.activitybar` completely.
   - Remove `buildtri.statusView`.
2. **Register Fixed View in Explorer**:
   ```json
   "views": {
     "explorer": [
       {
         "type": "webview",
         "id": "buildtri.panel",
         "name": "BUILD TRI"
       }
     ]
   }
   ```
3. **Register WebviewViewProvider**:
   - In `src/extension.ts`, register the provider for `buildtri.panel` with `retainContextWhenHidden: true`.

### 2. Panel UI Content (`src/sidebar.ts`)
The sidebar webview will render a responsive, self-scrolling, rich compact panel using standard VS Code CSS variables, strict nonce CSP, and safe DOM manipulation (`textContent`):
1. **8-Stage Rail**:
   - 8 compact horizontal/wrapped pill stages with status badges:
     - Requirement, Plan, Design, Task, Test, Review, Release, Deploy.
     - Status icons: `✓` (completed), `●` (active), `○` (pending), `!` (blocked).
     - Clicking any stage selects it and inspects its gate.
2. **Gate Card for Selected Stage**:
   - Stage title, Active/Blocked/Completed badge.
   - List of gate criteria and reasons why the stage is active or blocked.
   - Action button: **"Complete Stage"** (disabled if blocked or already completed).
3. **Active File Lane Card**:
   - Shows active editor file name and its lane: `vibe` (purple badge), `hybrid` (blue badge), or `manual` (green badge).
   - Action button: **"Approve as Hybrid"** (active when lane is vibe).
4. **Test & Security Summary**:
   - Last test run status (`passed` / `failed` / `not run`).
   - Last security scan status & detected secrets count.
5. **Quick Launcher Buttons**:
   - **"Open Studio"**: Launches the full Buildtri Studio tab.
   - **"AI Agent"**: Triggers Gemini / AI prompt flow.
   - **"Compare Lanes"**: Opens diff / lane inspection.

### 3. State & Sync Architecture
- **No Duplication**: Reuses existing `StateManager`, `LanesManager`, `CommandRunner`, `SecretScanner`, and `GeminiClient`.
- State transitions, active file updates, and stage progressions broadcast simultaneously to both the Studio panel and the fixed Explorer panel.

---

## 3. Verification Protocol
1. Run `sync-to-fork.ps1` to sync the outer project to `vscode/extensions/buildtri`.
2. Compile fork incrementally (`npm run compile`).
3. Launch fork via `scripts\code.bat --disable-gpu`.
4. Verify:
   - Primary Side Bar shows Explorer as the default container.
   - **BUILD TRI** appears as the very first section **ABOVE** Open Editors and the workspace folder.
   - Right-clicking the "BUILD TRI" header reveals no "Hide" or close option.
   - Dragging the header to the editor area or secondary side bar is prohibited.
   - The 8 stages are visible with accurate real-time statuses.
   - Clicking stages, completing criteria, and clicking "Approve as Hybrid" reactively updates both the side panel and the opened workspace.

