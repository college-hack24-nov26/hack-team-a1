# BUILD TRI — Stage-Gated AI SaaS IDE 
**BUILD TRI** is an advanced developer extension and framework for building software applications across 8 rigorous lifecycle stages with provenance tracking, automated secret scanning, test verification, traceability, and AI collaboration.

---

## 🚀 Key Features

1. **8-Stage Governance & Gates**:
   - **Requirement**: Define and approve functional & technical specifications (`REQ-1..n`).
   - **Plan**: Structured implementation roadmap and milestone verification.
   - **Design**: Architecture diagrams, schema definitions, and design docs.
   - **Task**: Granular task breakdown linked to requirements.
   - **Build**: Three-lane development (`Vibe`, `Hybrid`, `Manual`) with provenance tracking (`.buildtri/provenance.json`).
   - **Test**: Automated test execution and gate passage enforcement.
   - **Review**: Static security audits, code inspection, and secret detection.
   - **Release & Deploy**: Final release packaging, changelog generation, and deployment checks.

2. **Three-Lane Development Model**:
   - **Vibe**: Rapid AI-generated code requiring verification.
   - **Hybrid**: Reviewed & approved human-AI collaborative code.
   - **Manual**: Direct developer-authored implementations.

3. **Integrated Tooling**:
   - **Command Runner**: Safe execution of test and security command suites.
   - **Secret Scanner**: Real-time detection of API keys, tokens, and credentials with zero secret leakage in logs.
   - **Traceability Scanner**: Bi-directional traceability linking code, tests, and requirements.
   - **Gemini AI Integration**: Context-aware coding and stage acceleration.

---

## 📁 Repository Structure

```
├── docs/                # Architecture audits, reskin specs, and fixed panel plans
├── resources/           # Branding assets and extension icons
├── scripts/             # Fork synchronization scripts and configuration templates
│   ├── sync-to-fork.ps1 # Synchronizes extension code directly into the VS Code fork
│   ├── fork-package.json
│   └── fork-tsconfig.json
├── src/                 # Extension source code
│   ├── ai.ts            # Gemini API client & code extraction
│   ├── compare.ts       # Lane comparison & diff analytics
│   ├── extension.ts     # VS Code extension entry point
│   ├── gates.ts         # Stage gating rules and validator
│   ├── lanes.ts         # Three-lane provenance state manager
│   ├── model.ts         # Core requirements and task models
│   ├── panel.ts         # Studio Webview controller & IPC bridge
│   ├── provenance.ts    # File tracking and hash verification
│   ├── runner.ts        # Command runner for tests and audits
│   ├── scanner.ts       # Workspace secret detector
│   ├── sidebar.ts       # Side panel webview provider
│   ├── state.ts         # Central state manager & storage
│   └── trace.ts         # Requirement tag extractor & impact graph
├── test/                # Unit test suite (22/22 automated tests)
├── ui-placeholder/      # Clean, nonce-secured Webview Studio UI
├── package.json
└── tsconfig.json
```

---

## 🛠️ Development & Commands

```bash
# Install dependencies
npm install

# Run typecheck
npm run typecheck

# Run test suite
npm test

# Build extension bundle
npm run build

# Synchronize and bundle into local VS Code fork
powershell -ExecutionPolicy Bypass -File scripts\sync-to-fork.ps1
```

