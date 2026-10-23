const { loadDoc, send, requireAdmin, pollCounts } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const doc = await loadDoc();
    if (!requireAdmin(req, doc)) return send(res, 401, { error: 'unauthorized' });
    send(res, 200, {
      settings: doc.settings, script: doc.script,
      poll: { question: doc.poll.question, options: doc.poll.options, counts: pollCounts(doc), total: doc.votes.length },
      votes: doc.votes.slice().sort((a, b) => b.ts - a.ts),
      messages: doc.messages.slice().reverse(),
    });
  } catch (e) { send(res, 500, { error: 'admin failed' }); }
};
