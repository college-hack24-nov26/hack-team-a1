import * as path from 'path';
import * as fs from 'fs';
import { BuildtriState, Provenance, StageFileStatus } from './types';

/**
 * Returns a markdown checklist of all current requirements in state.
 */
export function buildReqChecklist(state?: BuildtriState): string {
  if (!state || !Array.isArray(state.reqs) || state.reqs.length === 0) {
    return '- (No requirements defined yet)';
  }
  return state.reqs.map((r) => `- [ ] ${r.id}: ${r.title}`).join('\n');
}

/**
 * Generates the standardized markdown template for a given stage file.
 * Templates live in ONE place and include the existing REQs as a checklist.
 */
export function getTemplateForFile(relPath: string, state?: BuildtriState): string {
  const normalized = relPath.replace(/\\/g, '/');
  const reqChecklist = buildReqChecklist(state);

  switch (normalized) {
    case 'docs/USER_REQUIREMENT.md':
      return `# User Requirements

## 1. Overview
Describe the high-level user needs, business objectives, and project goals.

## 2. Requirements Checklist
${reqChecklist}

## 3. Scope & Constraints
Define what is in scope and any key technical or business boundaries.
`;

    case 'docs/PRD.md':
      return `# Product Requirements Document (PRD)

## 1. Product Summary & Goals
Summarize the product vision, target audience, and key deliverables.

## 2. Requirements Traceability
${reqChecklist}

## 3. User Flows & Functional Specifications
Detail the end-to-end user journeys and specific functional requirements.
`;

    case 'docs/TRD.md':
      return `# Technical Requirements Document (TRD)

## 1. Architecture Overview
Outline system components, service boundaries, and data architecture.

## 2. Requirements Addressed
${reqChecklist}

## 3. Technology Stack & Dependencies
Specify programming languages, frameworks, libraries, and deployment runtime.
`;

    case 'docs/DESIGN.md':
      return `# System Design & Architecture

## 1. Component Design & Interfaces
Describe interface boundaries, data models, and API contracts.

## 2. Requirements Coverage
${reqChecklist}

## 3. Security, Performance & Scalability
Identify performance targets, caching strategies, and security controls.
`;

    case 'docs/TEST_PLAN.md':
      return `# Test Plan

## 1. Testing Strategy
Define scope for unit testing, integration testing, and regression suites.

## 2. Requirements Verification
${reqChecklist}

## 3. Acceptance Criteria & Pass/Fail Metrics
Outline execution criteria and quality gates for release readiness.
`;

    case 'docs/SECURITY.md':
      return `# Security Assessment

## 1. Threat Modeling
Identify potential attack surfaces, trust boundaries, and data classifications.

## 2. Security Requirements Checklist
${reqChecklist}

## 3. Secrets & Sensitive Data Handling
Guidelines for credential isolation, encryption at rest, and in transit.
`;

    case '.buildtri/release-notes.md':
      return `# Release Notes

This file is automatically updated upon completing the Release stage.
`;

    default: {
      const fileName = path.basename(normalized);
      return `# ${fileName}

## Requirements Checklist
${reqChecklist}

## Overview
Document content for ${fileName}.
`;
    }
  }
}

/**
 * Normalizes content by trimming whitespace, standardizing line endings (\r\n -> \n),
 * and trimming trailing whitespace from each line.
 */
export function normalizeContent(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Checks whether the actual content equals the template content (normalized).
 */
export function isTemplateContent(actual: string, template: string): boolean {
  const normActual = normalizeContent(actual);
  const normTemplate = normalizeContent(template);
  if (!normActual || !normTemplate) {
    return false;
  }
  return normActual === normTemplate;
}

/**
 * Computes the live stage file status from disk and provenance.
 * Status rules:
 * - 'missing': file does not exist on disk
 * - 'ai-draft': file tracked in provenance with lane: 'vibe' and reviewed: false
 * - 'reviewed': file tracked in provenance with lane: 'hybrid' or 'manual'
 * - 'template': file exists, differs from empty, but normalized content equals template
 * - 'filled': differs from template and is not empty
 */
export function computeFileStatus(
  relPath: string,
  workspaceRoot: string,
  provenance?: Provenance,
  state?: BuildtriState
): StageFileStatus {
  const normalized = relPath.replace(/\\/g, '/');
  const absPath = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);

  if (!fs.existsSync(absPath)) {
    return 'missing';
  }

  // Check provenance tracking first
  if (provenance && Array.isArray(provenance.files)) {
    const provEntry = provenance.files.find((f) => f.path === normalized);
    if (provEntry) {
      if (provEntry.lane === 'vibe' && !provEntry.reviewed) {
        return 'ai-draft';
      }
      if (provEntry.lane === 'hybrid' || provEntry.lane === 'manual') {
        return 'reviewed';
      }
    }
  }

  try {
    const content = fs.readFileSync(absPath, 'utf8');
    if (!content || content.trim().length === 0) {
      return 'missing';
    }

    const template = getTemplateForFile(normalized, state);
    if (isTemplateContent(content, template)) {
      return 'template';
    }

    return 'filled';
  } catch {
    return 'missing';
  }
}

/**
 * Stage purpose descriptions used when building AI drafting prompts.
 */
export function getStagePurposeDescription(stageId: string, filePath: string): string {
  const fileName = path.basename(filePath);
  switch (stageId) {
    case 'requirement':
      return `Draft a comprehensive User Requirements document (${fileName}) detailing the user needs, business goals, and acceptance criteria.`;
    case 'plan':
      if (fileName.includes('TRD')) {
        return `Draft a Technical Requirements Document (${fileName}) detailing architecture, system components, tech stack, and execution phases.`;
      }
      return `Draft a Product Requirements Document (${fileName}) detailing scope, user flows, functional requirements, and traceability.`;
    case 'design':
      return `Draft a System Design & Architecture document (${fileName}) covering component diagrams, API contracts, data models, and flow controls.`;
    case 'test':
      return `Draft a Test Plan document (${fileName}) covering unit tests, integration tests, mock strategies, and acceptance criteria.`;
    case 'security':
      return `Draft a Security Assessment document (${fileName}) covering threat modeling, vulnerability mitigation, and secret protection.`;
    default:
      return `Draft document (${fileName}) for stage '${stageId}'.`;
  }
}
