/**
 * Integration test for Supabase storage + Telegram notifications.
 * Runs the real server against a local mock of Supabase REST (PostgREST) and the Telegram Bot API,
 * so no real keys are needed:  node server/test-storage.js
 */
const http = require('http');

const rows = [];
const telegramCalls = [];
const sbCalls = [];

const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const url = new URL(req.url, 'http://mock');
    // --- Telegram ---
    if (url.pathname.startsWith('/bot')) {
      telegramCalls.push({ path: url.pathname, body: JSON.parse(body || '{}') });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":true}');
    }
    // --- Supabase REST ---
    sbCalls.push({ method: req.method, path: url.pathname, query: url.search, headers: req.headers });
    if (req.headers.authorization !== 'Bearer test-service-key' || req.headers.apikey !== 'test-service-key') {
      res.writeHead(401); return res.end('{"message":"bad key"}');
    }
    if (url.pathname !== '/rest/v1/leads') { res.writeHead(404); return res.end('{}'); }
    const eq = (k) => { const v = url.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
    if (req.method === 'POST') {
      const row = JSON.parse(body);
      rows.unshift(row);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([row]));
    }
    if (req.method === 'GET') {
      let list = rows.slice();
      if (eq('status')) list = list.filter(r => r.status === eq('status'));
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const page = list.slice(offset, offset + limit);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': `${offset}-${offset + page.length - 1}/${list.length}` });
      return res.end(JSON.stringify(page));
    }
    if (req.method === 'PATCH') {
      const patch = JSON.parse(body);
      const hit = rows.filter(r => r.id === eq('id'));
      hit.forEach(r => Object.assign(r, patch));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(hit));
    }
    res.writeHead(405); res.end('{}');
  });
});

let passed = 0, failed = 0;
const assert = (c, name, extra = '') => { if (c) { passed++; console.log('  [PASS]', name); } else { failed++; console.error('  [FAIL]', name, extra); } };

function call(port, path, { method = 'GET', body, auth } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = 'Basic ' + Buffer.from(auth).toString('base64');
    const r = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let t = ''; res.on('data', c => (t += c)); res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch (_) {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

mock.listen(0, '127.0.0.1', async () => {
  const mockUrl = `http://127.0.0.1:${mock.address().port}`;
  Object.assign(process.env, {
    SUPABASE_URL: mockUrl,
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    TELEGRAM_API_URL: mockUrl,
    TELEGRAM_BOT_TOKEN: '123:TEST',
    TELEGRAM_CHAT_ID: '-100500',
    CRM_PASSWORD: 'test-crm-password'
  });
  const { createServer } = require('./server.js');
  const app = createServer();
  app.listen(0, '127.0.0.1', async () => {
    const port = app.address().port;
    const AUTH = 'admin:test-crm-password';
    try {
      console.log('\n[SUITE] Supabase storage + Telegram');
      const health = await call(port, '/api/health');
      assert(health.json?.storage === 'supabase', 'health reports storage=supabase');
      assert(health.json?.telegram === true, 'health reports telegram enabled');

      const created = await call(port, '/api/leads', { method: 'POST', body: {
        name: 'Тест <script>', phone: '8 701 123 45 67', company: 'ТОО Ромашка', city: 'Астана',
        robots: ['Unitree G1-D × 2'], messenger: 'Telegram', source: 'website_quote_form', sourceUrl: 'https://robot-kz.vercel.app/#series-g1'
      } });
      assert(created.status === 201, 'POST /api/leads → 201');
      const id = created.json?.lead?.id;
      assert(rows.length === 1 && rows[0].id === id, 'lead row inserted into Supabase');
      assert(rows[0].phone === '+7 (701) 123-45-67' && rows[0].raw_phone === '77011234567', 'phone normalised in row');
      assert(JSON.stringify(rows[0].robots) === '["Unitree G1-D × 2"]', 'robots stored as JSON array');
      assert(rows[0].source_url === 'https://robot-kz.vercel.app/#series-g1', 'source_url stored');
      assert(created.json?.lead && created.json.lead.ip === undefined, 'response does not echo IP / user agent');

      assert(telegramCalls.length === 1, 'one Telegram message sent');
      const tg = telegramCalls[0] || { body: {} };
      assert(tg.path === '/bot123:TEST/sendMessage' && tg.body.chat_id === '-100500', 'Telegram called with bot token + chat id');
      assert(tg.body.parse_mode === 'HTML' && tg.body.text.includes('Тест &lt;script&gt;'), 'Telegram text is HTML-escaped');
      assert(tg.body.text.includes('https://wa.me/77011234567'), 'Telegram text has WhatsApp link to client');

      const noAuth = await call(port, '/api/leads');
      assert(noAuth.status === 401, 'GET /api/leads still requires CRM password');
      const list = await call(port, '/api/leads', { auth: AUTH });
      assert(list.status === 200 && list.json?.total === 1 && list.json?.leads?.[0]?.id === id, 'CRM list reads from Supabase');
      assert(list.json?.leads?.[0]?.contactMethod === 'Telegram', 'row mapped back to camelCase lead');

      const upd = await call(port, `/api/leads/${id}/status`, { method: 'POST', auth: AUTH, body: { status: 'В работе', comment: 'Позвонить в 15:00' } });
      assert(upd.status === 200 && upd.json?.lead?.status === 'В работе', 'status update via Supabase PATCH');
      assert(rows[0].manager_notes === 'Позвонить в 15:00', 'manager notes saved');
      const missing = await call(port, '/api/leads/lead_nope/status', { method: 'POST', auth: AUTH, body: { status: 'В работе' } });
      assert(missing.status === 404, 'unknown lead → 404');

      const filtered = await call(port, `/api/leads?status=${encodeURIComponent('Новый')}`, { auth: AUTH });
      assert(filtered.json?.filteredCount === 0 && filtered.json?.total === 1, 'status filter + total count');
      assert(sbCalls.every(c => c.headers.apikey === 'test-service-key'), 'service key sent on every Supabase call');
    } catch (err) {
      failed++; console.error(err);
    }
    console.log(`\n[RESULT] ${passed} passed, ${failed} failed`);
    app.close(); mock.close();
    process.exit(failed ? 1 : 0);
  });
});
