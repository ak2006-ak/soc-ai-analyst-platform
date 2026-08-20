const state = {
  users: [],
  alerts: [],
  selectedAlertId: null,
  view: 'dashboard',
  filters: {
    search: '',
    status: '',
    severity: '',
    sortBy: 'updatedAt'
  }
};

const pageDescriptions = {
  dashboard: 'Operational overview and current risk posture.',
  alerts: 'Ingest and triage SOC alerts and cases.',
  investigation: 'Deep-dive investigation and timeline management.',
  settings: 'Analyst context and platform preferences.'
};

const metricsGrid = document.getElementById('metricsGrid');
const feedbackElement = document.getElementById('feedback');
const apiStatus = document.getElementById('apiStatus');
const pageDescription = document.getElementById('pageDescription');
const activeAnalyst = document.getElementById('activeAnalyst');

function getCurrentUserId() {
  return localStorage.getItem('soc.activeUser') || '';
}

function setCurrentUserId(userId) {
  localStorage.setItem('soc.activeUser', userId);
}

function currentUser() {
  return state.users.find((user) => user.id === getCurrentUserId()) || state.users[0] || null;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function showFeedback(type, message) {
  feedbackElement.hidden = false;
  feedbackElement.className = `feedback ${type}`;
  feedbackElement.textContent = message;
}

function clearFeedback() {
  feedbackElement.hidden = true;
  feedbackElement.textContent = '';
}

function severityBadge(severity) {
  return `<span class="badge ${severity}">${severity.replace('_', ' ')}</span>`;
}

function statusBadge(status) {
  return `<span class="badge status">${status.replace('_', ' ')}</span>`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function goToView(viewName) {
  state.view = viewName;
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  pageDescription.textContent = pageDescriptions[viewName] || '';
}

function setApiStatus(connected) {
  apiStatus.textContent = connected ? 'API connected' : 'API unavailable';
  apiStatus.classList.toggle('down', !connected);
}

function renderMetrics(metrics) {
  const cards = [
    { label: 'Total Alerts', value: metrics.total, icon: 'fa-list' },
    { label: 'Open Alerts', value: metrics.open, icon: 'fa-unlock' },
    { label: 'Critical', value: metrics.critical, icon: 'fa-skull-crossbones' },
    { label: 'Unassigned', value: metrics.unassigned, icon: 'fa-user-clock' }
  ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
      <article class="metric-card">
        <i class="fa-solid ${card.icon}" aria-hidden="true"></i>
        <div>
          <p>${card.label}</p>
          <h3>${card.value}</h3>
        </div>
      </article>`
    )
    .join('');
}

function renderRecentAlerts() {
  const stateElement = document.getElementById('recentAlertsState');
  const tableWrap = document.getElementById('recentAlertsTableWrap');
  const table = document.getElementById('recentAlertsTable');

  const rows = state.alerts.slice(0, 5);

  if (rows.length === 0) {
    stateElement.hidden = false;
    stateElement.textContent = 'No alerts available. Ingest one from the Alerts view.';
    tableWrap.hidden = true;
    return;
  }

  stateElement.hidden = true;
  tableWrap.hidden = false;

  table.innerHTML = rows
    .map(
      (alert) => `
      <tr>
        <td>${alert.id}</td>
        <td>${alert.title}</td>
        <td>${severityBadge(alert.severity)}</td>
        <td>${statusBadge(alert.status)}</td>
        <td>${resolveAssigneeName(alert.assignee)}</td>
        <td>${formatDate(alert.updatedAt)}</td>
        <td><button class="btn tiny" data-open-id="${alert.id}">Investigate</button></td>
      </tr>`
    )
    .join('');
}

function resolveAssigneeName(assignee) {
  if (!assignee) {
    return 'Unassigned';
  }

  const user = state.users.find((entry) => entry.id === assignee);
  return user ? user.name : assignee;
}

function renderAlertQueue() {
  const stateElement = document.getElementById('alertsState');
  const tableWrap = document.getElementById('alertsTableWrap');
  const table = document.getElementById('alertsTable');

  if (state.alerts.length === 0) {
    stateElement.hidden = false;
    stateElement.textContent = 'No matching alerts for current filters.';
    tableWrap.hidden = true;
    return;
  }

  stateElement.hidden = true;
  tableWrap.hidden = false;

  table.innerHTML = state.alerts
    .map(
      (alert) => `
      <tr>
        <td>${alert.id}</td>
        <td>${alert.title}</td>
        <td>${severityBadge(alert.severity)}</td>
        <td>${statusBadge(alert.status)}</td>
        <td>${resolveAssigneeName(alert.assignee)}</td>
        <td>${alert.source}</td>
        <td><button class="btn tiny" data-open-id="${alert.id}">Open</button></td>
      </tr>`
    )
    .join('');
}

function renderAnalystSelectors() {
  const selector = document.getElementById('analystSelector');
  const detailAssignee = document.getElementById('detailAssignee');
  const selectedUserId = getCurrentUserId();

  const userOptions = state.users
    .map((user) => `<option value="${user.id}">${user.name} · ${user.role}</option>`)
    .join('');

  selector.innerHTML = userOptions;
  detailAssignee.innerHTML = `<option value="">Unassigned</option>${state.users
    .map((user) => `<option value="${user.id}">${user.name}</option>`)
    .join('')}`;

  if (!selectedUserId && state.users[0]) {
    setCurrentUserId(state.users[0].id);
  }

  selector.value = getCurrentUserId();
  syncCurrentAnalystLabels();
}

function syncCurrentAnalystLabels() {
  const user = currentUser();

  activeAnalyst.textContent = user ? `${user.name} (${user.role})` : 'Unassigned';
  document.getElementById('roleValue').textContent = user ? user.role : '-';
}

function renderInvestigation(alert) {
  const empty = document.getElementById('investigationEmpty');
  const panel = document.getElementById('investigationPanel');

  if (!alert) {
    empty.hidden = false;
    panel.hidden = true;
    return;
  }

  empty.hidden = true;
  panel.hidden = false;

  document.getElementById('investigationTitle').textContent = `${alert.id} · ${alert.title}`;
  document.getElementById('investigationMeta').textContent = `${alert.description || 'No description'} · Source: ${alert.source} · Updated: ${formatDate(alert.updatedAt)}`;
  document.getElementById('detailStatus').value = alert.status;
  document.getElementById('detailSeverity').value = alert.severity;
  document.getElementById('detailAssignee').value = alert.assignee || '';

  const summary = document.getElementById('analysisSummary');
  const recommendations = document.getElementById('analysisRecommendations');

  if (alert.aiSummary) {
    summary.textContent = `${alert.aiSummary} (confidence ${alert.aiConfidence}%)`;
    recommendations.innerHTML = alert.aiRecommendations.map((item) => `<li>${item}</li>`).join('');
  } else {
    summary.textContent = 'No analysis generated yet.';
    recommendations.innerHTML = '';
  }

  document.getElementById('timelineList').innerHTML = [...alert.timeline]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .map(
      (item) => `
      <li>
        <p><strong>${item.type.toUpperCase()}</strong> · ${item.message}</p>
        <span>${item.author} · ${formatDate(item.timestamp)}</span>
      </li>`
    )
    .join('');
}

async function loadMetricsAndAlerts() {
  const query = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const [metricsData, alertsData] = await Promise.all([
    apiRequest('/api/metrics'),
    apiRequest(`/api/alerts?${query.toString()}`)
  ]);

  state.alerts = alertsData.alerts;
  renderMetrics(metricsData);
  renderRecentAlerts();
  renderAlertQueue();

  if (state.selectedAlertId) {
    const selected = state.alerts.find((alert) => alert.id === state.selectedAlertId)
      || (await apiRequest(`/api/alerts/${state.selectedAlertId}`)).alert;
    renderInvestigation(selected);
  }
}

async function ingestAlert(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(event.target);
  const user = currentUser();

  const payload = {
    title: formData.get('title'),
    source: formData.get('source'),
    severity: formData.get('severity'),
    description: formData.get('description'),
    rawLog: formData.get('rawLog'),
    actor: user ? user.name : 'Analyst'
  };

  try {
    await apiRequest('/api/alerts/ingest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    event.target.reset();
    showFeedback('success', 'Alert ingested successfully.');
    await loadMetricsAndAlerts();
  } catch (error) {
    showFeedback('error', error.message);
  }
}

async function openAlert(alertId) {
  state.selectedAlertId = alertId;
  goToView('investigation');

  try {
    const data = await apiRequest(`/api/alerts/${alertId}`);
    renderInvestigation(data.alert);
  } catch (error) {
    showFeedback('error', error.message);
  }
}

async function saveInvestigationUpdates() {
  if (!state.selectedAlertId) {
    return;
  }

  const user = currentUser();

  try {
    await apiRequest(`/api/alerts/${state.selectedAlertId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: document.getElementById('detailStatus').value,
        severity: document.getElementById('detailSeverity').value,
        assignee: document.getElementById('detailAssignee').value,
        actor: user ? user.name : 'Analyst'
      })
    });

    showFeedback('success', 'Investigation details updated.');
    await loadMetricsAndAlerts();
    await openAlert(state.selectedAlertId);
  } catch (error) {
    showFeedback('error', error.message);
  }
}

async function runAnalysis() {
  if (!state.selectedAlertId) {
    return;
  }

  try {
    showFeedback('info', 'Running AI triage...');
    await apiRequest(`/api/alerts/${state.selectedAlertId}/analyze`, { method: 'POST' });
    showFeedback('success', 'AI triage completed.');
    await loadMetricsAndAlerts();
    await openAlert(state.selectedAlertId);
  } catch (error) {
    showFeedback('error', error.message);
  }
}

async function addNote(event) {
  event.preventDefault();
  if (!state.selectedAlertId) {
    return;
  }

  const textarea = document.getElementById('noteMessage');
  const message = textarea.value.trim();

  if (!message) {
    showFeedback('error', 'Note message is required.');
    return;
  }

  const user = currentUser();

  try {
    await apiRequest(`/api/alerts/${state.selectedAlertId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        author: user ? user.name : 'Analyst',
        message
      })
    });

    textarea.value = '';
    showFeedback('success', 'Note added to timeline.');
    await loadMetricsAndAlerts();
    await openAlert(state.selectedAlertId);
  } catch (error) {
    showFeedback('error', error.message);
  }
}

async function initialize() {
  try {
    const health = await apiRequest('/api/health');
    setApiStatus(health.status === 'ok');

    const usersResponse = await apiRequest('/api/users');
    state.users = usersResponse.users;
    renderAnalystSelectors();

    await loadMetricsAndAlerts();
  } catch (error) {
    setApiStatus(false);
    showFeedback('error', `Unable to initialize app: ${error.message}`);
  }
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => goToView(item.dataset.view));
});

document.getElementById('filtersForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  state.filters.search = document.getElementById('searchInput').value.trim();
  state.filters.status = document.getElementById('statusFilter').value;
  state.filters.severity = document.getElementById('severityFilter').value;
  state.filters.sortBy = document.getElementById('sortByFilter').value;
  await loadMetricsAndAlerts();
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-id]');
  if (button) {
    openAlert(button.dataset.openId);
  }
});

document.getElementById('ingestForm').addEventListener('submit', ingestAlert);
document.getElementById('noteForm').addEventListener('submit', addNote);
document.getElementById('saveDetailBtn').addEventListener('click', saveInvestigationUpdates);
document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
document.getElementById('dashboardRefreshBtn').addEventListener('click', loadMetricsAndAlerts);
document.getElementById('analystSelector').addEventListener('change', (event) => {
  setCurrentUserId(event.target.value);
  syncCurrentAnalystLabels();
  showFeedback('info', 'Active analyst switched.');
});

initialize();
