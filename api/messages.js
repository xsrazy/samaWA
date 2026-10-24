const crypto = require('crypto');
const { loadDoc, withDoc, send, cleanText, filterBad, rateLimit, ipOf, readJson } = require('./_lib');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const doc = await loadDoc();
      return send(res, 200, { messages: doc.messages.slice(-80) });
    }
    if (req.method === 'POST') {
      if (!rateLimit('msg:' + ipOf(req), 60, 3600e3)) return send(res, 429, { error: 'rate limited' });
      const body = await readJson(req);
    if (!body) return send(res, 400, { error: 'body tidak valid' });
      const name = filterBad(cleanText(body.name, 40));
      const text = filterBad(cleanText(body.text, 500));
      if (!name || !text) return send(res, 400, { error: 'nama dan pesan wajib diisi' });
      // id is fixed per request so a withDoc retry never appends twice
      const m = { id: 'm' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'), name, text, ts: Date.now() };
      const msg = await withDoc((doc) => {
        const exists = doc.messages.some((x) => x.id === m.id);
        if (!exists) {
          doc.messages.push(m);
          if (doc.messages.length > 400) doc.messages = doc.messages.slice(-400);
        }
        return { mutated: !exists, value: m };
      });
      return send(res, 201, { ok: true, message: msg });
    }
    send(res, 405, { error: 'method' });
  } catch (e) { send(res, 500, { error: 'messages failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
