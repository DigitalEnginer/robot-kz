/**
 * ==============================================================================
 * ORDA ROBOTICS Kazakhstan — Core Production Server
 * ==============================================================================
 * High-performance, zero-external-dependency Node.js backend.
 * Provides REST API for lead capture, catalog distribution, CRM management,
 * WhatsApp messaging bridge, and static frontend file serving.
 * 
 * Target: Kazakhstan B2B Robotics Market (Unitree & PUDU)
 * Official Supplier: ТОО "ORDA ROBOTICS" (ORDA.KZ)
 * License: Proprietary
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const os = require('os');

let SITE_CONFIG = null;
try {
  SITE_CONFIG = require('../config/site.js');
} catch (_e) {
  SITE_CONFIG = {
    brandName: "ORDA ROBOTICS",
    brandShort: "ORDA.KZ",
    whatsappNumber: "77000000000",
    phoneDisplay: "+7 (700) 000-00-00",
    emailSales: "sales@orda-robotics.kz"
  };
}

// === CONFIGURATION ===
let PORT = parseInt(process.env.PORT || '3000', 10);
const portArgIndex = process.argv.indexOf('--port');
if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
  PORT = parseInt(process.argv[portArgIndex + 1], 10);
}

const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_MANAGER_PHONE = process.env.MANAGER_WHATSAPP || SITE_CONFIG.whatsappNumber || '77000000000';
const ROOT_DIR = path.resolve(__dirname, '..');
const ROOT_DATA_DIR = process.env.VERCEL 
  ? path.join(os.tmpdir(), 'orda-data') 
  : path.resolve(ROOT_DIR, 'data');
const ROOT_LEADS_FILE = path.join(ROOT_DATA_DIR, 'leads.json');
const SERVER_DATA_DIR = ROOT_DATA_DIR;
const SERVER_LEADS_FILE = ROOT_LEADS_FILE;
const LEADS_FILE = ROOT_LEADS_FILE;
const CRM_FILE = path.join(__dirname, 'crm.html');
const START_TIME = Date.now();

// Allowed lead statuses in the sales pipeline
const VALID_STATUSES = [
  'Новый',
  'В работе',
  'Тест-драйв назначен',
  'Сделка закрыта',
  'Отклонен'
];

// MIME types dictionary for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// === IN-MEMORY RATE LIMITER ===
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 40;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  record.count += 1;
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

// Clean up expired rate limiter records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

// === ATOMIC DATA STORAGE (LEADS FILE MUTEX) ===
let isWritingLeads = false;
const writeQueue = [];

async function ensureDataDir() {
  try {
    await fsp.mkdir(ROOT_DATA_DIR, { recursive: true });
    await fsp.mkdir(SERVER_DATA_DIR, { recursive: true });

    let initialData = '[]';
    try {
      initialData = await fsp.readFile(ROOT_LEADS_FILE, 'utf8');
    } catch {
      try {
        initialData = await fsp.readFile(SERVER_LEADS_FILE, 'utf8');
      } catch {
        initialData = JSON.stringify([], null, 2);
      }
    }

    try { await fsp.access(ROOT_LEADS_FILE); } catch { await fsp.writeFile(ROOT_LEADS_FILE, initialData, 'utf8'); }
    try { await fsp.access(SERVER_LEADS_FILE); } catch { await fsp.writeFile(SERVER_LEADS_FILE, initialData, 'utf8'); }
  } catch (err) {
    console.error('[Storage] Error ensuring data directory:', err);
  }
}

async function readLeads() {
  await ensureDataDir();
  try {
    let raw = '';
    try {
      raw = await fsp.readFile(ROOT_LEADS_FILE, 'utf8');
    } catch {
      raw = await fsp.readFile(SERVER_LEADS_FILE, 'utf8');
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Storage] Error reading leads.json:', err.message);
    return [];
  }
}

function writeLeadsSafely(leads) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ leads, resolve, reject });
    processWriteQueue();
  });
}

async function processWriteQueue() {
  if (isWritingLeads || writeQueue.length === 0) return;
  isWritingLeads = true;
  const { leads, resolve, reject } = writeQueue.shift();

  const tempFileRoot = path.join(ROOT_DATA_DIR, `leads_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.tmp`);
  const tempFileServer = path.join(SERVER_DATA_DIR, `leads_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.tmp`);
  try {
    await ensureDataDir();
    const payload = JSON.stringify(leads, null, 2);
    
    // Write atomically to both root data and server data
    await fsp.writeFile(tempFileRoot, payload, 'utf8');
    await fsp.rename(tempFileRoot, ROOT_LEADS_FILE);

    try {
      await fsp.writeFile(tempFileServer, payload, 'utf8');
      await fsp.rename(tempFileServer, SERVER_LEADS_FILE);
    } catch (serverErr) {
      console.warn('[Storage] Warning syncing server/data/leads.json:', serverErr.message);
    }

    resolve(leads);
  } catch (err) {
    try { await fsp.unlink(tempFileRoot); } catch (_) {}
    try { await fsp.unlink(tempFileServer); } catch (_) {}
    reject(err);
  } finally {
    isWritingLeads = false;
    if (writeQueue.length > 0) {
      setImmediate(processWriteQueue);
    }
  }
}

// === ROBOTS CATALOG LOADER ===
function loadRobotsCatalog() {
  try {
    const robotsPath = path.join(ROOT_DIR, 'js', 'robots-data.js');
    if (fs.existsSync(robotsPath)) {
      const code = fs.readFileSync(robotsPath, 'utf8');
      // Secure execution in sandbox function
      return new Function(code + '; return (typeof ROBOTS_DATA !== "undefined" ? ROBOTS_DATA : []);')();
    }
  } catch (err) {
    console.error('[Catalog] Error loading robots-data.js:', err.message);
  }
  return [];
}

// === PHONE & TEXT HELPERS ===
function cleanPhoneDigits(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    return '7' + cleaned.slice(1);
  }
  return cleaned;
}

function formatKazakhstanPhone(raw) {
  const digits = cleanPhoneDigits(raw);
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return raw || '—';
}

function formatWhatsAppLeadMessage(lead) {
  const robotsList = Array.isArray(lead.robots) && lead.robots.length > 0
    ? lead.robots.map(r => `  • ${typeof r === 'object' ? r.name : r}`).join('\n')
    : (lead.robots ? `  • ${lead.robots}` : (lead.robot ? `  • ${lead.robot}` : '  • Не выбрано'));

  const lines = [
    `*НОВАЯ ЗАЯВКА: ${SITE_CONFIG.brandName} (${SITE_CONFIG.brandShort})*`,
    '────────────────────────',
    `*Клиент:* ${lead.name || 'Не указано'}`,
    `*Телефон:* ${lead.phone || 'Не указано'}`,
    `*Компания:* ${lead.company || 'Частное лицо / ТОО не указано'}`,
    `*Город:* ${lead.city || 'Алматы'}`,
    '────────────────────────',
    '*Интересующие роботы:*',
    robotsList,
    lead.budget ? `*Бюджет/Оценка:* ${lead.budget}` : null,
    `*Канал связи:* ${lead.contactMethod || lead.messenger || 'WhatsApp'}`,
    lead.comment ? `*Комментарий:* ${lead.comment}` : null,
    '────────────────────────',
    `*Время:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })} (ALMT)`,
    `*ID:* #${lead.id || 'new'}`
  ].filter(Boolean);

  return lines.join('\n');
}

function generateWhatsAppLink(phone, messageText) {
  const clean = cleanPhoneDigits(phone) || DEFAULT_MANAGER_PHONE;
  return `https://wa.me/${clean}?text=${encodeURIComponent(messageText)}`;
}

// === HTTP PROTOCOL UTILITIES ===
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function sendJSON(res, statusCode, payload) {
  applySecurityHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendError(res, statusCode, message, details = null) {
  sendJSON(res, statusCode, {
    success: false,
    error: message,
    statusCode,
    details
  });
}

function parseJSONBody(req, maxSizeBytes = 1048576) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSizeBytes) {
        reject(new Error('Payload Too Large: максимальный размер тела запроса 1 МБ'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Невалидный JSON: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

// === STATIC FILE SERVER ===
async function serveStaticFile(req, res, pathname) {
  let targetPath = pathname;
  if (targetPath === '/' || targetPath === '') {
    targetPath = '/index.html';
  }

  // Prevent directory traversal attacks
  let safeRelPath = path.normalize(decodeURIComponent(targetPath)).replace(/^(\.\.[\/\\])+/, '');
  if (safeRelPath.startsWith(path.sep)) {
    safeRelPath = safeRelPath.slice(1);
  }

  let filePath = path.join(ROOT_DIR, safeRelPath);

  // Verification that target is strictly inside project root
  if (!filePath.startsWith(ROOT_DIR)) {
    sendError(res, 403, 'Доступ запрещен (Path Traversal Protection)');
    return;
  }

  try {
    let stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fsp.stat(filePath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = `W/"${stat.size}-${stat.mtime.getTime()}"`;

    // 304 Not Modified cache check
    if (req.headers['if-none-match'] === etag) {
      applySecurityHeaders(res);
      res.writeHead(304);
      res.end();
      return;
    }

    // Support HTTP Range requests (crucial for PDF catalog streaming)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }

      applySecurityHeaders(res);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': (end - start) + 1,
        'Content-Type': contentType,
        'ETag': etag
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    applySecurityHeaders(res);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'ETag': etag,
      'Cache-Control': (ext === '.html' || ext === '.css' || ext === '.js') ? 'no-cache, must-revalidate' : 'public, max-age=3600',
      'Last-Modified': stat.mtime.toUTCString()
    });

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') {
      sendError(res, 404, `Файл не найден: ${targetPath}`);
    } else {
      console.error('[Static] Error reading file:', err);
      sendError(res, 500, 'Внутренняя ошибка при чтении файла');
    }
  }
}

// === MAIN REQUEST ROUTER ===
async function handleRequest(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const query = Object.fromEntries(reqUrl.searchParams.entries());
  const method = req.method.toUpperCase();

  // CORS Preflight
  if (method === 'OPTIONS') {
    applySecurityHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Rate Limiting on API mutations
  if (pathname.startsWith('/api/') && method === 'POST') {
    if (isRateLimited(clientIp)) {
      sendError(res, 429, 'Слишком много запросов. Пожалуйста, подождите минуту.');
      return;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // 1. GET /api/health — Health check
    // --------------------------------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      const leads = await readLeads();
      const robots = loadRobotsCatalog();
      const mem = process.memoryUsage();

      sendJSON(res, 200, {
        status: 'ok',
        service: `${SITE_CONFIG.brandName} (${SITE_CONFIG.brandShort}) Kazakhstan API`,
        version: '1.0.0',
        uptime: +(process.uptime()).toFixed(2),
        uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        almatyTime: new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }),
        memoryUsageMB: +(mem.rss / 1024 / 1024).toFixed(2),
        stats: {
          totalLeads: leads.length,
          newLeads: leads.filter(l => l.status === 'Новый').length,
          activeRobots: robots.length
        }
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 2. GET /api/robots — Catalog data
    // --------------------------------------------------------------------------
    if (pathname === '/api/robots' && method === 'GET') {
      let catalog = loadRobotsCatalog();

      // Filter by slug (single robot)
      if (query.slug) {
        const found = catalog.find(r => r.slug === query.slug);
        if (found) {
          sendJSON(res, 200, { success: true, robot: found });
        } else {
          sendError(res, 404, `Робот с slug="${query.slug}" не найден`);
        }
        return;
      }

      // Filter by category
      if (query.category || query.cat) {
        const cat = (query.category || query.cat).toLowerCase();
        catalog = catalog.filter(r => r.cat && r.cat.toLowerCase() === cat);
      }

      // Filter by brand
      if (query.brand) {
        const brand = query.brand.toLowerCase();
        catalog = catalog.filter(r => r.brand && r.brand.toLowerCase() === brand);
      }

      // Search query
      if (query.search || query.q) {
        const q = (query.search || query.q).toLowerCase().trim();
        catalog = catalog.filter(r =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.desc && r.desc.toLowerCase().includes(q)) ||
          (r.full_desc && r.full_desc.toLowerCase().includes(q))
        );
      }

      sendJSON(res, 200, {
        status: 'ok',
        success: true,
        total: catalog.length,
        count: catalog.length,
        robots: catalog
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 3. POST /api/leads — Create new lead
    // --------------------------------------------------------------------------
    if (pathname === '/api/leads' && method === 'POST') {
      const body = await parseJSONBody(req);

      // Validation
      const name = String(body.name || '').trim();
      const rawPhone = String(body.phone || '').trim();
      const phoneClean = cleanPhoneDigits(rawPhone);

      if (!name || name.length < 2) {
        sendError(res, 400, 'Поле "name" обязательно (минимум 2 символа)');
        return;
      }

      if (!phoneClean || phoneClean.length < 6) {
        sendError(res, 400, 'Поле "phone" обязательно и должно содержать корректный номер телефона');
        return;
      }

      const leads = await readLeads();
      const leadId = `lead_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const nowIso = new Date().toISOString();

      const newLead = {
        id: leadId,
        name: name,
        phone: formatKazakhstanPhone(rawPhone),
        rawPhone: phoneClean,
        company: String(body.company || '').trim() || 'Частное лицо',
        city: String(body.city || 'Алматы').trim(),
        robots: body.robots || (body.robot ? [body.robot] : []),
        contactMethod: String(body.contactMethod || body.messenger || 'WhatsApp').trim(),
        budget: String(body.budget || '').trim() || 'По запросу',
        comment: String(body.comment || body.notes || '').trim(),
        source: String(body.source || 'website_form').trim(),
        status: 'Новый',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      leads.unshift(newLead);
      await writeLeadsSafely(leads);

      // Generate manager WhatsApp notification link
      const waMessage = formatWhatsAppLeadMessage(newLead);
      const managerWaLink = generateWhatsAppLink(DEFAULT_MANAGER_PHONE, waMessage);

      console.log(`[Lead Created] ID: ${leadId} | Client: ${name} (${newLead.phone}) | City: ${newLead.city}`);

      sendJSON(res, 201, {
        success: true,
        message: `Заявка успешно зарегистрирована в системе ${SITE_CONFIG.brandName}`,
        lead: newLead,
        whatsapp: {
          managerPhone: DEFAULT_MANAGER_PHONE,
          link: managerWaLink,
          messageText: waMessage
        }
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 4. GET /api/leads — Read all leads (CRM listing)
    // --------------------------------------------------------------------------
    if (pathname === '/api/leads' && method === 'GET') {
      const leads = await readLeads();

      let filtered = [...leads];

      if (query.status) {
        filtered = filtered.filter(l => l.status === query.status);
      }

      if (query.city) {
        const cityQ = query.city.toLowerCase();
        filtered = filtered.filter(l => l.city && l.city.toLowerCase() === cityQ);
      }

      const limit = query.limit ? parseInt(query.limit, 10) : 100;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;
      const paginated = filtered.slice(offset, offset + limit);

      sendJSON(res, 200, {
        success: true,
        total: leads.length,
        filteredCount: filtered.length,
        limit,
        offset,
        leads: paginated
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 5. POST /api/leads/:id/status — Update lead status
    // --------------------------------------------------------------------------
    const statusMatch = pathname.match(/^\/api\/leads\/([a-zA-Z0-9_-]+)\/status$/);
    if (statusMatch && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      const leadId = statusMatch[1];
      const body = await parseJSONBody(req);
      const newStatus = String(body.status || '').trim();

      if (!VALID_STATUSES.includes(newStatus)) {
        sendError(res, 400, `Недопустимый статус. Разрешенные значения: ${VALID_STATUSES.join(', ')}`);
        return;
      }

      const leads = await readLeads();
      const leadIndex = leads.findIndex(l => l.id === leadId);

      if (leadIndex === -1) {
        sendError(res, 404, `Лид с ID "${leadId}" не найден`);
        return;
      }

      leads[leadIndex].status = newStatus;
      leads[leadIndex].updatedAt = new Date().toISOString();
      if (body.comment) {
        leads[leadIndex].managerNotes = String(body.comment);
      }

      await writeLeadsSafely(leads);
      console.log(`[Lead Status Updated] ID: ${leadId} -> ${newStatus}`);

      sendJSON(res, 200, {
        success: true,
        message: `Статус лида обновлен на "${newStatus}"`,
        lead: leads[leadIndex]
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 6. POST /api/whatsapp/link — Dynamic WhatsApp Link Generator
    // --------------------------------------------------------------------------
    if (pathname === '/api/whatsapp/link' && method === 'POST') {
      const body = await parseJSONBody(req);
      const leadData = body.lead || body;
      const targetPhone = cleanPhoneDigits(body.phone || body.managerPhone || DEFAULT_MANAGER_PHONE);

      let messageText = '';
      if (typeof body.text === 'string' && body.text.trim()) {
        messageText = body.text.trim();
      } else {
        messageText = formatWhatsAppLeadMessage(leadData);
      }

      const waUrl = generateWhatsAppLink(targetPhone, messageText);

      sendJSON(res, 200, {
        success: true,
        url: waUrl,
        messageText: messageText,
        targetPhone: targetPhone
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 7. GET /crm or /admin — Mini CRM Web Interface
    // --------------------------------------------------------------------------
    if ((pathname === '/crm' || pathname === '/admin') && method === 'GET') {
      try {
        const content = await fsp.readFile(CRM_FILE, 'utf8');
        applySecurityHeaders(res);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
        return;
      } catch (err) {
        sendError(res, 500, 'Не удалось загрузить CRM-интерфейс');
        return;
      }
    }

    // --------------------------------------------------------------------------
    // 8. Static File Serving (HTML, CSS, JS, Assets, PDF)
    // --------------------------------------------------------------------------
    if (method === 'GET' || method === 'HEAD') {
      await serveStaticFile(req, res, pathname);
      return;
    }

    // Method not allowed
    sendError(res, 405, `Метод ${method} не поддерживается для пути ${pathname}`);

  } catch (err) {
    console.error(`[Unhandled Server Error] ${method} ${pathname}:`, err);
    sendError(res, 500, 'Внутренняя ошибка сервера', err.message);
  }
}

// Create HTTP server instance
function createServer() {
  return http.createServer(handleRequest);
}

// Start server when executed directly
if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, async () => {
    await ensureDataDir();
    const networkInterfaces = os.networkInterfaces();
    const localIps = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIps.push(net.address);
        }
      }
    }

    console.log('============================================================');
    console.log(`[ORDA] Robotics Kazakhstan Server is running!`);
    console.log(`[URL] Localhost:   http://localhost:${PORT}`);
    localIps.forEach(ip => {
      console.log(`[NET] С телефона (Wi-Fi): http://${ip}:${PORT}`);
    });
    console.log(`[CRM] CRM Panel:   http://localhost:${PORT}/crm`);
    console.log(`[API] Health:      http://localhost:${PORT}/api/health`);
    console.log(`[API] Robots:      http://localhost:${PORT}/api/robots`);
    console.log(`[DATA] Leads DB:   ${LEADS_FILE}`);
    console.log('============================================================');
  });

  function handleShutdown(signal) {
    console.log(`\n[Server] Получен сигнал ${signal}. Завершение работы...`);
    server.close(() => {
      console.log('[Server] Все соединения закрыты. Сервер остановлен.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[Server] Принудительное завершение.');
      process.exit(1);
    }, 5000).unref();
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = { createServer, handleRequest };
