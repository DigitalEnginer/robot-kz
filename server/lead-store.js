/**
 * Lead storage + notifications for ORDA ROBOTICS.
 *
 * Storage:
 *   - Supabase (Postgres) when SUPABASE_SERVICE_ROLE_KEY is set — durable, used in production.
 *   - Fallback: the existing JSON file store (local dev / tests), passed in as `fileStore`.
 * Notifications:
 *   - Telegram message on every new lead when TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set.
 *
 * Zero dependencies: uses the global fetch of Node 18+.
 */

const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://vjwloufzaecnzdmpakez.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_API_URL = String(process.env.TELEGRAM_API_URL || 'https://api.telegram.org').replace(/\/+$/, '');
const TIMEOUT_MS = 6000;

const dbEnabled = () => Boolean(SUPABASE_KEY);
const telegramEnabled = () => Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

// --- row <-> lead mapping -------------------------------------------------
function toRow(lead) {
  return {
    id: lead.id,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    status: lead.status,
    name: lead.name,
    phone: lead.phone,
    raw_phone: lead.rawPhone || null,
    company: lead.company || null,
    city: lead.city || null,
    robots: Array.isArray(lead.robots) ? lead.robots : (lead.robots ? [lead.robots] : []),
    contact_method: lead.contactMethod || null,
    budget: lead.budget || null,
    comment: lead.comment || null,
    manager_notes: lead.managerNotes || null,
    source: lead.source || null,
    source_url: lead.sourceUrl || null,
    ip: lead.ip || null,
    user_agent: lead.userAgent || null
  };
}

function fromRow(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    rawPhone: r.raw_phone || '',
    company: r.company || '',
    city: r.city || '',
    robots: r.robots || [],
    contactMethod: r.contact_method || '',
    budget: r.budget || '',
    comment: r.comment || '',
    managerNotes: r.manager_notes || undefined,
    source: r.source || '',
    sourceUrl: r.source_url || '',
    status: r.status,
    ip: r.ip || '',
    userAgent: r.user_agent || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

// --- Supabase REST (PostgREST) ---------------------------------------------
async function sb(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${pathAndQuery.split('?')[0]} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return { data: text ? JSON.parse(text) : null, headers: res.headers };
}

const totalFromRange = (headers) => {
  const m = String(headers.get('content-range') || '').match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

async function dbCreate(lead) {
  const { data } = await sb('leads', { method: 'POST', body: toRow(lead), prefer: 'return=representation' });
  return fromRow(Array.isArray(data) ? data[0] : data);
}

async function dbList({ status, city, limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const filters = [];
  if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
  if (city) filters.push(`city=ilike.${encodeURIComponent(city)}`);
  const qs = ['select=*', 'order=created_at.desc', `limit=${lim}`, `offset=${off}`, ...filters].join('&');
  const page = await sb(`leads?${qs}`, { prefer: 'count=exact' });
  const filteredCount = totalFromRange(page.headers) ?? page.data.length;
  let total = filteredCount;
  if (filters.length) {
    const all = await sb('leads?select=id&limit=1', { prefer: 'count=exact' });
    total = totalFromRange(all.headers) ?? filteredCount;
  }
  return { total, filteredCount, limit: lim, offset: off, leads: page.data.map(fromRow) };
}

async function dbUpdateStatus(id, status, comment) {
  const patch = { status, updated_at: new Date().toISOString() };
  if (comment) patch.manager_notes = String(comment);
  const { data } = await sb(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  return Array.isArray(data) && data[0] ? fromRow(data[0]) : null;
}

async function dbStats() {
  const all = await sb('leads?select=id&limit=1', { prefer: 'count=exact' });
  const fresh = await sb(`leads?select=id&limit=1&status=eq.${encodeURIComponent('Новый')}`, { prefer: 'count=exact' });
  return { totalLeads: totalFromRange(all.headers) ?? 0, newLeads: totalFromRange(fresh.headers) ?? 0 };
}

// --- Telegram ---------------------------------------------------------------
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function telegramText(lead, brand) {
  const robots = Array.isArray(lead.robots) && lead.robots.length
    ? lead.robots.map(r => `• ${esc(typeof r === 'object' ? r.name : r)}`).join('\n')
    : '• не выбрано';
  const phoneDigits = String(lead.rawPhone || '').replace(/\D/g, '');
  return [
    `🤖 <b>Новая заявка — ${esc(brand)}</b>`,
    '',
    `<b>Имя:</b> ${esc(lead.name)}`,
    `<b>Телефон:</b> ${esc(lead.phone)}`,
    lead.company ? `<b>Компания:</b> ${esc(lead.company)}` : null,
    `<b>Город:</b> ${esc(lead.city)}`,
    `<b>Связь:</b> ${esc(lead.contactMethod)}`,
    '',
    '<b>Интересует:</b>',
    robots,
    lead.comment ? `\n<b>Комментарий:</b> ${esc(lead.comment)}` : null,
    phoneDigits ? `\n<a href="https://wa.me/${phoneDigits}">Написать клиенту в WhatsApp</a>` : null,
    `<i>ID: ${esc(lead.id)}</i>`
  ].filter(v => v !== null).join('\n');
}

async function notifyTelegram(lead, brand = 'ORDA ROBOTICS') {
  if (!telegramEnabled()) return { sent: false, reason: 'not_configured' };
  try {
    const res = await fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramText(lead, brand),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[Telegram] HTTP ${res.status}: ${t.slice(0, 200)}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[Telegram] Error:', err.message);
    return { sent: false, reason: 'network' };
  }
}

// --- Public API with file fallback -------------------------------------------
function createLeadStore(fileStore) {
  return {
    mode: () => (dbEnabled() ? 'supabase' : 'file'),
    telegram: () => telegramEnabled(),

    async create(lead) {
      if (dbEnabled()) {
        try {
          return { lead: await dbCreate(lead), storage: 'supabase' };
        } catch (err) {
          console.error('[Storage] Supabase insert failed, falling back to file:', err.message);
        }
      }
      const leads = await fileStore.read();
      leads.unshift(lead);
      await fileStore.write(leads);
      return { lead, storage: 'file' };
    },

    async list(q = {}) {
      if (dbEnabled()) return dbList(q);
      const leads = await fileStore.read();
      let filtered = [...leads];
      if (q.status) filtered = filtered.filter(l => l.status === q.status);
      if (q.city) filtered = filtered.filter(l => l.city && l.city.toLowerCase() === String(q.city).toLowerCase());
      const limit = q.limit ? parseInt(q.limit, 10) : 100;
      const offset = q.offset ? parseInt(q.offset, 10) : 0;
      return { total: leads.length, filteredCount: filtered.length, limit, offset, leads: filtered.slice(offset, offset + limit) };
    },

    async updateStatus(id, status, comment) {
      if (dbEnabled()) return dbUpdateStatus(id, status, comment);
      const leads = await fileStore.read();
      const idx = leads.findIndex(l => l.id === id);
      if (idx === -1) return null;
      leads[idx].status = status;
      leads[idx].updatedAt = new Date().toISOString();
      if (comment) leads[idx].managerNotes = String(comment);
      await fileStore.write(leads);
      return leads[idx];
    },

    async stats() {
      if (dbEnabled()) {
        try { return await dbStats(); } catch (err) { console.error('[Storage] stats:', err.message); return { totalLeads: null, newLeads: null }; }
      }
      const leads = await fileStore.read();
      return { totalLeads: leads.length, newLeads: leads.filter(l => l.status === 'Новый').length };
    },

    notify: notifyTelegram
  };
}

module.exports = { createLeadStore, telegramText };
