const { loadDoc, send, verifyPassword, adminToken, rateLimit, ipOf } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!rateLimit('login:' + ipOf(req), 10, 900e3)) return send(res, 429, { error: 'terlalu banyak percobaan' });
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(await readBody(req) || '{}');
    const doc = await loadDoc();
    const email = String(body.email || '').trim().toLowerCase();
    if (email !== doc.admin.email || !verifyPassword(String(body.password || ''), doc.admin.pass))
      return send(res, 401, { error: 'email atau password salah' });
    send(res, 200, { token: adminToken(doc) });
  } catch (e) { send(res, 500, { error: 'login failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
