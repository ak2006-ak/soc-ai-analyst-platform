const fs = require('node:fs');
const path = require('node:path');

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_STATUSES = new Set(['new', 'triaged', 'in_progress', 'resolved']);

function isoNow() {
  return new Date().toISOString();
}

function seedData() {
  const createdAt = isoNow();

  return {
    users: [
      { id: 'u-001', name: 'Alex Chen', role: 'Tier-1 Analyst' },
      { id: 'u-002', name: 'Jordan Patel', role: 'Tier-2 Analyst' },
      { id: 'u-003', name: 'Morgan Smith', role: 'Incident Commander' }
    ],
    alerts: [
      {
        id: 'ALT-1001',
        title: 'Suspicious encoded PowerShell execution',
        description: 'EDR detected powershell.exe -enc execution on endpoint WIN-CLIENT-07.',
        source: 'EDR',
        severity: 'high',
        status: 'in_progress',
        assignee: 'u-001',
        createdAt,
        updatedAt: createdAt,
        rawLog: 'powershell.exe -enc JABzAHM... Parent: winword.exe',
        tags: ['powershell', 'endpoint'],
        aiSummary: null,
        aiConfidence: null,
        aiRecommendations: [],
        timeline: [
          {
            id: 'evt-1',
            type: 'status',
            author: 'System',
            message: 'Alert ingested from EDR connector.',
            timestamp: createdAt
          }
        ]
      },
      {
        id: 'ALT-1002',
        title: 'Multiple failed VPN logins for privileged account',
        description: 'Firewall and identity provider reported 18 failed logins within 10 minutes.',
        source: 'Identity',
        severity: 'medium',
        status: 'new',
        assignee: null,
        createdAt,
        updatedAt: createdAt,
        rawLog: 'authentication failure user=admin from=185.21.66.9 attempts=18',
        tags: ['identity', 'vpn'],
        aiSummary: null,
        aiConfidence: null,
        aiRecommendations: [],
        timeline: [
          {
            id: 'evt-2',
            type: 'status',
            author: 'System',
            message: 'Alert queued for triage.',
            timestamp: createdAt
          }
        ]
      }
    ]
  };
}

class Store {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'store.json');
    this._ensureStore();
  }

  _ensureStore() {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      this._write(seedData());
      return;
    }

    try {
      const current = this._read();
      if (!Array.isArray(current.users) || !Array.isArray(current.alerts)) {
        throw new Error('Invalid store schema');
      }
    } catch (_error) {
      this._write(seedData());
    }
  }

  _read() {
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
  }

  _write(content) {
    fs.writeFileSync(this.filePath, JSON.stringify(content, null, 2));
  }

  listUsers() {
    return this._read().users;
  }

  getMetrics() {
    const { alerts } = this._read();

    const total = alerts.length;
    const open = alerts.filter((alert) => alert.status !== 'resolved').length;
    const critical = alerts.filter((alert) => alert.severity === 'critical').length;
    const unassigned = alerts.filter((alert) => !alert.assignee).length;

    return { total, open, critical, unassigned };
  }

  listAlerts(filters = {}) {
    const { alerts } = this._read();

    let results = [...alerts];

    const searchTerm = (filters.search || '').trim().toLowerCase();
    if (searchTerm) {
      results = results.filter((alert) => {
        const target = [alert.id, alert.title, alert.description, alert.source, ...(alert.tags || [])]
          .join(' ')
          .toLowerCase();
        return target.includes(searchTerm);
      });
    }

    if (filters.status && VALID_STATUSES.has(filters.status)) {
      results = results.filter((alert) => alert.status === filters.status);
    }

    if (filters.severity && VALID_SEVERITIES.has(filters.severity)) {
      results = results.filter((alert) => alert.severity === filters.severity);
    }

    if (filters.assignee) {
      results = results.filter((alert) => alert.assignee === filters.assignee);
    }

    const sortBy = filters.sortBy || 'updatedAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

    results.sort((left, right) => {
      const leftValue = left[sortBy] ?? '';
      const rightValue = right[sortBy] ?? '';

      if (leftValue < rightValue) {
        return -1 * sortOrder;
      }
      if (leftValue > rightValue) {
        return 1 * sortOrder;
      }
      return 0;
    });

    return results;
  }

  getAlert(id) {
    return this._read().alerts.find((alert) => alert.id === id) || null;
  }

  createAlert({ title, description, source, severity, rawLog, tags }, actor = 'System') {
    if (!title || !source || !severity) {
      throw new Error('title, source and severity are required');
    }

    if (!VALID_SEVERITIES.has(severity)) {
      throw new Error('Invalid severity value');
    }

    const data = this._read();
    const id = `ALT-${1000 + data.alerts.length + 1}`;
    const timestamp = isoNow();

    const alert = {
      id,
      title: title.trim(),
      description: (description || '').trim(),
      source: source.trim(),
      severity,
      status: 'new',
      assignee: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      rawLog: rawLog || '',
      tags: Array.isArray(tags)
        ? tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
        : [],
      aiSummary: null,
      aiConfidence: null,
      aiRecommendations: [],
      timeline: [
        {
          id: `evt-${Date.now()}`,
          type: 'status',
          author: actor,
          message: 'Alert created and queued for triage.',
          timestamp
        }
      ]
    };

    data.alerts.push(alert);
    this._write(data);

    return alert;
  }

  updateAlert(id, updates, actor = 'System') {
    const data = this._read();
    const alert = data.alerts.find((item) => item.id === id);

    if (!alert) {
      return null;
    }

    const timestamp = isoNow();

    if (updates.status) {
      if (!VALID_STATUSES.has(updates.status)) {
        throw new Error('Invalid status value');
      }
      alert.status = updates.status;
      alert.timeline.push({
        id: `evt-${Date.now()}-status`,
        type: 'status',
        author: actor,
        message: `Status updated to ${updates.status}.`,
        timestamp
      });
    }

    if (updates.severity) {
      if (!VALID_SEVERITIES.has(updates.severity)) {
        throw new Error('Invalid severity value');
      }
      alert.severity = updates.severity;
      alert.timeline.push({
        id: `evt-${Date.now()}-severity`,
        type: 'severity',
        author: actor,
        message: `Severity updated to ${updates.severity}.`,
        timestamp
      });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'assignee')) {
      alert.assignee = updates.assignee || null;
      alert.timeline.push({
        id: `evt-${Date.now()}-assignee`,
        type: 'assignment',
        author: actor,
        message: updates.assignee ? `Assigned to ${updates.assignee}.` : 'Alert unassigned.',
        timestamp
      });
    }

    alert.updatedAt = timestamp;
    this._write(data);

    return alert;
  }

  addNote(id, { author, message }) {
    const data = this._read();
    const alert = data.alerts.find((item) => item.id === id);

    if (!alert) {
      return null;
    }

    if (!message || !message.trim()) {
      throw new Error('Note message is required');
    }

    const timestamp = isoNow();

    alert.timeline.push({
      id: `evt-${Date.now()}-note`,
      type: 'note',
      author: author || 'Analyst',
      message: message.trim(),
      timestamp
    });

    alert.updatedAt = timestamp;
    this._write(data);

    return alert;
  }

  saveAnalysis(id, analysis, actor = 'SentinelAI') {
    const data = this._read();
    const alert = data.alerts.find((item) => item.id === id);

    if (!alert) {
      return null;
    }

    const timestamp = isoNow();

    alert.aiSummary = analysis.summary;
    alert.aiConfidence = analysis.confidence;
    alert.aiRecommendations = analysis.recommendations;
    alert.severity = analysis.suggestedSeverity || alert.severity;
    alert.updatedAt = timestamp;

    alert.timeline.push({
      id: `evt-${Date.now()}-analysis`,
      type: 'analysis',
      author: actor,
      message: `AI analysis completed with confidence ${analysis.confidence}%.`,
      timestamp
    });

    this._write(data);
    return alert;
  }
}

module.exports = {
  Store,
  VALID_SEVERITIES,
  VALID_STATUSES
};
