// samaWA admin: WhatsApp Web style inbox (RSVP threads, group, script editor, settings).
const $ = (s) => document.querySelector(s);
const state = { token: localStorage.getItem('samawa_admin') || '', data: null, mod: 'rsvp' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2400); }
function fmt(ts) { const d = new Date(ts); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
async function api(path, opts) {
  const res = await fetch(path, { ...(opts || {}), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + state.token, ...((opts && opts.headers) || {}) } });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error(out.error || 'gagal');
  return out;
}
function logout() { state.token = ''; localStorage.removeItem('samawa_admin'); $('#admin-view').classList.add('hidden'); $('#login-view').classList.remove('hidden'); }

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-err').textContent = '';
  try {
    const res = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('#login-email').value, password: $('#login-pass').value }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'login gagal');
    state.token = out.token; localStorage.setItem('samawa_admin', out.token);
    enter();
  } catch (err) { $('#login-err').textContent = err.message; }
});
$('#logout').onclick = logout;
document.querySelectorAll('.thread-item').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.thread-item').forEach((x) => x.classList.remove('active'));
  b.classList.add('active'); state.mod = b.dataset.mod; render();
});

async function enter() {
  $('#login-view').classList.add('hidden');
  $('#admin-view').classList.remove('hidden');
  await refresh();
}
async function refresh() {
  state.data = await api('/api/admin');
  const d = state.data;
  $('#t-rsvp').textContent = d.votes.length ? `Terbaru: ${d.votes[0].guest} memilih ${d.poll.options[d.votes[0].choice]}` : 'Belum ada suara masuk';
  $('#c-rsvp').textContent = d.poll.total || '';
  $('#t-grup').textContent = d.messages.length ? `${d.messages[0].name}: ${d.messages[0].text}` : 'Belum ada pesan';
  $('#c-grup').textContent = d.messages.length || '';
  render();
}
function head(title, extra) { return `<div class="pane-head"><h2>${title}</h2><span class="sp"></span>${extra || ''}</div>`; }
const CHOICE_COLORS = ['#00a884', '#c62828', '#f9a825'];

function render() {
  const d = state.data; if (!d) return;
  const pane = $('#pane');
  if (state.mod === 'rsvp') {
    const chips = d.poll.options.map((o, i) => `<div class="chip"><b style="color:${CHOICE_COLORS[i]}">${d.poll.counts[i]}</b>${esc(o)}</div>`).join('');
    const rows = d.votes.map((v) => `<tr><td>${esc(v.guest)}</td><td><span class="dot" style="background:${CHOICE_COLORS[v.choice]}"></span>${esc(d.poll.options[v.choice])}</td><td>${fmt(v.ts)}</td></tr>`).join('');
    pane.innerHTML = head('Polling RSVP', '<button class="btn ghost" id="rf">Muat ulang</button>') +
      `<div class="chips">${chips}<div class="chip"><b>${d.poll.total}</b>Total suara</div></div>` +
      `<div class="card"><div style="font-weight:600;margin-bottom:6px">${esc(d.poll.question)}</div><table><tr><th>Tamu</th><th>Pilihan</th><th>Waktu</th></tr>${rows || '<tr><td colspan="3">Belum ada suara masuk.</td></tr>'}</table></div>`;
    $('#rf').onclick = refresh;
  }
  if (state.mod === 'grup') {
    const rows = d.messages.map((m) => `<div class="msg-row"><div class="m-main"><b>${esc(m.name)}</b> <small>${fmt(m.ts)}</small><p>${esc(m.text)}</p></div><button class="del" data-del="${m.id}">Hapus</button></div>`).join('');
    pane.innerHTML = head('Grup Resepsi', '<button class="btn ghost" id="rf">Muat ulang</button>') +
      `<div class="card">${rows || '<p style="color:var(--muted)">Belum ada pesan di grup.</p>'}</div>`;
    $('#rf').onclick = refresh;
    pane.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Yakin hapus?'; setTimeout(() => { b.classList.remove('confirm'); b.textContent = 'Hapus'; }, 2600); return; }
      await api('/api/message-delete?id=' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
      toast('Pesan dihapus'); refresh();
    });
  }
  if (state.mod === 'naskah') {
    const KINDS = { text: 'Teks', photo: 'Foto', countdown: 'Hitung Mundur', location: 'Lokasi', verse: 'Ayat', voice: 'Voice Note', gift: 'Amplop', poll: 'Polling RSVP', group: 'Kartu Grup' };
    const items = d.script.map((s, i) => {
      const editable = s.kind === 'text' || s.kind === 'verse';
      const capEditable = s.kind === 'photo' || s.kind === 'voice';
      let mid;
      if (editable) mid = `<textarea data-f="text" data-i="${i}">${esc(s.text || '')}</textarea>`;
      else if (capEditable) mid = `<span style="flex:1;display:flex;flex-direction:column;gap:6px"><span class="fixed-note">${s.kind === 'photo' ? 'Foto mempelai (selalu tampil utuh)' : 'Voice note berisi lagu pengantar'}</span><input data-f="caption" data-i="${i}" value="${esc(s.caption || '')}" placeholder="Caption" style="border:1px solid #d1d7db;border-radius:8px;padding:8px 10px"></span>`;
      else mid = `<span class="fixed-note">Blok otomatis dari Pengaturan (tanggal, lokasi, amplop, polling, grup).</span>`;
      const srcSel = s.kind === 'photo' ? `<select data-f="src" data-i="${i}"><option value="/assets/img/couple.webp" ${s.src === '/assets/img/couple.webp' || !s.src ? 'selected' : ''}>Berdua</option><option value="/assets/img/groom.webp" ${s.src === '/assets/img/groom.webp' ? 'selected' : ''}>Usra</option><option value="/assets/img/bride.webp" ${s.src === '/assets/img/bride.webp' ? 'selected' : ''}>Zee</option></select>` : '';
      return `<div class="script-item"><span class="kind">${KINDS[s.kind] || s.kind}</span>${mid}${srcSel}<span class="s-btns"><button data-mv="-1" data-i="${i}" title="Naik">&#8593;</button><button data-mv="1" data-i="${i}" title="Turun">&#8595;</button><button data-rm="${i}" title="Hapus">&#10005;</button></span></div>`;
    }).join('');
    pane.innerHTML = head('Naskah Undangan', '<button class="btn" id="save-script">Simpan Naskah</button>') +
      `<div class="card" style="display:flex;gap:10px;align-items:center"><b style="font-size:14.5px">Tambah bubble:</b><select id="add-kind"><option value="text">Teks</option><option value="photo">Foto</option><option value="voice">Voice Note</option><option value="countdown">Hitung Mundur</option><option value="location">Lokasi</option><option value="verse">Ayat</option><option value="gift">Amplop</option><option value="poll">Polling RSVP</option><option value="group">Kartu Grup</option></select><button class="btn ghost" id="add-btn">Tambah</button><span style="color:var(--muted);font-size:13px">Placeholder {nama} di bubble teks akan diganti nama tamu dari link undangannya.</span></div>` + items;
    pane.querySelectorAll('textarea[data-f], input[data-f]').forEach((el) => el.oninput = () => { d.script[Number(el.dataset.i)][el.dataset.f] = el.value; });
    pane.querySelectorAll('select[data-f]').forEach((el) => el.onchange = () => { d.script[Number(el.dataset.i)][el.dataset.f] = el.value; });
    pane.querySelectorAll('[data-mv]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.i), j = i + Number(b.dataset.mv); if (j < 0 || j >= d.script.length) return; [d.script[i], d.script[j]] = [d.script[j], d.script[i]]; render(); });
    pane.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { d.script.splice(Number(b.dataset.rm), 1); render(); });
    $('#add-btn').onclick = () => { const k = $('#add-kind').value; d.script.push({ id: 's' + Date.now().toString(36), kind: k, text: k === 'text' ? 'Pesan baru' : undefined, caption: '' }); render(); };
    $('#save-script').onclick = async () => { collectSettingsless(); await api('/api/content', { method: 'PATCH', body: JSON.stringify({ script: d.script }) }); toast('Naskah tersimpan'); refresh(); };
    function collectSettingsless() { pane.querySelectorAll('textarea[data-f]').forEach((el) => { d.script[Number(el.dataset.i)][el.dataset.f] = el.value; }); }
  }
  if (state.mod === 'atur') {
    const s = d.settings;
    const F = (k, label, full) => `<label class="${full ? 'full' : ''}">${label}<input data-set="${k}" value="${esc(s[k] || '')}"></label>`;
    pane.innerHTML = head('Pengaturan', '<button class="btn" id="save-set">Simpan</button>') +
      `<div class="card"><div class="form-grid">
        ${F('groom', 'Nama panggilan pria')}${F('bride', 'Nama panggilan wanita')}
        ${F('groomFull', 'Nama lengkap pria')}${F('brideFull', 'Nama lengkap wanita')}
        ${F('dateLabel', 'Label tanggal')}${F('groupName', 'Nama grup resepsi')}
        ${F('akad', 'Jam akad')}${F('resepsi', 'Jam resepsi')}
        ${F('venue', 'Tempat')}${F('venueAddr', 'Alamat tempat')}
        ${F('mapsUrl', 'Link Google Maps', true)}
        <label class="full">Ayat / kutipan<textarea data-set="verse" rows="3">${esc(s.verse || '')}</textarea></label>
        <label class="full">Pertanyaan polling RSVP<input data-pollq value="${esc(d.poll.question)}"></label>
      </div></div>
      <div class="card"><div style="font-weight:600;margin-bottom:10px">Amplop Digital</div><div class="form-grid">
        ${s.gift.map((g, i) => `<label>Bank ${i + 1}<input data-gift="${i}:bank" value="${esc(g.bank)}"></label><label>Nomor ${i + 1}<input data-gift="${i}:num" value="${esc(g.num)}"></label><label class="full">Atas nama ${i + 1}<input data-gift="${i}:name" value="${esc(g.name)}"></label>`).join('')}
      </div></div>
      <div class="card"><div style="font-weight:600;margin-bottom:10px">Ganti Password</div><div class="form-grid">
        <label>Password lama<input id="pw-cur" type="password"></label>
        <label>Password baru (min 8)<input id="pw-new" type="password"></label>
      </div><div style="margin-top:12px"><button class="btn" id="pw-btn">Ganti Password</button></div></div>`;
    $('#save-set').onclick = async () => {
      const settings = {};
      pane.querySelectorAll('[data-set]').forEach((el) => settings[el.dataset.set] = el.value);
      settings.gift = s.gift.map((g, i) => ({ bank: pane.querySelector(`[data-gift="${i}:bank"]`).value, num: pane.querySelector(`[data-gift="${i}:num"]`).value, name: pane.querySelector(`[data-gift="${i}:name"]`).value }));
      await api('/api/content', { method: 'PATCH', body: JSON.stringify({ settings, poll: { question: pane.querySelector('[data-pollq]').value } }) });
      toast('Pengaturan tersimpan'); refresh();
    };
    $('#pw-btn').onclick = async () => {
      try {
        const out = await api('/api/password', { method: 'POST', body: JSON.stringify({ current: $('#pw-cur').value, next: $('#pw-new').value }) });
        state.token = out.token; localStorage.setItem('samawa_admin', out.token);
        toast('Password diganti');
      } catch (e) { toast(e.message); }
    };
  }
}
$('#rail-q').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.thread-item').forEach((b) => b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none');
});
if (state.token) enter().catch(() => logout());
