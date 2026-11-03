// Buildtri UI Client Script
(function () {
  const vscode = acquireVsCodeApi();

  // Elements: Header & Controls
  const btnRefresh = document.getElementById('btn-refresh');
  const btnCompare = document.getElementById('btn-compare');
  const currentStageBadge = document.getElementById('current-stage-badge');
  const toastContainer = document.getElementById('toast-container');

  // Elements: Gate Status Card
  const currentStageTitle = document.getElementById('current-stage-title');
  const gateStatusCard = document.getElementById('gate-status-card');
  const gateCardTitle = document.getElementById('gate-card-title');
  const gateStageBadge = document.getElementById('gate-stage-badge');
  const gateWarning = document.getElementById('gate-warning');
  const btnCompleteStage = document.getElementById('btn-complete-stage');
  const gateReasonsList = document.getElementById('gate-reasons-list');

  // Elements: Stage Views
  const viewRequirement = document.getElementById('view-requirement');
  const viewPlan = document.getElementById('view-plan');
  const viewDesign = document.getElementById('view-design');
  const viewBuild = document.getElementById('view-build');
  const viewTest = document.getElementById('view-test');
  const viewSecurity = document.getElementById('view-security');
  const viewRelease = document.getElementById('view-release');
  const viewDeploy = document.getElementById('view-deploy');

  // Elements: Release Stage (M8)
  const releaseCmdDisplay = document.getElementById('release-cmd-display');
  const releaseStatusLine = document.getElementById('release-status-line');
  const releaseLastRun = document.getElementById('release-last-run');
  const btnReleaseCancel = document.getElementById('btn-release-cancel');
  const releaseLogConsole = document.getElementById('release-log-console');
  const releaseNotesList = document.getElementById('release-notes-list');

  // Elements: Deploy Stage (M8)
  const deployChecklistContainer = document.getElementById('deploy-checklist-container');
  const deployChecklistCount = document.getElementById('deploy-checklist-count');

  // Elements: Compare View Modal (M8)
  const compareModal = document.getElementById('compare-modal');
  const btnCloseCompare = document.getElementById('btn-close-compare');
  const compareLanesContainer = document.getElementById('compare-lanes-container');
  const compareChangesContainer = document.getElementById('compare-changes-container');
  const compareRunsContainer = document.getElementById('compare-runs-container');
  const compareTimelineContainer = document.getElementById('compare-timeline-container');

  // Elements: Test Stage
  const testCmdDisplay = document.getElementById('test-cmd-display');
  const testStatusLine = document.getElementById('test-status-line');
  const testLastRun = document.getElementById('test-last-run');
  const btnTestCancel = document.getElementById('btn-test-cancel');
  const testLogConsole = document.getElementById('test-log-console');

  // Elements: Security Stage
  const securityCmdDisplay = document.getElementById('security-cmd-display');
  const securityStatusLine = document.getElementById('security-status-line');
  const securityLastRun = document.getElementById('security-last-run');
  const btnSecurityCancel = document.getElementById('btn-security-cancel');
  const securityLogConsole = document.getElementById('security-log-console');
  const btnScanSecrets = document.getElementById('btn-scan-secrets');
  const secretFindingsList = document.getElementById('secret-findings-list');

  // Elements: Build Stage (Lanes Panel)
  const buildFilesCountBadge = document.getElementById('build-files-count-badge');
  const buildFilesList = document.getElementById('build-files-list');

  // Elements: Requirement Editor
  const reqCountBadge = document.getElementById('req-count-badge');
  const reqList = document.getElementById('req-list');
  const reqFormId = document.getElementById('req-form-id');
  const reqFormMode = document.getElementById('req-form-mode');
  const reqTitleInput = document.getElementById('req-title-input');
  const reqCriteriaInput = document.getElementById('req-criteria-input');
  const btnReqSave = document.getElementById('btn-req-save');
  const btnReqClear = document.getElementById('btn-req-clear');

  // Elements: Plan Editor
  const taskCountBadge = document.getElementById('task-count-badge');
  const taskList = document.getElementById('task-list');
  const taskFormId = document.getElementById('task-form-id');
  const taskFormMode = document.getElementById('task-form-mode');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskReqCheckboxes = document.getElementById('task-req-checkboxes');
  const btnTaskSave = document.getElementById('btn-task-save');
  const btnTaskClear = document.getElementById('btn-task-clear');

  // Elements: Design Editor
  const designCountBadge = document.getElementById('design-count-badge');
  const designList = document.getElementById('design-list');
  const designFormId = document.getElementById('design-form-id');
  const designFormMode = document.getElementById('design-form-mode');
  const designTitleInput = document.getElementById('design-title-input');
  const designPathInput = document.getElementById('design-path-input');
  const designReqCheckboxes = document.getElementById('design-req-checkboxes');
  const btnDesignSave = document.getElementById('btn-design-save');
  const btnDesignClear = document.getElementById('btn-design-clear');

  // Elements: Inspector & Telemetry
  const provenanceCountBadge = document.getElementById('provenance-count-badge');
  const provenanceList = document.getElementById('provenance-list');
  const configSummary = document.getElementById('config-summary');
  const runConsole = document.getElementById('run-console');

  // Elements: Traceability & Change Flow (M6)
  const orphanTagsSection = document.getElementById('orphan-tags-section');
  const orphanTagsList = document.getElementById('orphan-tags-list');

  const changePanel = document.getElementById('change-panel');
  const changePanelHeading = document.getElementById('change-panel-heading');
  const changeReqId = document.getElementById('change-req-id');
  const changeReqStatusBadge = document.getElementById('change-req-status-badge');
  const changeReqFields = document.getElementById('change-req-fields');
  const changeReqFiles = document.getElementById('change-req-files');
  const changeReqTests = document.getElementById('change-req-tests');
  const changeLaneSelect = document.getElementById('change-lane-select');
  const btnChangeConfirm = document.getElementById('btn-change-confirm');
  const btnChangeCancel = document.getElementById('btn-change-cancel');
  const changeLogConsole = document.getElementById('change-log-console');
  const changeResultBox = document.getElementById('change-result-box');
  const changeTestStepStatus = document.getElementById('change-test-step-status');
  const changeSecStepStatus = document.getElementById('change-sec-step-status');
  const changeOverallOutcome = document.getElementById('change-overall-outcome');

  const changeLogSection = document.getElementById('change-log-section');
  const changesHeadingsList = document.getElementById('changes-headings-list');

  // Elements: Gemini AI Assistant (M7)
  const aiSection = document.getElementById('ai-section');
  const aiDrawerHeader = document.getElementById('ai-drawer-header');
  const aiDrawerBody = document.getElementById('ai-drawer-body');
  const btnToggleAi = document.getElementById('btn-toggle-ai');
  const aiKeyBadge = document.getElementById('ai-key-badge');
  const aiModelBadge = document.getElementById('ai-model-badge');
  const aiStatusLine = document.getElementById('ai-status-line');
  const aiPromptInput = document.getElementById('ai-prompt-input');
  const aiPromptCharCount = document.getElementById('ai-prompt-char-count');
  const aiIncludeSelection = document.getElementById('ai-include-selection');
  const aiReqCheckboxes = document.getElementById('ai-req-checkboxes');
  const btnAiSend = document.getElementById('btn-ai-send');
  const btnAiCancel = document.getElementById('btn-ai-cancel');
  const btnAiInsert = document.getElementById('btn-ai-insert');
  const aiResponseContainer = document.getElementById('ai-response-container');
  const aiTruncationNote = document.getElementById('ai-truncation-note');
  const aiResponseBox = document.getElementById('ai-response-box');

  let currentSelectedStage = 'requirement';
  let cachedState = null;
  let cachedImpact = { byReq: {}, orphans: [] };
  let expandedImpactReqs = new Set();
  let activeChangedReqId = null;
  let latestAiResultId = null;
  let isAiDrawerOpen = true;
  let currentAiModel = '';

  // Request initial state on startup
  vscode.postMessage({ type: 'ready' });

  // Header controls
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      vscode.postMessage({ type: 'ready' });
      appendLog('Requested state refresh from extension host...', 'info');
    });
  }

  if (btnCompare) {
    btnCompare.addEventListener('click', () => {
      if (compareModal) compareModal.style.display = 'flex';
    });
  }

  if (btnCloseCompare) {
    btnCloseCompare.addEventListener('click', () => {
      if (compareModal) compareModal.style.display = 'none';
    });
  }

  // Complete Stage button trigger
  if (btnCompleteStage) {
    btnCompleteStage.addEventListener('click', () => {
      vscode.postMessage({ type: 'gate:run', stage: currentSelectedStage });
      appendLog(`Running gate check for stage: ${currentSelectedStage}...`, 'info');
    });
  }

  // Cancel Runner triggers (M5, M6, M8)
  if (btnTestCancel) {
    btnTestCancel.addEventListener('click', () => {
      vscode.postMessage({ type: 'run:cancel', gate: 'test' });
      appendLog('Requested cancellation of test run...', 'warn');
    });
  }

  if (btnSecurityCancel) {
    btnSecurityCancel.addEventListener('click', () => {
      vscode.postMessage({ type: 'run:cancel', gate: 'security' });
      appendLog('Requested cancellation of security lint run...', 'warn');
    });
  }

  if (btnReleaseCancel) {
    btnReleaseCancel.addEventListener('click', () => {
      vscode.postMessage({ type: 'run:cancel', gate: 'release' });
      appendLog('Requested cancellation of release build run...', 'warn');
    });
  }

  if (btnChangeCancel) {
    btnChangeCancel.addEventListener('click', () => {
      vscode.postMessage({ type: 'run:cancel', gate: 'change' });
      appendLog('Requested cancellation of change run...', 'warn');
    });
  }

  if (btnChangeConfirm) {
    btnChangeConfirm.addEventListener('click', () => {
      if (!activeChangedReqId) {
        showToast('No changed requirement selected to confirm.', 'warn');
        return;
      }
      const lane = changeLaneSelect ? changeLaneSelect.value : 'hybrid';
      vscode.postMessage({
        type: 'change:confirm',
        reqId: activeChangedReqId,
        lane: lane
      });
      appendLog(`Triggered change flow for ${activeChangedReqId} on lane ${lane}...`, 'info');

      if (changeResultBox) {
        changeResultBox.style.display = 'block';
        if (changeTestStepStatus) changeTestStepStatus.textContent = 'running...';
        if (changeSecStepStatus) changeSecStepStatus.textContent = 'pending...';
        if (changeOverallOutcome) {
          changeOverallOutcome.textContent = 'RUNNING';
          changeOverallOutcome.className = 'badge badge-active';
        }
      }
      if (changeLogConsole) {
        changeLogConsole.style.display = 'block';
      }
    });
  }

  if (btnScanSecrets) {
    btnScanSecrets.addEventListener('click', () => {
      vscode.postMessage({ type: 'gate:run', stage: 'security' });
      appendLog('Triggered secret scan for workspace...', 'info');
    });
  }

  // Setup click listeners for Stage Rail items
  const stageOrder = [
    'requirement',
    'plan',
    'design',
    'build',
    'test',
    'security',
    'release',
    'deploy'
  ];
  stageOrder.forEach((stageId) => {
    const item = document.getElementById(`stage-item-${stageId}`);
    if (item) {
      item.addEventListener('click', () => {
        currentSelectedStage = stageId;
        vscode.postMessage({ type: 'stage:select', stage: stageId });
      });
    }
  });

  // Setup Form Triggers: Requirement
  if (btnReqSave) {
    btnReqSave.addEventListener('click', () => {
      const id = reqFormId.value.trim() || undefined;
      const title = reqTitleInput.value.trim();
      const criteriaLines = reqCriteriaInput.value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      vscode.postMessage({
        type: 'req:save',
        req: {
          id,
          title,
          criteria: criteriaLines
        }
      });
    });
  }

  if (btnReqClear) {
    btnReqClear.addEventListener('click', () => {
      resetReqForm();
    });
  }

  // Setup Form Triggers: Plan (Task)
  if (btnTaskSave) {
    btnTaskSave.addEventListener('click', () => {
      const id = taskFormId.value.trim() || undefined;
      const title = taskTitleInput.value.trim();
      const checkedReqs = Array.from(
        document.querySelectorAll('input[name="task-req-check"]:checked')
      ).map((cb) => cb.value);

      vscode.postMessage({
        type: 'task:save',
        task: {
          id,
          title,
          reqIds: checkedReqs
        }
      });
    });
  }

  if (btnTaskClear) {
    btnTaskClear.addEventListener('click', () => {
      resetTaskForm();
    });
  }

  // Setup Form Triggers: Design Spec
  if (btnDesignSave) {
    btnDesignSave.addEventListener('click', () => {
      const id = designFormId.value.trim() || undefined;
      const title = designTitleInput.value.trim();
      const pathVal = designPathInput.value.trim();
      const checkedReqs = Array.from(
        document.querySelectorAll('input[name="design-req-check"]:checked')
      ).map((cb) => cb.value);

      vscode.postMessage({
        type: 'design:save',
        design: {
          id,
          title,
          path: pathVal,
          reqIds: checkedReqs
        }
      });
    });
  }

  if (btnDesignClear) {
    btnDesignClear.addEventListener('click', () => {
      resetDesignForm();
    });
  }

  // Setup AI Assistant Triggers (M7)
  if (btnToggleAi) {
    btnToggleAi.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAiDrawer();
    });
  }

  if (aiDrawerHeader) {
    aiDrawerHeader.addEventListener('click', () => {
      toggleAiDrawer();
    });
  }

  function toggleAiDrawer() {
    if (!aiDrawerBody) return;
    isAiDrawerOpen = !isAiDrawerOpen;
    aiDrawerBody.style.display = isAiDrawerOpen ? 'flex' : 'none';
    if (btnToggleAi) {
      btnToggleAi.textContent = isAiDrawerOpen ? 'Collapse' : 'Expand';
    }
  }

  function updateAiSendButtonState() {
    if (!btnAiSend) return;
    const prompt = aiPromptInput ? aiPromptInput.value : '';
    const len = prompt.length;
    const hasModel = currentAiModel && currentAiModel.trim().length > 0;
    btnAiSend.disabled = !hasModel || len === 0 || len > 8000;
  }

  if (aiPromptInput) {
    aiPromptInput.addEventListener('input', () => {
      const len = aiPromptInput.value.length;
      if (aiPromptCharCount) {
        aiPromptCharCount.textContent = `${len} / 8000`;
        if (len > 8000) {
          aiPromptCharCount.style.color = 'var(--status-fail, #e5534b)';
          aiPromptCharCount.style.fontWeight = 'bold';
        } else {
          aiPromptCharCount.style.color = '';
          aiPromptCharCount.style.fontWeight = '';
        }
      }
      updateAiSendButtonState();
    });
  }

  if (btnAiSend) {
    btnAiSend.addEventListener('click', () => {
      const prompt = aiPromptInput ? aiPromptInput.value : '';
      if (!prompt || prompt.length === 0 || prompt.length > 8000) {
        return;
      }

      const checkedReqs = Array.from(
        document.querySelectorAll('input[name="ai-req-check"]:checked')
      ).map((cb) => cb.value);

      const includeSelection = aiIncludeSelection ? aiIncludeSelection.checked : false;

      vscode.postMessage({
        type: 'ai:ask',
        prompt,
        reqIds: checkedReqs,
        includeSelection
      });

      btnAiSend.disabled = true;
      if (btnAiCancel) btnAiCancel.style.display = 'inline-block';
      if (aiStatusLine) {
        aiStatusLine.textContent = 'calling Gemini...';
        aiStatusLine.className = 'status-active';
      }
    });
  }

  if (btnAiCancel) {
    btnAiCancel.addEventListener('click', () => {
      vscode.postMessage({ type: 'ai:cancel' });
      if (aiStatusLine) {
        aiStatusLine.textContent = 'cancelling...';
      }
    });
  }

  if (btnAiInsert) {
    btnAiInsert.addEventListener('click', () => {
      if (!latestAiResultId) {
        showToast('No AI result available to insert.', 'warn');
        return;
      }

      const checkedReqs = Array.from(
        document.querySelectorAll('input[name="ai-req-check"]:checked')
      ).map((cb) => cb.value);

      vscode.postMessage({
        type: 'ai:insert',
        resultId: latestAiResultId,
        reqIds: checkedReqs
      });
    });
  }

  // Handle incoming messages from extension host
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message) return;

    switch (message.type) {
      case 'state':
        handleStateUpdate(message.data);
        break;
      case 'run:output':
        handleRunOutput(message.gate, message.line);
        break;
      case 'run:status':
        handleRunStatus(message.gate, message.status, message.exit);
        break;
      case 'ai:status':
        handleAiStatus(message.status, message.message);
        break;
      case 'ai:result':
        handleAiResult(message);
        break;
      case 'toast':
        showToast(message.text, message.level);
        break;
    }
  });

  function handleRunOutput(gate, line) {
    appendLog(`[${gate}] ${line}`);

    // Stream directly into the stage's log console
    if (gate === 'test' && testLogConsole) {
      appendTerminalLine(testLogConsole, line);
    } else if (gate === 'security' && securityLogConsole) {
      appendTerminalLine(securityLogConsole, line);
    } else if (gate === 'release' && releaseLogConsole) {
      appendTerminalLine(releaseLogConsole, line);
    } else if (gate === 'change' && changeLogConsole) {
      appendTerminalLine(changeLogConsole, line);
    }
  }

  function handleRunStatus(gate, status, exit) {
    appendLog(`[${gate}] status: ${status}${exit !== undefined ? ` (exit ${exit})` : ''}`, status === 'cancelled' ? 'warn' : 'info');

    if (gate === 'test') {
      if (testStatusLine) {
        testStatusLine.textContent = status + (exit !== undefined ? ` (exit ${exit})` : '');
        testStatusLine.className = 'badge badge-' + (status === 'finished' ? (exit === 0 ? 'done' : 'blocked') : (status === 'running' ? 'active' : 'locked'));
      }
      if (btnTestCancel) {
        btnTestCancel.style.display = status === 'running' ? 'inline-block' : 'none';
      }
    } else if (gate === 'security') {
      if (securityStatusLine) {
        securityStatusLine.textContent = status + (exit !== undefined ? ` (exit ${exit})` : '');
        securityStatusLine.className = 'badge badge-' + (status === 'finished' ? (exit === 0 ? 'done' : 'blocked') : (status === 'running' ? 'active' : 'locked'));
      }
      if (btnSecurityCancel) {
        btnSecurityCancel.style.display = status === 'running' ? 'inline-block' : 'none';
      }
    } else if (gate === 'release') {
      if (releaseStatusLine) {
        releaseStatusLine.textContent = status + (exit !== undefined ? ` (exit ${exit})` : '');
        releaseStatusLine.className = 'badge badge-' + (status === 'finished' ? (exit === 0 ? 'done' : 'blocked') : (status === 'running' ? 'active' : 'locked'));
      }
      if (btnReleaseCancel) {
        btnReleaseCancel.style.display = status === 'running' ? 'inline-block' : 'none';
      }
    } else if (gate === 'change') {
      if (btnChangeCancel) {
        btnChangeCancel.style.display = status === 'running' ? 'inline-block' : 'none';
      }
      if (status === 'running') {
        if (changeLogConsole) changeLogConsole.style.display = 'block';
        if (changeResultBox) changeResultBox.style.display = 'block';
        if (changeTestStepStatus) changeTestStepStatus.textContent = 'running...';
        if (changeSecStepStatus) changeSecStepStatus.textContent = 'pending...';
        if (changeOverallOutcome) {
          changeOverallOutcome.textContent = 'RUNNING';
          changeOverallOutcome.className = 'badge badge-active';
        }
      } else if (status === 'finished') {
        if (exit === 0) {
          if (changeTestStepStatus) changeTestStepStatus.textContent = 'pass';
          if (changeSecStepStatus) changeSecStepStatus.textContent = 'evaluating security...';
        } else {
          if (changeTestStepStatus) changeTestStepStatus.textContent = `fail (exit ${exit})`;
          if (changeSecStepStatus) changeSecStepStatus.textContent = 'not run';
          if (changeOverallOutcome) {
            changeOverallOutcome.textContent = 'FAIL';
            changeOverallOutcome.className = 'badge badge-fail';
          }
        }
      } else if (status === 'cancelled') {
        if (changeTestStepStatus) changeTestStepStatus.textContent = 'cancelled';
        if (changeSecStepStatus) changeSecStepStatus.textContent = 'not run';
        if (changeOverallOutcome) {
          changeOverallOutcome.textContent = 'FAIL';
          changeOverallOutcome.className = 'badge badge-fail';
        }
      }
    }
  }

  function appendTerminalLine(consoleEl, line) {
    const el = document.createElement('div');
    el.className = 'log-line';
    el.textContent = line;
    consoleEl.appendChild(el);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function handleAiStatus(status, details) {
    if (aiStatusLine) {
      if (status === 'running') {
        aiStatusLine.className = 'status-active';
        aiStatusLine.textContent = details || 'calling Gemini...';
        if (btnAiSend) btnAiSend.disabled = true;
        if (btnAiCancel) btnAiCancel.style.display = 'inline-block';
      } else if (status === 'done') {
        aiStatusLine.className = 'status-pass';
        aiStatusLine.textContent = 'done';
        if (btnAiCancel) btnAiCancel.style.display = 'none';
        updateAiSendButtonState();
      } else if (status === 'error') {
        aiStatusLine.className = 'status-blocked';
        aiStatusLine.textContent = details ? `error: ${details}` : 'error';
        if (btnAiCancel) btnAiCancel.style.display = 'none';
        updateAiSendButtonState();
      } else if (status === 'idle') {
        aiStatusLine.className = 'status-locked';
        aiStatusLine.textContent = details || 'idle';
        if (btnAiCancel) btnAiCancel.style.display = 'none';
        updateAiSendButtonState();
      }
    }
  }

  function handleAiResult(msg) {
    latestAiResultId = msg.resultId;
    if (aiResponseContainer) {
      aiResponseContainer.style.display = 'block';
    }
    if (aiResponseBox) {
      // Plain text only, strictly textContent (never innerHTML) to prevent XSS
      aiResponseBox.textContent = msg.text || '';
    }
    if (aiTruncationNote) {
      aiTruncationNote.style.display = msg.truncated ? 'inline' : 'none';
    }
    if (btnAiInsert) {
      btnAiInsert.disabled = false;
    }
    if (btnAiCancel) {
      btnAiCancel.style.display = 'none';
    }
    if (aiStatusLine) {
      aiStatusLine.textContent = 'result ready';
      aiStatusLine.className = 'status-pass';
    }
  }

  function handleStateUpdate(data) {
    const { state, provenance, impact, selectedStage, gateWarning: warningText, changesHeadings } = data;
    if (!state) return;
    cachedState = state;
    if (impact) {
      cachedImpact = impact;
    }

    if (selectedStage) {
      currentSelectedStage = selectedStage;
    }

    // Dynamic Lane Colors (M8 single source of truth)
    if (data.laneColors) {
      if (data.laneColors.vibe) {
        document.documentElement.style.setProperty('--lane-vibe', data.laneColors.vibe.color);
      }
      if (data.laneColors.hybrid) {
        document.documentElement.style.setProperty('--lane-hybrid', data.laneColors.hybrid.color);
      }
      if (data.laneColors.manual) {
        document.documentElement.style.setProperty('--lane-manual', data.laneColors.manual.color);
      }
    }

    // 1. Topbar: overall active/blocked stage
    const activeStage =
      state.stages.find((s) => s.status === 'active') ||
      state.stages.find((s) => s.status === 'blocked') ||
      state.stages[0];

    if (activeStage && currentStageBadge) {
      currentStageBadge.textContent = `${activeStage.id} [${activeStage.status}]`;
      currentStageBadge.className = `badge badge-${activeStage.status}`;
    }

    // 2. Selected stage for Gate Card & Artifact view
    const selectedStageObj =
      state.stages.find((s) => s.id === currentSelectedStage) || activeStage;

    if (selectedStageObj) {
      currentSelectedStage = selectedStageObj.id;

      if (currentStageTitle) {
        currentStageTitle.textContent = `${capitalize(selectedStageObj.id)} Stage`;
      }
      if (gateCardTitle) {
        gateCardTitle.textContent = `${capitalize(selectedStageObj.id)} Gate`;
      }
      if (gateStageBadge) {
        gateStageBadge.textContent = selectedStageObj.status;
        gateStageBadge.className = `badge badge-${selectedStageObj.status}`;
      }
      if (gateStatusCard) {
        gateStatusCard.className = `gate-card gate-${selectedStageObj.status}`;
      }

      // Gate Warning for Done stage (Rule 5)
      if (gateWarning) {
        if (warningText) {
          gateWarning.style.display = 'block';
          gateWarning.textContent = warningText;
        } else {
          gateWarning.style.display = 'none';
          gateWarning.textContent = '';
        }
      }

      if (gateReasonsList) {
        gateReasonsList.innerHTML = '';
        if (selectedStageObj.reasons && selectedStageObj.reasons.length > 0) {
          selectedStageObj.reasons.forEach((reason) => {
            const li = document.createElement('li');
            li.textContent = reason;
            gateReasonsList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'Gate criteria satisfied.';
          gateReasonsList.appendChild(li);
        }
      }

      if (btnCompleteStage) {
        if (selectedStageObj.status === 'done') {
          btnCompleteStage.textContent = 'Stage Completed ✓';
          btnCompleteStage.disabled = true;
        } else if (selectedStageObj.status === 'locked') {
          btnCompleteStage.textContent = 'Stage Locked';
          btnCompleteStage.disabled = true;
        } else {
          btnCompleteStage.textContent = `Complete ${capitalize(selectedStageObj.id)}`;
          btnCompleteStage.disabled = false;
        }
      }
    }

    // 3. Update Stage Rail items
    if (state.stages) {
      state.stages.forEach((s) => {
        const item = document.getElementById(`stage-item-${s.id}`);
        if (item) {
          const isSelected = s.id === currentSelectedStage;
          item.className = `stage-item ${s.status}${isSelected ? ' selected' : ''}`;
          const label = item.querySelector('.stage-status-label');
          if (label) {
            label.textContent = s.status;
            label.className = `stage-status-label status-${s.status}`;
          }
        }
      });
    }

    // 4. Switch Stage View Panel (Rule 7, M4, M5, M8)
    if (viewRequirement) viewRequirement.style.display = currentSelectedStage === 'requirement' ? 'flex' : 'none';
    if (viewPlan) viewPlan.style.display = currentSelectedStage === 'plan' ? 'flex' : 'none';
    if (viewDesign) viewDesign.style.display = currentSelectedStage === 'design' ? 'flex' : 'none';
    if (viewBuild) viewBuild.style.display = currentSelectedStage === 'build' ? 'flex' : 'none';
    if (viewTest) viewTest.style.display = currentSelectedStage === 'test' ? 'flex' : 'none';
    if (viewSecurity) viewSecurity.style.display = currentSelectedStage === 'security' ? 'flex' : 'none';
    if (viewRelease) viewRelease.style.display = currentSelectedStage === 'release' ? 'flex' : 'none';
    if (viewDeploy) viewDeploy.style.display = currentSelectedStage === 'deploy' ? 'flex' : 'none';

    // Test stage command & telemetry
    if (testCmdDisplay) {
      testCmdDisplay.textContent = state.config && state.config.testCommand ? state.config.testCommand : '(not configured in .buildtri/config.json)';
    }
    const latestTestRun = (state.runs || []).filter((r) => r.gate === 'test').slice(-1)[0];
    if (testLastRun) {
      if (latestTestRun) {
        testLastRun.textContent = `Last run: exit ${latestTestRun.exit} (${latestTestRun.durationMs}ms) at ${new Date(latestTestRun.startedAt).toLocaleTimeString()}`;
      } else {
        testLastRun.textContent = 'Last run: Never';
      }
    }

    // Security stage command & telemetry
    if (securityCmdDisplay) {
      securityCmdDisplay.textContent = state.config && state.config.lintCommand ? state.config.lintCommand : '(not configured in .buildtri/config.json)';
    }
    const latestSecRun = (state.runs || []).filter((r) => r.gate === 'security').slice(-1)[0];
    if (securityLastRun) {
      if (latestSecRun) {
        securityLastRun.textContent = `Last run: exit ${latestSecRun.exit} (${latestSecRun.durationMs}ms) at ${new Date(latestSecRun.startedAt).toLocaleTimeString()}`;
      } else {
        securityLastRun.textContent = 'Last run: Never';
      }
    }

    // Restore Log Buffers if provided
    if (data.logBuffers) {
      if (data.logBuffers.test && testLogConsole) {
        testLogConsole.innerHTML = '';
        if (data.logBuffers.test.length === 0) {
          testLogConsole.innerHTML = '<div class="log-line info">[Test runner console ready]</div>';
        } else {
          data.logBuffers.test.forEach((line) => appendTerminalLine(testLogConsole, line));
        }
      }
      if (data.logBuffers.security && securityLogConsole) {
        securityLogConsole.innerHTML = '';
        if (data.logBuffers.security.length === 0) {
          securityLogConsole.innerHTML = '<div class="log-line info">[Security lint console ready]</div>';
        } else {
          data.logBuffers.security.forEach((line) => appendTerminalLine(securityLogConsole, line));
        }
      }
      if (data.logBuffers.release && releaseLogConsole) {
        releaseLogConsole.innerHTML = '';
        if (data.logBuffers.release.length === 0) {
          releaseLogConsole.innerHTML = '<div class="log-line info">[Release build console ready]</div>';
        } else {
          data.logBuffers.release.forEach((line) => appendTerminalLine(releaseLogConsole, line));
        }
      }
      if (data.logBuffers.change && changeLogConsole) {
        changeLogConsole.innerHTML = '';
        if (data.logBuffers.change.length > 0) {
          changeLogConsole.style.display = 'block';
          data.logBuffers.change.forEach((line) => appendTerminalLine(changeLogConsole, line));
        }
      }
    }

    // Render Secret Scan Findings
    renderSecretFindings(state.scan);

    // 5. Render Requirements & Changes
    renderRequirements(state.reqs || []);
    renderChangesHeadings(changesHeadings || []);

    // 6. Render Plan Tasks & Checkboxes
    renderTasks(state.tasks || [], state.reqs || []);

    // 7. Render Design Specs & Checkboxes
    renderDesigns(state.designs || [], state.reqs || []);

    // 8. Render Build Stage Tracked Files
    renderBuildFiles(provenance && provenance.files ? provenance.files : []);

    // 8. Render Provenance Files
    if (provenance && provenance.files) {
      if (provenanceCountBadge) {
        provenanceCountBadge.textContent = `${provenance.files.length} files`;
      }
      if (provenanceList) {
        provenanceList.innerHTML = '';
        if (provenance.files.length === 0) {
          provenanceList.innerHTML = '<div class="empty-state-sm">No tracked files in provenance.json.</div>';
        } else {
          provenance.files.forEach((f) => {
            const entry = document.createElement('div');
            entry.className = 'provenance-entry';
            entry.innerHTML = `
              <span>${escapeHtml(f.path)}</span>
              <span class="lane-tag lane-${f.lane}">${f.lane} ${f.reviewed ? '✓' : ''}</span>
            `;
            provenanceList.appendChild(entry);
          });
        }
      }
    }

    // 9. Config summary
    if (configSummary) {
      configSummary.textContent = JSON.stringify(
        state.config || {
          workingDir: '.',
          testCommand: '(not configured)',
          lintCommand: '(not configured)',
          buildCommand: '(not configured)'
        },
        null,
        2
      );
    }

    // 10. AI Assistant Drawer state (M7 fix: no hardcoded default model name)
    if (aiKeyBadge) {
      if (data.aiKeySet) {
        aiKeyBadge.textContent = 'Key: set';
        aiKeyBadge.className = 'badge badge-pass';
      } else {
        aiKeyBadge.textContent = 'Key: not set';
        aiKeyBadge.className = 'badge badge-locked';
      }
    }

    currentAiModel = (data.aiModel || '').trim();
    if (aiModelBadge) {
      if (currentAiModel.length > 0) {
        aiModelBadge.textContent = `Model: ${currentAiModel}`;
        aiModelBadge.className = 'badge badge-active';
      } else {
        aiModelBadge.textContent = 'Set aiModel in config.json';
        aiModelBadge.className = 'badge badge-locked';
      }
    }
    updateAiSendButtonState();

    renderAiReqCheckboxes(state.reqs || []);

    // 11. Release stage command, telemetry & release notes (M8)
    if (releaseCmdDisplay) {
      releaseCmdDisplay.textContent = state.config && state.config.buildCommand ? state.config.buildCommand : '(not configured in .buildtri/config.json)';
    }
    const latestReleaseRun = (state.runs || []).filter((r) => r.gate === 'release').slice(-1)[0];
    if (releaseLastRun) {
      if (latestReleaseRun) {
        releaseLastRun.textContent = `Last run: exit ${latestReleaseRun.exit} (${latestReleaseRun.durationMs}ms) at ${new Date(latestReleaseRun.startedAt).toLocaleTimeString()}`;
      } else {
        releaseLastRun.textContent = 'Last run: Never';
      }
    }
    renderReleaseNotes(data.releaseNotesHeadings || []);

    // 12. Deploy stage checklist (M8)
    renderDeployChecklist(state.deployChecklist || []);

    // 13. Compare view (M8)
    if (data.compareData) {
      renderCompareView(data.compareData);
    }
  }

  function renderAiReqCheckboxes(reqs) {
    if (!aiReqCheckboxes) return;
    const currentlyChecked = new Set(
      Array.from(document.querySelectorAll('input[name="ai-req-check"]:checked')).map((cb) => cb.value)
    );
    aiReqCheckboxes.innerHTML = '';
    if (!reqs || reqs.length === 0) {
      aiReqCheckboxes.innerHTML = '<span class="empty-state-sm">No requirements defined.</span>';
      return;
    }
    reqs.forEach((r) => {
      const lbl = document.createElement('label');
      lbl.className = 'checkbox-label';
      const isChecked = currentlyChecked.has(r.id);
      lbl.innerHTML = `<input type="checkbox" name="ai-req-check" value="${escapeHtml(r.id)}"${isChecked ? ' checked' : ''}> <strong>${escapeHtml(r.id)}</strong>: ${escapeHtml(r.title)}`;
      aiReqCheckboxes.appendChild(lbl);
    });
  }

  function renderReleaseNotes(headings) {
    if (!releaseNotesList) return;
    releaseNotesList.innerHTML = '';
    if (!headings || headings.length === 0) {
      releaseNotesList.innerHTML = '<div class="empty-state-sm">No releases completed yet.</div>';
      return;
    }
    headings.slice().reverse().forEach((heading) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = heading;
      card.appendChild(titleSpan);
      releaseNotesList.appendChild(card);
    });
  }

  function renderDeployChecklist(checklist) {
    if (!deployChecklistContainer) return;
    deployChecklistContainer.innerHTML = '';

    if (!Array.isArray(checklist) || checklist.length === 0) {
      deployChecklistContainer.innerHTML = '<div class="empty-state-sm">No checklist items defined.</div>';
      return;
    }

    const checkedCount = checklist.filter((item) => item.checked).length;
    if (deployChecklistCount) {
      deployChecklistCount.textContent = `${checkedCount} / ${checklist.length}`;
      deployChecklistCount.className = checkedCount === checklist.length ? 'count-pill badge-pass' : 'count-pill';
    }

    checklist.forEach((item) => {
      const itemEl = document.createElement('label');
      itemEl.className = 'checklist-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!item.checked;
      cb.addEventListener('change', () => {
        vscode.postMessage({
          type: 'deploy:check',
          id: item.id,
          checked: cb.checked
        });
      });

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;

      itemEl.appendChild(cb);
      itemEl.appendChild(labelSpan);
      deployChecklistContainer.appendChild(itemEl);
    });
  }

  function renderCompareView(data) {
    if (!data) return;

    // 1. Files per Lane
    if (compareLanesContainer) {
      compareLanesContainer.innerHTML = '';
      const lanes = data.lanes || [];
      const totalFiles = lanes.reduce((sum, l) => sum + l.fileCount, 0);

      if (totalFiles === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-sm';
        empty.textContent = 'No data yet';
        compareLanesContainer.appendChild(empty);
      } else {
        lanes.forEach((l) => {
          const row = document.createElement('div');
          row.className = 'compare-row';

          const label = document.createElement('span');
          label.className = 'compare-label';
          label.textContent = capitalize(l.lane);

          const barBg = document.createElement('div');
          barBg.className = 'compare-bar-bg';

          const fill = document.createElement('div');
          fill.className = 'compare-bar-fill';
          fill.style.backgroundColor = `var(--lane-${l.lane})`;
          const pct = totalFiles > 0 ? (l.fileCount / totalFiles) * 100 : 0;
          fill.style.width = `${pct}%`;
          barBg.appendChild(fill);

          const val = document.createElement('span');
          val.className = 'compare-value';
          const reqsNote = l.coveredReqIds && l.coveredReqIds.length > 0 ? l.coveredReqIds.join(', ') : 'none';
          val.textContent = `${l.fileCount} files (${l.filesWithReqs} with REQs: ${reqsNote})`;

          row.appendChild(label);
          row.appendChild(barBg);
          row.appendChild(val);
          compareLanesContainer.appendChild(row);
        });
      }
    }

    // 2. Change Flow Outcomes per Lane
    if (compareChangesContainer) {
      compareChangesContainer.innerHTML = '';
      const changes = data.changes || [];
      const totalChanges = changes.reduce((sum, c) => sum + c.pass + c.fail, 0);

      if (totalChanges === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-sm';
        empty.textContent = 'No data yet';
        compareChangesContainer.appendChild(empty);
      } else {
        changes.forEach((c) => {
          const row = document.createElement('div');
          row.className = 'compare-row';

          const label = document.createElement('span');
          label.className = 'compare-label';
          label.textContent = capitalize(c.lane);

          const barBg = document.createElement('div');
          barBg.className = 'compare-bar-bg';

          const totalLane = c.pass + c.fail;
          const passPct = totalLane > 0 ? (c.pass / totalLane) * 100 : 0;
          const failPct = totalLane > 0 ? (c.fail / totalLane) * 100 : 0;

          if (c.pass > 0) {
            const passFill = document.createElement('div');
            passFill.className = 'compare-bar-fill';
            passFill.style.backgroundColor = 'var(--done-color, #2ea043)';
            passFill.style.width = `${passPct}%`;
            barBg.appendChild(passFill);
          }
          if (c.fail > 0) {
            const failFill = document.createElement('div');
            failFill.className = 'compare-bar-fill';
            failFill.style.backgroundColor = 'var(--blocked-color, #f85149)';
            failFill.style.width = `${failPct}%`;
            barBg.appendChild(failFill);
          }

          const val = document.createElement('span');
          val.className = 'compare-value';
          val.textContent = `${c.pass} PASS / ${c.fail} FAIL`;

          row.appendChild(label);
          row.appendChild(barBg);
          row.appendChild(val);
          compareChangesContainer.appendChild(row);
        });
      }
    }

    // 3. Runs per Gate
    if (compareRunsContainer) {
      compareRunsContainer.innerHTML = '';
      const runs = data.runs || [];

      if (runs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-sm';
        empty.textContent = 'No data yet';
        compareRunsContainer.appendChild(empty);
      } else {
        runs.forEach((r) => {
          const row = document.createElement('div');
          row.className = 'compare-row';

          const label = document.createElement('span');
          label.className = 'compare-label';
          label.textContent = capitalize(r.gate);

          const barBg = document.createElement('div');
          barBg.className = 'compare-bar-bg';

          const passPct = r.count > 0 ? (r.passed / r.count) * 100 : 0;
          const failPct = r.count > 0 ? (r.failed / r.count) * 100 : 0;

          if (r.passed > 0) {
            const passFill = document.createElement('div');
            passFill.className = 'compare-bar-fill';
            passFill.style.backgroundColor = 'var(--done-color, #2ea043)';
            passFill.style.width = `${passPct}%`;
            barBg.appendChild(passFill);
          }
          if (r.failed > 0) {
            const failFill = document.createElement('div');
            failFill.className = 'compare-bar-fill';
            failFill.style.backgroundColor = 'var(--blocked-color, #f85149)';
            failFill.style.width = `${failPct}%`;
            barBg.appendChild(failFill);
          }

          const val = document.createElement('span');
          val.className = 'compare-value';
          val.textContent = `${r.count} runs (${r.passed}P/${r.failed}F, avg ${r.avgDurationMs}ms)`;

          row.appendChild(label);
          row.appendChild(barBg);
          row.appendChild(val);
          compareRunsContainer.appendChild(row);
        });
      }
    }

    // 4. Current status of all 8 stages
    if (compareTimelineContainer) {
      compareTimelineContainer.innerHTML = '';
      const timeline = data.timeline || [];

      if (timeline.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-sm';
        empty.textContent = 'No data yet';
        compareTimelineContainer.appendChild(empty);
      } else {
        timeline.forEach((s) => {
          const pill = document.createElement('div');
          pill.className = `badge badge-${s.status}`;
          pill.style.padding = '6px 12px';
          pill.style.fontSize = '12px';
          pill.textContent = `${capitalize(s.id)}: ${s.status}`;
          compareTimelineContainer.appendChild(pill);
        });
      }
    }
  }

  function renderSecretFindings(scan) {
    if (!secretFindingsList) return;
    secretFindingsList.innerHTML = '';

    if (!scan) {
      secretFindingsList.innerHTML = '<div class="empty-state-sm">No secret scan has been run yet. Click "Scan Now" or "Complete Security".</div>';
      return;
    }

    const findings = scan.findings || [];
    if (findings.length === 0) {
      secretFindingsList.innerHTML = `<div class="empty-state-sm" style="color: var(--color-hybrid);">✓ Clean: No secrets found (scanned ${scan.scannedFiles} files at ${new Date(scan.scannedAt).toLocaleTimeString()}).</div>`;
      return;
    }

    findings.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.style.borderLeft = '3px solid var(--color-blocked)';
      card.innerHTML = `
        <div class="item-card-header">
          <span><code>${escapeHtml(f.path)}:${f.line}</code></span>
          <span class="badge badge-blocked">${escapeHtml(f.rule)}</span>
        </div>
        <div class="item-card-details">
          <small>Potential secret detected matching rule: <strong>${escapeHtml(f.rule)}</strong></small>
        </div>
      `;
      secretFindingsList.appendChild(card);
    });
  }

  function renderRequirements(reqs) {
    if (reqCountBadge) reqCountBadge.textContent = `${reqs.length}`;
    if (!reqList) return;

    reqList.innerHTML = '';
    if (reqs.length === 0) {
      reqList.innerHTML = '<div class="empty-state">No requirements defined yet. Use the form below to add one.</div>';
      renderChangePanel(null);
      renderOrphanTags([]);
      return;
    }

    // Identify if any requirement has status 'changed'
    const changedReq = reqs.find((r) => r.status === 'changed');
    activeChangedReqId = changedReq ? changedReq.id : null;
    renderChangePanel(changedReq);

    // Render orphan tags
    renderOrphanTags(cachedImpact.orphans || []);

    reqs.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      if (r.status === 'changed') {
        card.style.borderLeft = '3px solid var(--lane-vibe)';
      }

      const criteriaCount = Array.isArray(r.criteria) ? r.criteria.length : 0;
      const statusBadge =
        r.status === 'changed'
          ? '<span class="badge badge-changed">changed</span>'
          : '<span class="badge badge-open">open</span>';

      const isExpanded = expandedImpactReqs.has(r.id);
      const reqImpact = cachedImpact.byReq ? cachedImpact.byReq[r.id] : null;

      const fileCount = reqImpact && reqImpact.files ? reqImpact.files.length : 0;
      const testCount = reqImpact && reqImpact.tests ? reqImpact.tests.length : 0;

      let impactDetailsHtml = '';
      if (isExpanded) {
        const filesListHtml =
          fileCount > 0
            ? reqImpact.files.map((f) => `<li><code>${escapeHtml(f.path)}</code>: lines ${f.lines.join(', ')}</li>`).join('')
            : '<em>None</em>';
        const testsListHtml =
          testCount > 0
            ? reqImpact.tests.map((t) => `<li><code>${escapeHtml(t.path)}</code>: lines ${t.lines.join(', ')}</li>`).join('')
            : '<em>None tagged</em>';

        impactDetailsHtml = `
          <div class="impact-details-box">
            <div><strong>Tagged Code Files (${fileCount}):</strong></div>
            <ul style="margin: 4px 0 8px 16px;">${filesListHtml}</ul>
            <div><strong>Tagged Tests (${testCount}):</strong></div>
            <ul style="margin: 4px 0 0 16px;">${testsListHtml}</ul>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="item-card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span><strong>${escapeHtml(r.id)}</strong>: ${escapeHtml(r.title)}</span>
            ${statusBadge}
          </div>
          <div class="item-actions">
            <span class="count-pill">${criteriaCount} criteria</span>
            <button class="btn btn-secondary btn-sm req-impact-btn">${isExpanded ? 'Hide Impact' : `Impact (${fileCount}f/${testCount}t)`}</button>
            <button class="btn btn-secondary btn-sm edit-req-btn">Edit</button>
            <button class="btn btn-danger btn-sm del-req-btn">Delete</button>
          </div>
        </div>
        <div class="item-card-details">
          ${criteriaCount > 0 ? `<ul>${r.criteria.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : '<em>(No acceptance criteria)</em>'}
          ${impactDetailsHtml}
        </div>
      `;

      card.querySelector('.req-impact-btn').addEventListener('click', () => {
        if (expandedImpactReqs.has(r.id)) {
          expandedImpactReqs.delete(r.id);
        } else {
          expandedImpactReqs.add(r.id);
        }
        renderRequirements(reqs);
      });

      card.querySelector('.edit-req-btn').addEventListener('click', () => {
        reqFormId.value = r.id;
        reqFormMode.textContent = `Edit Requirement ${r.id}`;
        reqTitleInput.value = r.title;
        reqCriteriaInput.value = Array.isArray(r.criteria) ? r.criteria.join('\n') : '';
        btnReqSave.textContent = 'Update Requirement';
      });

      card.querySelector('.del-req-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'req:delete', id: r.id });
      });

      reqList.appendChild(card);
    });
  }

  function renderChangePanel(changedReq) {
    if (!changePanel) return;

    if (!changedReq) {
      changePanel.style.display = 'none';
      return;
    }

    changePanel.style.display = 'flex';
    if (changeReqId) changeReqId.textContent = changedReq.id;
    if (changeReqFields) {
      const fields = changedReq.change && Array.isArray(changedReq.change.fields) && changedReq.change.fields.length > 0
        ? changedReq.change.fields.join(', ')
        : 'title, criteria';
      changeReqFields.textContent = fields;
    }

    const reqImpact = cachedImpact.byReq ? cachedImpact.byReq[changedReq.id] : null;
    if (changeReqFiles) {
      if (reqImpact && reqImpact.files.length > 0) {
        changeReqFiles.textContent = reqImpact.files.map((f) => f.path).join(', ');
      } else {
        changeReqFiles.textContent = 'none';
      }
    }
    if (changeReqTests) {
      if (reqImpact && reqImpact.tests.length > 0) {
        changeReqTests.textContent = reqImpact.tests.map((t) => t.path).join(', ');
      } else {
        changeReqTests.innerHTML = '<span style="color: var(--lane-vibe); font-weight: bold;">none tagged (warning)</span>';
      }
    }
  }

  function renderOrphanTags(orphans) {
    if (!orphanTagsSection || !orphanTagsList) return;

    if (!orphans || orphans.length === 0) {
      orphanTagsSection.style.display = 'none';
      orphanTagsList.innerHTML = '';
      return;
    }

    orphanTagsSection.style.display = 'block';
    orphanTagsList.innerHTML = '';

    orphans.forEach((o) => {
      const item = document.createElement('div');
      item.className = 'item-card';
      item.style.borderLeft = '3px solid var(--blocked-color)';
      item.innerHTML = `
        <div class="item-card-header">
          <span><strong>${escapeHtml(o.tag)}</strong> in <code>${escapeHtml(o.path)}:${o.line}</code></span>
          <span class="badge badge-blocked">orphan tag</span>
        </div>
      `;
      orphanTagsList.appendChild(item);
    });
  }

  function renderChangesHeadings(headings) {
    if (!changesHeadingsList) return;
    changesHeadingsList.innerHTML = '';

    if (!headings || headings.length === 0) {
      changesHeadingsList.innerHTML = '<div class="empty-state-sm">No changes recorded in changes.md yet.</div>';
      return;
    }

    // Show last 10 in reverse chronological order
    const reversed = [...headings].reverse();
    reversed.forEach((h) => {
      const item = document.createElement('div');
      item.className = 'item-card';
      item.innerHTML = `<div><strong>${escapeHtml(h)}</strong></div>`;
      changesHeadingsList.appendChild(item);
    });
  }

  function resetReqForm() {
    if (reqFormId) reqFormId.value = '';
    if (reqFormMode) reqFormMode.textContent = 'Create New Requirement';
    if (reqTitleInput) reqTitleInput.value = '';
    if (reqCriteriaInput) reqCriteriaInput.value = '';
    if (btnReqSave) btnReqSave.textContent = 'Save Requirement';
  }

  function renderTasks(tasks, reqs) {
    if (taskCountBadge) taskCountBadge.textContent = `${tasks.length}`;
    if (taskReqCheckboxes) {
      taskReqCheckboxes.innerHTML = '';
      if (reqs.length === 0) {
        taskReqCheckboxes.innerHTML = '<span class="empty-state-sm">No requirements defined yet to link.</span>';
      } else {
        reqs.forEach((r) => {
          const lbl = document.createElement('label');
          lbl.className = 'checkbox-label';
          lbl.innerHTML = `<input type="checkbox" name="task-req-check" value="${escapeHtml(r.id)}"> <strong>${escapeHtml(r.id)}</strong>: ${escapeHtml(r.title)}`;
          taskReqCheckboxes.appendChild(lbl);
        });
      }
    }

    if (!taskList) return;
    taskList.innerHTML = '';
    if (tasks.length === 0) {
      taskList.innerHTML = '<div class="empty-state">No tasks created yet. Use the form below to add one.</div>';
      return;
    }

    tasks.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const linkedReqs = Array.isArray(t.reqIds) ? t.reqIds.join(', ') : 'None';
      card.innerHTML = `
        <div class="item-card-header">
          <span><strong>${escapeHtml(t.id)}</strong>: ${escapeHtml(t.title)}</span>
          <div class="item-actions">
            <button class="btn btn-secondary btn-sm edit-task-btn">Edit</button>
            <button class="btn btn-danger btn-sm del-task-btn">Delete</button>
          </div>
        </div>
        <div class="item-card-details">
          <small>Linked Requirements: <strong>${escapeHtml(linkedReqs)}</strong></small>
        </div>
      `;

      card.querySelector('.edit-task-btn').addEventListener('click', () => {
        taskFormId.value = t.id;
        taskFormMode.textContent = `Edit Task ${t.id}`;
        taskTitleInput.value = t.title;
        btnTaskSave.textContent = 'Update Task';

        // Check the boxes
        const cbs = document.querySelectorAll('input[name="task-req-check"]');
        cbs.forEach((cb) => {
          cb.checked = Array.isArray(t.reqIds) && t.reqIds.includes(cb.value);
        });
      });

      card.querySelector('.del-task-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'task:delete', id: t.id });
      });

      taskList.appendChild(card);
    });
  }

  function resetTaskForm() {
    if (taskFormId) taskFormId.value = '';
    if (taskFormMode) taskFormMode.textContent = 'Create New Task';
    if (taskTitleInput) taskTitleInput.value = '';
    if (btnTaskSave) btnTaskSave.textContent = 'Save Task';
    const cbs = document.querySelectorAll('input[name="task-req-check"]');
    cbs.forEach((cb) => (cb.checked = false));
  }

  function renderDesigns(designs, reqs) {
    if (designCountBadge) designCountBadge.textContent = `${designs.length}`;
    if (designReqCheckboxes) {
      designReqCheckboxes.innerHTML = '';
      if (reqs.length === 0) {
        designReqCheckboxes.innerHTML = '<span class="empty-state-sm">No requirements defined yet to link.</span>';
      } else {
        reqs.forEach((r) => {
          const lbl = document.createElement('label');
          lbl.className = 'checkbox-label';
          lbl.innerHTML = `<input type="checkbox" name="design-req-check" value="${escapeHtml(r.id)}"> <strong>${escapeHtml(r.id)}</strong>: ${escapeHtml(r.title)}`;
          designReqCheckboxes.appendChild(lbl);
        });
      }
    }

    if (!designList) return;
    designList.innerHTML = '';
    if (designs.length === 0) {
      designList.innerHTML = '<div class="empty-state">No design specs registered. Use the form below to add one.</div>';
      return;
    }

    designs.forEach((d) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const linkedReqs = Array.isArray(d.reqIds) ? d.reqIds.join(', ') : 'None';
      card.innerHTML = `
        <div class="item-card-header">
          <span><strong>${escapeHtml(d.id)}</strong>: ${escapeHtml(d.title)}</span>
          <div class="item-actions">
            <button class="btn btn-secondary btn-sm edit-design-btn">Edit</button>
            <button class="btn btn-danger btn-sm del-design-btn">Delete</button>
          </div>
        </div>
        <div class="item-card-details">
          <div><small>Doc Path: <code>${escapeHtml(d.path || '(no path)')}</code></small></div>
          <div><small>Linked Requirements: <strong>${escapeHtml(linkedReqs)}</strong></small></div>
        </div>
      `;

      card.querySelector('.edit-design-btn').addEventListener('click', () => {
        designFormId.value = d.id;
        designFormMode.textContent = `Edit Design ${d.id}`;
        designTitleInput.value = d.title;
        designPathInput.value = d.path || '';
        btnDesignSave.textContent = 'Update Design';

        // Check the boxes
        const cbs = document.querySelectorAll('input[name="design-req-check"]');
        cbs.forEach((cb) => {
          cb.checked = Array.isArray(d.reqIds) && d.reqIds.includes(cb.value);
        });
      });

      card.querySelector('.del-design-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'design:delete', id: d.id });
      });

      designList.appendChild(card);
    });
  }

  function renderBuildFiles(files) {
    if (buildFilesCountBadge) buildFilesCountBadge.textContent = `${files.length} files`;
    if (!buildFilesList) return;

    buildFilesList.innerHTML = '';
    if (files.length === 0) {
      buildFilesList.innerHTML = '<div class="empty-state">No tracked files in provenance.json. Files without an entry are Manual by default.</div>';
      return;
    }

    files.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const missingBadge = f.missing
        ? '<span class="missing-tag">(missing)</span>'
        : '';

      const isVibe = f.lane === 'vibe';
      const approveBtn = isVibe
        ? `<button class="btn btn-secondary btn-sm approve-lane-btn" data-path="${escapeHtml(f.path)}">Approve as Hybrid</button>`
        : '';

      card.innerHTML = `
        <div class="item-card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span><code>${escapeHtml(f.path)}</code></span>
            ${missingBadge}
            <span class="lane-tag lane-${f.lane}">${f.lane}</span>
          </div>
          <div class="item-actions">
            ${approveBtn}
            <button class="btn btn-danger btn-sm remove-lane-btn" data-path="${escapeHtml(f.path)}">Remove</button>
          </div>
        </div>
        <div class="item-card-details">
          <small>Reviewed: <strong>${f.reviewed ? 'Yes' : 'No'}</strong> | Linked REQs: <strong>${(f.reqIds && f.reqIds.length > 0) ? escapeHtml(f.reqIds.join(', ')) : 'None'}</strong></small>
        </div>
      `;

      if (isVibe) {
        const btn = card.querySelector('.approve-lane-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'lane:set', path: f.path, lane: 'hybrid' });
          });
        }
      }

      const delBtn = card.querySelector('.remove-lane-btn');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'lane:remove', path: f.path });
        });
      }

      buildFilesList.appendChild(card);
    });
  }

  function resetDesignForm() {
    if (designFormId) designFormId.value = '';
    if (designFormMode) designFormMode.textContent = 'Create New Design Spec';
    if (designTitleInput) designTitleInput.value = '';
    if (designPathInput) designPathInput.value = '';
    if (btnDesignSave) btnDesignSave.textContent = 'Save Design';
    const cbs = document.querySelectorAll('input[name="design-req-check"]');
    cbs.forEach((cb) => (cb.checked = false));
  }

  function appendLog(line, level = 'info') {
    if (!runConsole) return;
    const el = document.createElement('div');
    el.className = `log-line ${level}`;
    el.textContent = `[${new Date().toLocaleTimeString()}] ${line}`;
    runConsole.appendChild(el);
    runConsole.scrollTop = runConsole.scrollHeight;
  }

  function showToast(text, level = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${level}`;
    toast.textContent = text;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
