/**
 * ==============================================================================
 * XBOT Robotics Kazakhstan — Automated API Test Suite
 * ==============================================================================
 * Comprehensive integration tests for all REST endpoints and static serving.
 * Runs against the live or local Node.js server.
 * ==============================================================================
 */

const http = require('http');

const TEST_PORT = process.env.TEST_PORT || 3000;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  [PASS] [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    failedCount++;
  }
}

function request(urlPath, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, BASE_URL);
    const reqOptions = {
      hostname: fullUrl.hostname,
      port: fullUrl.port,
      path: fullUrl.pathname + fullUrl.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          rawBody: data,
          json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('============================================================');
  console.log(`[START] Starting XBOT Robotics API Test Suite against ${BASE_URL}`);
  console.log('============================================================\n');

  try {
    // --------------------------------------------------------------------------
    // Test 1: GET /api/health
    // --------------------------------------------------------------------------
    console.log('[SUITE] Suite 1: Health & Diagnostics');
    const healthRes = await request('/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200', `Got ${healthRes.status}`);
    assert(healthRes.json && healthRes.json.status === 'ok', 'Health status is "ok"');
    assert(healthRes.json?.service?.includes('XBOT'), 'Service name is correctly reported');
    assert(typeof healthRes.json?.uptimeSeconds === 'number', 'Uptime is returned as number');
    assert(typeof healthRes.json?.stats?.totalLeads === 'number', 'Total leads statistic is present');

    // --------------------------------------------------------------------------
    // Test 2: GET /api/robots
    // --------------------------------------------------------------------------
    console.log('\n[SUITE] Suite 2: Robots Catalog API');
    const catalogRes = await request('/api/robots');
    assert(catalogRes.status === 200, 'GET /api/robots returns HTTP 200');
    assert(catalogRes.json?.success === true, 'Catalog response success is true');
    assert(Array.isArray(catalogRes.json?.robots), 'Robots is an array');
    assert(catalogRes.json?.robots?.length >= 30, `Catalog contains all models (Found ${catalogRes.json?.robots?.length})`);

    // Test 2b: Filter by Brand
    const brandRes = await request('/api/robots?brand=Unitree');
    const allUnitree = brandRes.json?.robots?.every(r => r.brand.toLowerCase() === 'unitree');
    assert(brandRes.status === 200 && allUnitree, 'GET /api/robots?brand=Unitree filters correctly');

    // Test 2c: Filter by Slug
    const slugRes = await request('/api/robots?slug=go2-pro');
    assert(slugRes.status === 200 && slugRes.json?.robot?.name === 'Unitree Go2 Pro', 'GET /api/robots?slug=go2-pro returns single model');

    // --------------------------------------------------------------------------
    // Test 3: POST /api/leads & Validation
    // --------------------------------------------------------------------------
    console.log('\n[SUITE] Suite 3: Lead Capture & CRM Pipeline');
    
    // Validation check: Missing phone
    const invalidLeadRes = await request('/api/leads', { method: 'POST' }, {
      name: 'Азамат'
    });
    assert(invalidLeadRes.status === 400, 'POST /api/leads rejects missing phone with 400');

    // Valid lead creation
    const newLeadPayload = {
      name: 'Бауржан Темиров',
      phone: '+7 (705) 987-65-43',
      company: 'ТОО Астана Логистикс Групп',
      city: 'Астана',
      robots: ['PUDU T300 AMR', 'Unitree B2'],
      contactMethod: 'WhatsApp',
      budget: '25 000 000 ₸',
      comment: 'Требуется автоматизация складского комплекса в индустриальном парке',
      source: 'automated_test_suite'
    };

    const createRes = await request('/api/leads', { method: 'POST' }, newLeadPayload);
    assert(createRes.status === 201, 'POST /api/leads returns HTTP 201 Created');
    assert(createRes.json?.success === true, 'Lead creation reports success: true');
    assert(createRes.json?.lead?.id?.startsWith('lead_'), 'Lead receives unique ID with lead_ prefix');
    assert(createRes.json?.lead?.status === 'Новый', 'New lead gets initial status "Новый"');
    assert(createRes.json?.whatsapp?.link?.includes('https://wa.me/'), 'Server generates valid WhatsApp link');

    const createdLeadId = createRes.json?.lead?.id;

    // --------------------------------------------------------------------------
    // Test 4: GET /api/leads & Status Update
    // --------------------------------------------------------------------------
    console.log('\n[SUITE] Suite 4: CRM Management & Status Update');
    const leadsListRes = await request('/api/leads');
    assert(leadsListRes.status === 200, 'GET /api/leads returns HTTP 200');
    assert(Array.isArray(leadsListRes.json?.leads), 'Returns array of leads');
    const foundCreated = leadsListRes.json?.leads?.some(l => l.id === createdLeadId);
    assert(foundCreated, `Created lead ${createdLeadId} is present in CRM leads list`);

    // Update status to "Тест-драйв назначен"
    const updateRes = await request(`/api/leads/${createdLeadId}/status`, { method: 'POST' }, {
      status: 'Тест-драйв назначен',
      comment: 'Тест-драйв запланирован на 10 ноября в Астане'
    });
    assert(updateRes.status === 200, 'POST /api/leads/:id/status returns HTTP 200');
    assert(updateRes.json?.lead?.status === 'Тест-драйв назначен', 'Lead status successfully updated to "Тест-драйв назначен"');

    // Invalid status test
    const invalidStatusRes = await request(`/api/leads/${createdLeadId}/status`, { method: 'POST' }, {
      status: 'КастомныйНевалидныйСтатус'
    });
    assert(invalidStatusRes.status === 400, 'Rejects invalid status with HTTP 400');

    // --------------------------------------------------------------------------
    // Test 5: POST /api/whatsapp/link
    // --------------------------------------------------------------------------
    console.log('\n[SUITE] Suite 5: WhatsApp Business Link Bridge');
    const waRes = await request('/api/whatsapp/link', { method: 'POST' }, {
      phone: '+7 777 911 7499',
      lead: {
        name: 'Данияр',
        phone: '+7 (701) 111-22-33',
        city: 'Шымкент',
        company: 'ТОО Шымкент Фарма',
        robots: ['PUDU CC1 Pro'],
        budget: '6 200 000 ₸',
        contactMethod: 'WhatsApp'
      }
    });
    assert(waRes.status === 200, 'POST /api/whatsapp/link returns HTTP 200');
    assert(waRes.json?.url?.startsWith('https://wa.me/77779117499'), 'WhatsApp URL points to target manager phone');
    assert(waRes.json?.messageText?.includes('Шымкент Фарма'), 'WhatsApp message contains lead context');

    // --------------------------------------------------------------------------
    // Test 6: Static File Serving & Security
    // --------------------------------------------------------------------------
    console.log('\n[SUITE] Suite 6: Frontend & Static Serving');
    
    // Root index.html
    const rootRes = await request('/');
    assert(rootRes.status === 200, 'GET / returns HTTP 200');
    assert(rootRes.headers['content-type']?.includes('text/html'), 'Content-Type for / is text/html');
    assert(rootRes.rawBody?.includes('XBOT'), 'index.html contains XBOT branding');

    // CRM Dashboard
    const crmRes = await request('/crm');
    assert(crmRes.status === 200, 'GET /crm returns HTTP 200');
    assert(crmRes.rawBody?.includes('XBOT CRM'), 'CRM dashboard renders properly');

    // PDF Catalog
    const pdfRes = await request('/catalog_pudu_unitree_extended.pdf');
    assert(pdfRes.status === 200, 'GET /catalog_pudu_unitree_extended.pdf returns HTTP 200');
    assert(pdfRes.headers['content-type'] === 'application/pdf', 'Content-Type is application/pdf');
    assert(parseInt(pdfRes.headers['content-length'] || '0', 10) > 100000, 'PDF file size is over 100KB');

    // Path Traversal Security
    const traversalRes = await request('/../../../etc/passwd');
    assert(traversalRes.status === 403 || traversalRes.status === 404, 'Path traversal is safely blocked (HTTP 403/404)');

    // --------------------------------------------------------------------------
    // Summary
    // --------------------------------------------------------------------------
    console.log('\n============================================================');
    console.log(`[RESULT] TEST RESULTS: ${passedCount} passed, ${failedCount} failed`);
    console.log('============================================================');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('\n[FAIL] Uncaught error during test execution:', err);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  // Check if server is already running
  const probe = http.get(BASE_URL + '/api/health', (res) => {
    // Server is already running, run tests against it
    runTests();
  });

  probe.on('error', () => {
    // Server is not running, spin up ephemeral server
    const { createServer } = require('./server.js');
    const server = createServer();
    server.listen(TEST_PORT, '127.0.0.1', async () => {
      console.log(`[Test Runner] Started temporary server on port ${TEST_PORT}`);
      try {
        await runTests();
        server.close(() => process.exit(0));
      } catch (err) {
        console.error(err);
        server.close(() => process.exit(1));
      }
    });
  });
}

module.exports = { runTests };
