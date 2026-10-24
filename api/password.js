const { withDoc, send, requireAdmin, verifyPassword, hashPassword, adminToken, rateLimit, ipOf, readJson } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!rateLimit('pw:' + ipOf(req), 10, 900e3)) return send(res, 429, { error: 'terlalu banyak percobaan' });
  try {
    const body = await readJson(req);
    if (!body) return send(res, 400, { error: 'body tidak valid' });
    const out = await withDoc((doc) => {
      if (!requireAdmin(req, doc)) return { value: { error: 'unauthorized' } };
      if (!verifyPassword(String(body.current || ''), doc.admin.pass)) {
        // idempotency: this exact change already landed on an earlier attempt
        if (verifyPassword(String(body.next || ''), doc.admin.pass)) return { mutated: false, value: { ok: true, token: adminToken(doc) } };
        return { value: { error: 'password lama salah' } };
      }
      const next = String(body.next || '');
      if (next.length < 8) return { value: { error: 'password baru minimal 8 karakter' } };
      doc.admin.pass = hashPassword(next);
      doc.tokenVersion += 1;
      return { mutated: true, value: { ok: true, token: adminToken(doc) } };
    });
    if (out && out.error) return send(res, out.error === 'unauthorized' ? 401 : 400, out);
    send(res, 200, out);
  } catch (e) { send(res, 500, { error: 'password failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
