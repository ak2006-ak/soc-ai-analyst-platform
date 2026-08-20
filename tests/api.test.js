const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { createServer } = require('../server');

function requestJson(port, pathname, options = {}) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  }).then(async (response) => ({
    status: response.status,
    body: await response.json()
  }));
}

test('alerts can be ingested, analyzed, and updated', async (t) => {
  const tempDir = path.join(process.cwd(), 'tmp-test-data');
  const dataFile = path.join(tempDir, `store-${Date.now()}.json`);
  fs.mkdirSync(tempDir, { recursive: true });

  const server = createServer({ dataFile, rootDir: process.cwd() });
  await new Promise((resolve) => server.listen(0, resolve));

  const port = server.address().port;

  await t.test('health and initial users are available', async () => {
    const health = await requestJson(port, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const users = await requestJson(port, '/api/users');
    assert.equal(users.status, 200);
    assert.ok(Array.isArray(users.body.users));
    assert.ok(users.body.users.length >= 1);
  });

  const ingest = await requestJson(port, '/api/alerts/ingest', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Potential brute force detected',
      source: 'VPN',
      severity: 'medium',
      description: 'Multiple failed login attempts',
      rawLog: 'authentication failure user=admin attempts=23'
    })
  });

  assert.equal(ingest.status, 201);
  assert.match(ingest.body.alert.id, /^ALT-\d+$/);

  const alertId = ingest.body.alert.id;

  const analyze = await requestJson(port, `/api/alerts/${alertId}/analyze`, { method: 'POST' });
  assert.equal(analyze.status, 200);
  assert.ok(analyze.body.analysis.summary.length > 10);
  assert.ok(analyze.body.analysis.recommendations.length >= 1);

  const update = await requestJson(port, `/api/alerts/${alertId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'in_progress', severity: 'high' })
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.alert.status, 'in_progress');
  assert.equal(update.body.alert.severity, 'high');

  const note = await requestJson(port, `/api/alerts/${alertId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ author: 'Test Analyst', message: 'Escalated to tier-2 for review.' })
  });

  assert.equal(note.status, 201);
  assert.ok(note.body.alert.timeline.some((item) => item.type === 'note'));

  const filtered = await requestJson(port, '/api/alerts?search=brute&status=in_progress');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.alerts.some((item) => item.id === alertId));

  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});
