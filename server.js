const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { URL } = require('node:url');

const { Store } = require('./src/store');
const { generateAnalysis } = require('./src/analysis');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';

    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });

    request.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (_error) {
        reject(new Error('Invalid JSON payload'));
      }
    });

    request.on('error', reject);
  });
}

function serveStatic(requestPath, response, rootDir) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 400, { error: 'Invalid path' });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const extension = path.extname(filePath);
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(fs.readFileSync(filePath));
    return;
  }

  const fallback = path.join(rootDir, 'index.html');
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(fs.readFileSync(fallback));
}

function createServer(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const store = options.store || new Store(options.dataFile);

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      if (url.pathname === '/api/users' && request.method === 'GET') {
        sendJson(response, 200, { users: store.listUsers() });
        return;
      }

      if (url.pathname === '/api/metrics' && request.method === 'GET') {
        sendJson(response, 200, store.getMetrics());
        return;
      }

      if ((url.pathname === '/api/alerts' || url.pathname === '/api/cases') && request.method === 'GET') {
        const alerts = store.listAlerts({
          search: url.searchParams.get('search') || '',
          status: url.searchParams.get('status') || '',
          severity: url.searchParams.get('severity') || '',
          assignee: url.searchParams.get('assignee') || '',
          sortBy: url.searchParams.get('sortBy') || 'updatedAt',
          sortOrder: url.searchParams.get('sortOrder') || 'desc'
        });
        sendJson(response, 200, { alerts });
        return;
      }

      if (url.pathname === '/api/alerts/ingest' && request.method === 'POST') {
        const payload = await parseBody(request);
        const alert = store.createAlert(payload, payload.actor || 'Analyst');
        sendJson(response, 201, { alert });
        return;
      }

      const alertIdMatch = url.pathname.match(/^\/api\/alerts\/(ALT-\d+)$/);
      if (alertIdMatch && request.method === 'GET') {
        const alert = store.getAlert(alertIdMatch[1]);
        if (!alert) {
          sendJson(response, 404, { error: 'Alert not found' });
          return;
        }
        sendJson(response, 200, { alert });
        return;
      }

      if (alertIdMatch && request.method === 'PATCH') {
        const payload = await parseBody(request);
        const alert = store.updateAlert(alertIdMatch[1], payload, payload.actor || 'Analyst');
        if (!alert) {
          sendJson(response, 404, { error: 'Alert not found' });
          return;
        }
        sendJson(response, 200, { alert });
        return;
      }

      const noteMatch = url.pathname.match(/^\/api\/alerts\/(ALT-\d+)\/notes$/);
      if (noteMatch && request.method === 'POST') {
        const payload = await parseBody(request);
        const alert = store.addNote(noteMatch[1], payload);
        if (!alert) {
          sendJson(response, 404, { error: 'Alert not found' });
          return;
        }
        sendJson(response, 201, { alert });
        return;
      }

      const analyzeMatch = url.pathname.match(/^\/api\/alerts\/(ALT-\d+)\/analyze$/);
      if (analyzeMatch && request.method === 'POST') {
        const existingAlert = store.getAlert(analyzeMatch[1]);
        if (!existingAlert) {
          sendJson(response, 404, { error: 'Alert not found' });
          return;
        }

        const analysis = generateAnalysis(existingAlert);
        const alert = store.saveAnalysis(analyzeMatch[1], analysis);
        sendJson(response, 200, { alert, analysis });
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'Endpoint not found' });
        return;
      }

      serveStatic(url.pathname, response, rootDir);
    } catch (error) {
      const statusCode = error.message.includes('Invalid') || error.message.includes('required') ? 400 : 500;
      sendJson(response, statusCode, { error: error.message || 'Unexpected server error' });
    }
  });
}

function startServer() {
  const dataFile = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : undefined;
  const server = createServer({ dataFile, rootDir: process.cwd() });
  const port = Number(process.env.PORT || 3000);

  server.listen(port, () => {
    process.stdout.write(`SentinelAI SOC platform running at http://localhost:${port}\n`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer
};
