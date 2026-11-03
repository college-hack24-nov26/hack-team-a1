const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const file1 = path.join(repoRoot, 'vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts');
let content1 = fs.readFileSync(file1, 'utf8');

const startStr = 'const order = ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)';
const endStr = '\t\t\t\t\t\tweight,';

const startIdx = content1.indexOf(startStr);
const endIdx = content1.indexOf(endStr, startIdx);

if (startIdx === -1 || endIdx === -1) {
  throw new Error(`Anchor strings not found in viewsExtensionPoint.ts: startIdx=${startIdx}, endIdx=${endIdx}`);
}

const originalSlice = content1.slice(startIdx, endIdx + endStr.length);

const replacementSlice = `const isBuildtriFixed = item.id === 'buildtri.panel';

\t\t\t\t\tconst order = isBuildtriFixed
\t\t\t\t\t\t? -1
\t\t\t\t\t\t: ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)
\t\t\t\t\t\t\t? index + 1
\t\t\t\t\t\t\t: container.viewOrderDelegate
\t\t\t\t\t\t\t\t? container.viewOrderDelegate.getOrder(item.group)
\t\t\t\t\t\t\t\t: undefined;

\t\t\t\t\tlet icon: ThemeIcon | URI | undefined;
\t\t\t\t\tif (typeof item.icon === 'string') {
\t\t\t\t\t\ticon = ThemeIcon.fromString(item.icon) || resources.joinPath(extension.description.extensionLocation, item.icon);
\t\t\t\t\t}

\t\t\t\t\tconst initialVisibility = this.convertInitialVisibility(item.visibility);

\t\t\t\t\tconst type = this.getViewType(item.type);
\t\t\t\t\tif (!type) {
\t\t\t\t\t\tcollector.error(localize('unknownViewType', "Unknown view type \`{0}\`.", item.type));
\t\t\t\t\t\tcontinue;
\t\t\t\t\t}

\t\t\t\t\tlet weight: number | undefined = undefined;
\t\t\t\t\tif (typeof item.initialSize === 'number') {
\t\t\t\t\t\tif (container.extensionId?.value === extension.description.identifier.value || isBuildtriFixed) {
\t\t\t\t\t\t\tweight = item.initialSize;
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tthis.logService.warn(\`\${extension.description.identifier.value} tried to set the view size of \${item.id} but it was ignored because the view container does not belong to it.\`);
\t\t\t\t\t\t}
\t\t\t\t\t} else if (isBuildtriFixed) {
\t\t\t\t\t\tweight = 30;
\t\t\t\t\t}

\t\t\t\t\tlet accessibilityHelpContent;
\t\t\t\t\tif (isProposedApiEnabled(extension.description, 'contribAccessibilityHelpContent') && item.accessibilityHelpContent) {
\t\t\t\t\t\taccessibilityHelpContent = new MarkdownString(item.accessibilityHelpContent);
\t\t\t\t\t}

\t\t\t\t\tconst viewDescriptor: ICustomViewDescriptor = {
\t\t\t\t\t\ttype: type,
\t\t\t\t\t\tctorDescriptor: type === ViewType.Tree ? new SyncDescriptor(TreeViewPane) : new SyncDescriptor(WebviewViewPane),
\t\t\t\t\t\tid: item.id,
\t\t\t\t\t\tname: { value: item.name, original: item.name },
\t\t\t\t\t\twhen: ContextKeyExpr.deserialize(item.when),
\t\t\t\t\t\tcontainerIcon: icon || viewContainer?.icon,
\t\t\t\t\t\tcontainerTitle: item.contextualTitle || (viewContainer && (typeof viewContainer.title === 'string' ? viewContainer.title : viewContainer.title.value)),
\t\t\t\t\t\tcanToggleVisibility: isBuildtriFixed ? false : true,
\t\t\t\t\t\tcanMoveView: isBuildtriFixed ? false : viewContainer?.id !== REMOTE,
\t\t\t\t\t\ttreeView: type === ViewType.Tree ? this.instantiationService.createInstance(CustomTreeView, item.id, item.name, extension.description.identifier.value) : undefined,
\t\t\t\t\t\tcollapsed: isBuildtriFixed ? false : (this.showCollapsed(container) || initialVisibility === InitialVisibility.Collapsed),
\t\t\t\t\t\torder: order,
\t\t\t\t\t\textensionId: extension.description.identifier,
\t\t\t\t\t\toriginalContainerId: key,
\t\t\t\t\t\tgroup: item.group,
\t\t\t\t\t\t// eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
\t\t\t\t\t\tremoteAuthority: item.remoteName || (<any>item).remoteAuthority, // TODO@roblou - delete after remote extensions are updated
\t\t\t\t\t\tvirtualWorkspace: item.virtualWorkspace,
\t\t\t\t\t\thideByDefault: initialVisibility === InitialVisibility.Hidden,
\t\t\t\t\t\tworkspace: viewContainer?.id === REMOTE ? true : undefined,
\t\t\t\t\t\tweight,`;

content1 = content1.slice(0, startIdx) + replacementSlice + content1.slice(endIdx + endStr.length);
fs.writeFileSync(file1, content1, 'utf8');
console.log('viewsExtensionPoint.ts patched successfully!');

const file2 = path.join(repoRoot, 'vscode/src/vs/workbench/browser/parts/views/viewPaneContainer.ts');
let content2 = fs.readFileSync(file2, 'utf8');
const oldDrag = '\t\t\tif (pane.draggableElement) {\r\n\t\t\t\tstore.add(CompositeDragAndDropObserver.INSTANCE.registerDraggable(pane.draggableElement, () => { return { type: \'view\', id: pane.id }; }, {}));\r\n\t\t\t}';
const newDrag = '\t\t\tif (pane.draggableElement) {\r\n\t\t\t\tconst viewDescriptor = this.viewDescriptorService.getViewDescriptorById(pane.id);\r\n\t\t\t\tif (!viewDescriptor || viewDescriptor.canMoveView !== false) {\r\n\t\t\t\t\tstore.add(CompositeDragAndDropObserver.INSTANCE.registerDraggable(pane.draggableElement, () => { return { type: \'view\', id: pane.id }; }, {}));\r\n\t\t\t\t}\r\n\t\t\t}';

if (content2.includes(oldDrag)) {
  content2 = content2.replace(oldDrag, newDrag);
  fs.writeFileSync(file2, content2, 'utf8');
  console.log('viewPaneContainer.ts patched successfully!');
} else {
  console.log('viewPaneContainer.ts already patched or oldDrag not found');
}

