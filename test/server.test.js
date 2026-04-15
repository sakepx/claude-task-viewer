const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

// Override TASKS_DIR and PROJECTS_DIR to use fixtures before requiring server
// We need to set env vars before the module initializes
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
process.env.CLAUDE_DIR = FIXTURES_DIR;

const { app } = require('../server');

function request(server, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:${server.address().port}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {}
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('API endpoints', () => {
  let server;

  before(() => {
    return new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('GET /api/sessions', () => {
    it('returns a JSON array', async () => {
      const res = await request(server, 'GET', '/api/sessions');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });

    it('includes test-session-1 from fixtures', async () => {
      const res = await request(server, 'GET', '/api/sessions?limit=all');
      const session = res.body.find(s => s.id === 'test-session-1');
      assert.ok(session, 'test-session-1 should be in the list');
      assert.equal(session.taskCount, 3);
      assert.equal(session.completed, 1);
      assert.equal(session.inProgress, 1);
      assert.equal(session.pending, 1);
    });

    it('respects limit parameter', async () => {
      const res = await request(server, 'GET', '/api/sessions?limit=1');
      assert.ok(res.body.length <= 1);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('returns tasks for an existing session', async () => {
      const res = await request(server, 'GET', '/api/sessions/test-session-1');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 3);

      const ids = res.body.map(t => t.id);
      assert.deepEqual(ids, ['1', '2', '3']);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(server, 'GET', '/api/sessions/nonexistent-session');
      assert.equal(res.status, 404);
    });
  });

  describe('GET /api/tasks/all', () => {
    it('returns tasks across all sessions', async () => {
      const res = await request(server, 'GET', '/api/tasks/all');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 3);

      // Each task should have sessionId
      for (const task of res.body) {
        assert.ok(task.sessionId, 'task should have sessionId');
      }
    });
  });

  describe('POST /api/tasks/:sid/:tid/note', () => {
    it('returns 400 for empty note', async () => {
      const res = await request(server, 'POST', '/api/tasks/test-session-1/1/note', { note: '' });
      assert.equal(res.status, 400);
    });

    it('returns 400 for whitespace-only note', async () => {
      const res = await request(server, 'POST', '/api/tasks/test-session-1/1/note', { note: '   ' });
      assert.equal(res.status, 400);
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(server, 'POST', '/api/tasks/test-session-1/999/note', { note: 'test' });
      assert.equal(res.status, 404);
    });
  });

  describe('DELETE /api/tasks/:sid/:tid', () => {
    it('returns 404 for non-existent task', async () => {
      const res = await request(server, 'DELETE', '/api/tasks/test-session-1/999');
      assert.equal(res.status, 404);
    });

    it('returns 400 when deleting a task that blocks others', async () => {
      // Task 1 blocks task 2
      const res = await request(server, 'DELETE', '/api/tasks/test-session-1/1');
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('blocks'));
    });
  });

  describe('GET /api/events (SSE)', () => {
    it('returns SSE headers', async () => {
      return new Promise((resolve, reject) => {
        const url = `http://localhost:${server.address().port}/api/events`;
        http.get(url, (res) => {
          assert.equal(res.headers['content-type'], 'text/event-stream');
          assert.equal(res.headers['cache-control'], 'no-cache');
          res.destroy();
          resolve();
        }).on('error', reject);
      });
    });
  });
});
