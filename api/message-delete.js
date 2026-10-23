const { withDoc, send, requireAdmin } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return send(res, 405, { error: 'method' });
  try {
    const id = (req.url.split('id=')[1] || '').split('&')[0];
    const out = await withDoc((doc) => {
      if (!requireAdmin(req, doc)) return { value: { error: 'unauthorized' } };
      const before = doc.messages.length;
      doc.messages = doc.messages.filter((m) => m.id !== id);
      return { mutated: doc.messages.length !== before, value: { ok: true, removed: before - doc.messages.length } };
    });
    if (out && out.error) return send(res, 401, out);
    send(res, 200, out);
  } catch (e) { send(res, 500, { error: 'delete failed' }); }
};
