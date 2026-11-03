export interface TextSecretFinding {
  line: number;
  rule: string;
}

/**
 * PURE FUNCTION: Scans text for exposed credentials and secrets.
 * Strictly avoids capturing or returning any secret values.
 * Lines containing 'buildtri:allow-secret' are ignored.
 */
export function scanText(text: string): TextSecretFinding[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const findings: TextSecretFinding[] = [];
  const lines = text.split(/\r?\n/);

  // Exact regexes from spec
  const pemRegex = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
  const awsRegex = /AKIA[0-9A-Z]{16}/;
  const googleRegex = /AIza[0-9A-Za-z\-_]{35}/;
  const githubRegex = /(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}/;
  const genericRegex = /(password|secret|token|api_key|apikey)\s*[:=]\s*['"][A-Za-z0-9+/=_\.-]{16,}['"]/i;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const lineNumber = i + 1; // 1-based

    // Ignore lines explicitly exempted by the user
    if (lineText.includes('buildtri:allow-secret')) {
      continue;
    }

    // Rule 1: PEM Private Key
    if (pemRegex.test(lineText)) {
      findings.push({ line: lineNumber, rule: 'PEM private key' });
      continue;
    }

    // Rule 2: AWS Access Key
    if (awsRegex.test(lineText)) {
      findings.push({ line: lineNumber, rule: 'AWS access key' });
      continue;
    }

    // Rule 3: Google API Key
    if (googleRegex.test(lineText)) {
      findings.push({ line: lineNumber, rule: 'Google API key' });
      continue;
    }

    // Rule 4: GitHub Token
    if (githubRegex.test(lineText)) {
      findings.push({ line: lineNumber, rule: 'GitHub token' });
      continue;
    }

    // Rule 5: Generic Secret Assignment
    if (genericRegex.test(lineText)) {
      findings.push({ line: lineNumber, rule: 'Generic secret assignment' });
      continue;
    }
  }

  return findings;
}
