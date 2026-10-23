const { loadDoc, withDoc, send, cleanText, filterBad, rateLimit, ipOf } = require('./_lib');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const doc = await loadDoc();
      return send(res, 200, { messages: doc.messages.slice(-80) });
    }
    if (req.method === 'POST') {
      if (!rateLimit('msg:' + ipOf(req), 30, 3600e3)) return send(res, 429, { error: 'rate limited' });
      const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(await readBody(req) || '{}');
      const name = filterBad(cleanText(body.name, 40));
      const text = filterBad(cleanText(body.text, 500));
      if (!name || !text) return send(res, 400, { error: 'nama dan pesan wajib diisi' });
      const msg = await withDoc((doc) => {
        const m = { id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name, text, ts: Date.now() };
        doc.messages.push(m);
        if (doc.messages.length > 400) doc.messages = doc.messages.slice(-400);
        return { mutated: true, value: m };
      });
      return send(res, 201, { ok: true, message: msg });
    }
    send(res, 405, { error: 'method' });
  } catch (e) { send(res, 500, { error: 'messages failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
