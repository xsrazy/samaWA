const { withDoc, send, requireAdmin, cleanText, cleanMultiline, readJson } = require('./_lib');
const SETTING_KEYS = ['groom', 'bride', 'groomFull', 'brideFull', 'dateLabel', 'dateISO', 'akad', 'resepsi', 'venue', 'venueAddr', 'mapsUrl', 'verse', 'groupName'];
const KINDS = ['text', 'photo', 'countdown', 'location', 'verse', 'voice', 'gift', 'poll', 'group'];
module.exports = async (req, res) => {
  if (req.method !== 'PATCH') return send(res, 405, { error: 'method' });
  try {
    const body = await readJson(req);
    if (!body) return send(res, 400, { error: 'body tidak valid' });
    const out = await withDoc((doc) => {
      if (!requireAdmin(req, doc)) return { value: { error: 'unauthorized' } };
      if (body.settings) {
        for (const k of SETTING_KEYS) { if (typeof body.settings[k] !== 'string') continue; if (k === 'dateISO' && isNaN(Date.parse(body.settings[k]))) continue; doc.settings[k] = cleanMultiline(body.settings[k], k === 'verse' ? 600 : 160); }
        if (Array.isArray(body.settings.gift)) {
          doc.settings.gift = body.settings.gift.slice(0, 4).map((g) => ({
            bank: cleanText(g.bank, 30), num: cleanText(g.num, 30), name: cleanText(g.name, 60),
          })).filter((g) => g.bank && g.num);
        }
      }
      if (Array.isArray(body.script)) {
        doc.script = body.script.slice(0, 30).map((s, i) => {
          const item = { id: cleanText(s.id || 's' + i, 20), kind: KINDS.includes(s.kind) ? s.kind : 'text' };
          if (typeof s.text === 'string') item.text = cleanMultiline(s.text, 800);
          if (typeof s.caption === 'string') item.caption = cleanMultiline(s.caption, 200);
          if (typeof s.src === 'string' && s.src.startsWith('/assets/')) item.src = s.src;
          return item;
        });
      }
      if (body.poll && typeof body.poll.question === 'string') doc.poll.question = cleanText(body.poll.question, 120);
      return { mutated: true, value: { ok: true } };
    });
    if (out && out.error) return send(res, 401, out);
    send(res, 200, out);
  } catch (e) { send(res, 500, { error: 'content failed' }); }
};
function readBody(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); }); }
