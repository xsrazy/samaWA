// samaWA backend library: private Blob JSON doc + scrypt/JWT admin auth.
// Data model is conversation-based (script bubbles, poll votes, group messages),
// intentionally different from the section/settings model of the older sites.
const crypto = require('crypto');

const BLOB_API = 'https://vercel.com/api/blob/';
const DB_PREFIX = 'samawa-db-';

function blobToken() {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error('BLOB_READ_WRITE_TOKEN missing');
  return t;
}
const blobHeaders = () => ({ authorization: `Bearer ${blobToken()}`, 'x-api-version': '11' });

// Versioned immutable docs (samawa-db-<ts>-<rand>.json); reads take the newest
// version, so a stale cached copy can never shadow fresh data.
async function blobListVersions() {
  const res = await fetch(`${BLOB_API}?prefix=${DB_PREFIX}&limit=100`, { headers: blobHeaders() });
  if (!res.ok) throw new Error('blob list failed: ' + res.status);
  const list = await res.json();
  return (list.blobs || [])
    .filter((b) => b.pathname.startsWith(DB_PREFIX))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

async function blobWriteVersion(text) {
  const pathname = `${DB_PREFIX}${Date.now()}-${crypto.randomBytes(3).toString('hex')}.json`;
  const res = await fetch(`${BLOB_API}?pathname=${encodeURIComponent(pathname)}`, {
    method: 'PUT',
    headers: {
      ...blobHeaders(),
      'x-vercel-blob-access': 'private',
      'x-content-type': 'application/json',
      'x-add-random-suffix': '0',
      'x-cache-control-max-age': '0',
    },
    body: text,
  });
  if (!res.ok) throw new Error('blob put failed: ' + res.status);
  const out = await res.json().catch(() => ({}));
  return { ...out, pathname };
}

async function blobDelete(urls) {
  if (!urls.length) return;
  try {
    await fetch(`${BLOB_API}delete`, {
      method: 'POST',
      headers: { ...blobHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
  } catch { /* best effort */ }
}

function docShapeOk(doc) {
  return doc && doc.settings && Array.isArray(doc.script) && Array.isArray(doc.votes) && Array.isArray(doc.messages) && doc.admin;
}

async function loadDocVersioned() {
  const versions = await blobListVersions();
  if (versions.length === 0) return { doc: null, version: null };
  let lastErr = null;
  for (const blob of versions.slice(0, 3)) {
    try {
      const res = await fetch(blob.url, { headers: { ...blobHeaders(), 'cache-control': 'no-cache' }, cache: 'no-store' });
      if (!res.ok) throw new Error('blob get failed: ' + res.status);
      const doc = JSON.parse(await res.text());
      if (!docShapeOk(doc)) throw new Error('doc shape invalid');
      return { doc, version: blob.pathname };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('doc unreadable');
}

async function saveDoc(doc) {
  const res = await blobWriteVersion(JSON.stringify(doc));
  const versions = await blobListVersions().catch(() => []);
  if (versions.length > 2) await blobDelete(versions.slice(2).map((b) => b.url));
  return (res && res.pathname) || null;
}

// ---------- password / jwt ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  try {
    const [, salt, hash] = String(stored).split('$');
    const calc = crypto.scryptSync(pw, salt, 64);
    return crypto.timingSafeEqual(calc, Buffer.from(hash, 'hex'));
  } catch { return false; }
}
function b64u(x) { return Buffer.from(x).toString('base64url'); }
function signJwt(payload) {
  const secret = process.env.AUTH_SECRET;
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  try {
    const [head, body, sig] = String(token).split('.');
    const want = crypto.createHmac('sha256', process.env.AUTH_SECRET).update(`${head}.${body}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function adminToken(doc) {
  return signJwt({ sub: 'admin', tv: doc.tokenVersion, exp: Date.now() + 7 * 24 * 3600 * 1000 });
}
function requireAdmin(req, doc) {
  const h = req.headers.authorization || '';
  const payload = verifyJwt(h.replace(/^Bearer\s+/i, ''));
  if (!payload || payload.tv !== doc.tokenVersion) return false;
  return true;
}

// ---------- doc ----------
function seedDoc() {
  const email = process.env.ADMIN_EMAIL || 'usra@xsrazy.web.id';
  const seedPw = process.env.ADMIN_PASSWORD || 'change-me-on-first-login';
  return {
    v: 1, rev: 1, tokenVersion: 1,
    admin: { email, pass: hashPassword(seedPw) },
    settings: {
      groom: 'Usra', bride: 'Zee',
      groomFull: 'Rahmatul Usra', brideFull: 'Azizi Asadel',
      dateLabel: 'Senin, 17 Januari 2050', dateISO: '2050-01-17T03:00:00.000Z',
      akad: '10.00 WIB', resepsi: '13.00 WIB',
      venue: 'Jam Gadang', venueAddr: 'Benteng Pasar Atas, Bukittinggi',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Jam+Gadang+Bukittinggi',
      verse: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang. (QS. Ar-Rum: 21)',
      music: '/assets/music/sound.mp3', photo: '/assets/img/couple.webp',
      groupName: 'Resepsi Usra & Zee',
      gift: [
        { bank: 'SeaBank', num: '123456784848', name: 'Rahmatul Usra' },
        { bank: 'DANA', num: '081234561748', name: 'Rahmatul Usra' },
      ],
    },
    script: [
      { id: 's1', kind: 'text', text: 'Assalamualaikum Warahmatullahi Wabarakatuh' },
      { id: 's2', kind: 'text', text: 'Halo {nama}! Dengan memohon rahmat dan ridha Allah SWT, kami punya kabar bahagia dan mau mengundang kamu ke pernikahan kami.' },
      { id: 's3', kind: 'photo', src: '/assets/img/couple.webp', caption: 'Usra & Zee' },
      { id: 's4', kind: 'text', text: 'Rahmatul Usra dengan Azizi Asadel (Zee). Ijab kabul dan resepsi akan digelar Senin, 17 Januari 2050 di Jam Gadang, Bukittinggi.' },
      { id: 's5', kind: 'countdown' },
      { id: 's6', kind: 'text', text: 'Akad nikah jam 10.00 WIB, resepsi jam 13.00 WIB. Datang ya, kehadiran kamu sangat berarti buat kami.' },
      { id: 's7', kind: 'location' },
      { id: 's8', kind: 'verse' },
      { id: 's9', kind: 'voice', caption: 'Dengerin dulu pesan suara dari kami' },
      { id: 's10', kind: 'gift' },
      { id: 's11', kind: 'poll' },
      { id: 's12', kind: 'group' },
      { id: 's13', kind: 'text', text: 'Terima kasih banyak. Wassalamualaikum Warahmatullahi Wabarakatuh. Kami yang berbahagia, Usra & Zee.' },
    ],
    poll: { question: 'Insya Allah bisa hadir?', options: ['Hadir', 'Berhalangan', 'Masih Ragu'] },
    votes: [],
    messages: [],
  };
}

async function loadDoc() {
  const { doc } = await loadDocVersioned();
  if (doc) return doc;
  const fresh = seedDoc();
  await saveDoc(fresh);
  return fresh;
}

// Serialized read-modify-write with optimistic concurrency: if another
// writer saved a newer version in the meantime, re-apply on the fresh doc.
// The pre-save check narrows the race, but two writers that both pass it
// before either saves would still lose one mutation, so the save is verified
// afterwards too: if our version is no longer newest, retry on top of it.
// (Callers must be idempotent: votes upsert by key, messages dedupe by id,
// content replaces fields, deletes filter by id, password has a landed-guard.)
async function withDoc(fn) {
  for (let i = 0; i < 6; i++) {
    const { doc, version } = await loadDocVersioned();
    const current = doc || seedDoc();
    const out = await fn(current);
    if (!out || !out.mutated) return out ? out.value : undefined;
    const now = await blobListVersions().catch(() => null);
    const newest = now && now.length ? now[0].pathname : null;
    if (newest !== version && !(version === null && newest === null)) continue; // lost race, retry
    current.rev = (current.rev || 1) + 1;
    const savedPath = await saveDoc(current);
    if (savedPath) {
      const after = await blobListVersions().catch(() => null);
      const newestAfter = after && after.length ? after[0].pathname : null;
      if (newestAfter && newestAfter !== savedPath) continue; // another writer landed after our check, retry
    }
    return out.value;
  }
  throw new Error('withDoc contention');
}

// ---------- helpers ----------
function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanMultiline(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim().slice(0, max);
}
const BAD = ['anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'tolol', 'goblok', 'jancok', 'asu', 'babi'];
function filterBad(text) {
  let out = text;
  for (const w of BAD) out = out.replace(new RegExp('\\b' + w + '\\b', 'gi'), '***');
  return out;
}
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now); hits.set(key, arr);
  return true;
}
function ipOf(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}
async function readJson(req) {
  try { if (typeof req.body === 'object' && req.body) return req.body; } catch { return null; } // Vercel parses req.body lazily and throws on malformed JSON
  const raw = await new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); });
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
function pollCounts(doc) {
  const counts = doc.poll.options.map(() => 0);
  for (const v of doc.votes) if (counts[v.choice] != null) counts[v.choice]++;
  return counts;
}
function publicState(doc) {
  return {
    settings: doc.settings,
    script: doc.script,
    poll: { question: doc.poll.question, options: doc.poll.options, counts: pollCounts(doc), total: doc.votes.length },
    group: {
      name: doc.settings.groupName,
      members: new Set(doc.messages.map((m) => m.name.toLowerCase())).size,
      count: doc.messages.length,
    },
  };
}

module.exports = { loadDoc, withDoc, verifyPassword, hashPassword, adminToken, requireAdmin, cleanText, cleanMultiline, filterBad, rateLimit, ipOf, send, pollCounts, publicState, readJson };
