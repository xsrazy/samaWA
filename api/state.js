const { loadDoc, send, publicState } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const doc = await loadDoc();
    send(res, 200, publicState(doc));
  } catch (e) { send(res, 500, { error: 'state failed' }); }
};
