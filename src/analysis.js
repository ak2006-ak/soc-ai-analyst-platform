const RULES = [
  {
    pattern: /(ransomware|encrypt(ed|ion)? files|mass file rename)/i,
    severity: 'critical',
    tactic: 'Impact',
    recommendation: 'Isolate impacted assets and disable affected user sessions immediately.'
  },
  {
    pattern: /(powershell\s+-enc|invoke-expression|encodedcommand)/i,
    severity: 'high',
    tactic: 'Execution',
    recommendation: 'Review parent process chain and block encoded PowerShell execution policies.'
  },
  {
    pattern: /(failed login|authentication failure|brute force|invalid password)/i,
    severity: 'medium',
    tactic: 'Credential Access',
    recommendation: 'Enforce MFA and temporary lockout for affected identities.'
  },
  {
    pattern: /(suspicious dns|data exfiltration|large outbound|c2|command and control)/i,
    severity: 'high',
    tactic: 'Command and Control',
    recommendation: 'Block destination domains/IPs and inspect outbound proxy/firewall logs.'
  },
  {
    pattern: /(malware|trojan|backdoor|dropper)/i,
    severity: 'high',
    tactic: 'Persistence',
    recommendation: 'Collect host forensic artifacts and run endpoint malware remediation workflow.'
  }
];

const SEVERITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

function pickHigherSeverity(current, candidate) {
  if (!candidate) {
    return current;
  }

  return SEVERITY_ORDER[candidate] > SEVERITY_ORDER[current] ? candidate : current;
}

function generateAnalysis({ title = '', description = '', rawLog = '' }) {
  const text = [title, description, rawLog].filter(Boolean).join(' \n').slice(0, 10000);
  let severity = 'low';
  const matchedTactics = [];
  const recommendations = [];

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      severity = pickHigherSeverity(severity, rule.severity);
      matchedTactics.push(rule.tactic);
      recommendations.push(rule.recommendation);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Gather additional telemetry (EDR, DNS, authentication, and process tree) before closure.');
    recommendations.push('Escalate for Tier-2 review if suspicious behavior persists across multiple hosts.');
  }

  const uniqueTactics = [...new Set(matchedTactics)];
  const confidence = uniqueTactics.length > 0 ? Math.min(95, 55 + uniqueTactics.length * 15) : 50;

  return {
    summary:
      uniqueTactics.length > 0
        ? `Potential ${severity.toUpperCase()} risk aligned to ${uniqueTactics.join(', ')} tactics. Automated triage detected suspicious patterns requiring analyst validation.`
        : 'No high-confidence malicious indicators were detected from provided context. Analyst validation still recommended.',
    recommendations: [...new Set(recommendations)],
    suggestedSeverity: severity,
    confidence,
    mappedTactics: uniqueTactics
  };
}

module.exports = {
  generateAnalysis
};
