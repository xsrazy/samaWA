const { withDoc, send, cleanText, filterBad, rateLimit, ipOf, pollCounts, readJson } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!rateLimit('rsvp:' + ipOf(req), 40, 3600e3)) return send(res, 429, { error: 'rate limited' });
  try {
    const body = await readJson(req);
    if (!body) return send(res, 400, { error: 'body tidak valid' });
    const guest = filterBad(cleanText(body.guest, 40));
    const choice = Number(body.choice);
    if (!guest) return send(res, 400, { error: 'nama kosong' });
    const out = await withDoc((doc) => {
      if (!Number.isInteger(choice) || choice < 0 || choice >= doc.poll.options.length)
        return { value: { error: 'pilihan tidak valid' }, bad: true };
      const key = guest.toLowerCase();
      const ix = doc.votes.findIndex((v) => v.key === key);
      const rec = { key, guest, choice, ts: Date.now() };
      if (ix >= 0) doc.votes[ix] = rec; else doc.votes.push(rec);
      return { mutated: true, value: { ok: true, counts: pollCounts(doc), total: doc.votes.length, yourChoice: choice } };
    });
    if (out && out.error) return send(res, 400, out);
    send(res, 200, out);
  } catch (e) { send(res, 500, { error: 'rsvp failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
