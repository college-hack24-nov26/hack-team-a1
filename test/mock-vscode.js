// Mock implementation of VS Code API for running pure tests outside the extension host
class MockRange {
  constructor(startLine, startChar, endLine, endChar) {
    this.startLine = startLine || 0;
    this.startChar = startChar || 0;
    this.endLine = endLine || 0;
    this.endChar = endChar || 0;
  }
}

class MockPosition {
  constructor(line, character) {
    this.line = line || 0;
    this.character = character || 0;
  }
}

class MockDiagnostic {
  constructor(range, message, severity) {
    this.range = range || {};
    this.message = message || '';
    this.severity = severity || 0;
  }
}

class MockEventEmitter {
  constructor() {
    this.event = () => {};
  }
  fire() {}
}

class MockRelativePattern {
  constructor(base, pattern) {
    this.base = base;
    this.pattern = pattern;
  }
}

module.exports = {
  window: {
    activeTextEditor: undefined,
    showErrorMessage: () => Promise.resolve(),
    showInformationMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve()
  },
  workspace: {
    isTrusted: true,
    workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
    createFileSystemWatcher: () => ({
      onDidChange: () => ({ dispose: () => {} }),
      onDidCreate: () => ({ dispose: () => {} }),
      onDidDelete: () => ({ dispose: () => {} }),
      dispose: () => {}
    })
  },
  languages: {
    createDiagnosticCollection: () => ({
      set: () => {},
      delete: () => {},
      clear: () => {}
    })
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} })
  },
  RelativePattern: MockRelativePattern,
  Range: MockRange,
  Position: MockPosition,
  Diagnostic: MockDiagnostic,
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  Uri: {
    file: (f) => ({ fsPath: f, path: f, scheme: 'file' })
  },
  EventEmitter: MockEventEmitter
};
