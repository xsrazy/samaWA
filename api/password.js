const { withDoc, send, requireAdmin, verifyPassword, hashPassword, adminToken } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(await readBody(req) || '{}');
    const out = await withDoc((doc) => {
      if (!requireAdmin(req, doc)) return { value: { error: 'unauthorized' } };
      if (!verifyPassword(String(body.current || ''), doc.admin.pass)) return { value: { error: 'password lama salah' } };
      const next = String(body.next || '');
      if (next.length < 8) return { value: { error: 'password baru minimal 8 karakter' } };
      doc.admin.pass = hashPassword(next);
      doc.tokenVersion += 1;
      return { mutated: true, value: { ok: true, token: adminToken(doc) } };
    });
    if (out && out.error) return send(res, 400, out);
    send(res, 200, out);
  } catch (e) { send(res, 500, { error: 'password failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
