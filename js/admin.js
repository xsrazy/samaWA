// samaWA admin: WhatsApp Web style inbox (ringkasan, RSVP, group, script editor with live preview, settings).
const $ = (s) => document.querySelector(s);
const state = { token: localStorage.getItem('samawa_admin') || '', data: null, mod: 'ringkas', grupTimer: null };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2400); }
function fmt(ts) { const d = new Date(ts); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
function nameColor(name) {
  const colors = ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff5722', '#795548', '#607d8b', '#f44336'];
  let h = 0; for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}
async function api(path, opts) {
  const res = await fetch(path, { ...(opts || {}), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + state.token, ...((opts && opts.headers) || {}) } });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error(out.error || 'gagal');
  return out;
}
// size the admin shell to the EXACT visible screen (visualViewport), not the
// layout viewport: on this user's phone the two disagree, which is why the
// dashboard kept rendering wider than the screen
function fitAdmin() {
  const w = document.querySelector('.admin-wrap');
  if (!w || !window.visualViewport) return;
  const vv = window.visualViewport;
  if (vv.width >= 900) {
    // wide screens keep the centered 1500px shell from CSS
    w.style.width = ''; w.style.height = ''; w.style.left = '';
    w.style.top = ''; w.style.right = ''; w.style.bottom = '';
    w.style.marginLeft = ''; w.style.marginRight = '';
    return;
  }
  w.style.width = vv.width + 'px';
  w.style.height = vv.height + 'px';
  w.style.left = vv.offsetLeft + 'px';
  w.style.top = vv.offsetTop + 'px';
  w.style.right = 'auto';
  w.style.bottom = 'auto';
  w.style.marginLeft = '0';
  w.style.marginRight = '0';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitAdmin);
  window.visualViewport.addEventListener('scroll', fitAdmin);
}
window.addEventListener('orientationchange', () => setTimeout(fitAdmin, 120));
function logout() { state.token = ''; localStorage.removeItem('samawa_admin'); document.body.style.overflow = ''; $('#admin-view').classList.add('hidden'); $('#login-view').classList.remove('hidden'); }

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

function setMod(m) {
  state.mod = m;
  clearInterval(state.grupTimer); state.grupTimer = null;
  document.querySelectorAll('.thread-item').forEach((x) => x.classList.toggle('active', x.dataset.mod === m));
  render();
}
document.querySelectorAll('.thread-item').forEach((b) => b.onclick = () => setMod(b.dataset.mod));

async function enter() {
  $('#login-view').classList.add('hidden');
  $('#admin-view').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fitAdmin();
  try { await refresh(); }
  catch (e) { if (e.message !== 'unauthorized') toast('Gagal memuat, ketuk Muat ulang untuk coba lagi'); throw e; }
}
function reload() { refresh().catch((e) => { if (e.message !== 'unauthorized') toast('Gagal memuat, coba lagi'); }); }
async function refresh() {
  state.data = await api('/api/admin');
  const d = state.data;
  $('#t-ringkas').textContent = `${d.poll.total} suara, ${d.messages.length} pesan grup`;
  $('#t-rsvp').textContent = d.votes.length ? `Terbaru: ${d.votes[0].guest} memilih ${d.poll.options[d.votes[0].choice]}` : 'Belum ada suara masuk';
  $('#c-rsvp').textContent = d.poll.total || '';
  $('#t-grup').textContent = d.messages.length ? `${d.messages[0].name}: ${d.messages[0].text}` : 'Belum ada pesan';
  $('#c-grup').textContent = d.messages.length || '';
  render();
}
function head(title, extra) { return `<div class="pane-head"><h2>${title}</h2><span class="sp"></span>${extra || ''}</div>`; }
const CHOICE_COLORS = ['#00a884', '#c62828', '#f9a825'];

function pollBars(d) {
  const rows = d.poll.options.map((o, i) => {
    const n = d.poll.counts[i] || 0;
    const pct = d.poll.total ? Math.round((n / d.poll.total) * 100) : 0;
    return `<div class="bar-row"><span class="bar-name">${esc(o)}</span><span class="bar-track"><i style="width:${pct}%;background:${CHOICE_COLORS[i]}"></i></span><span class="bar-num">${n} suara (${pct}%)</span></div>`;
  }).join('');
  return `<div class="card"><div class="card-title">${esc(d.poll.question)}</div>${rows}<div class="bar-foot">Total ${d.poll.total} suara masuk. Satu tamu satu suara, pilihannya bisa diganti kapan aja.</div></div>`;
}

// ---------- live phone preview for the script editor ----------
function pvBubble(s, item) {
  const T = (inner, cls) => `<div class="pv-row"><div class="pv-bubble ${cls || ''}">${inner}</div></div>`;
  switch (item.kind) {
    case 'text': return T(esc(item.text || '').split('{nama}').join('kamu').replace(/\n/g, '<br>'));
    case 'photo': return T(`<img src="${esc(item.src || s.photo)}" alt=""><div class="pv-cap">${esc(item.caption || '')}</div>`, 'pv-photo');
    case 'countdown': {
      const t = new Date(s.dateISO).getTime();
      const diff = isNaN(t) ? 0 : Math.max(0, t - Date.now());
      const dd = Math.floor(diff / 864e5); const hh = String(Math.floor(diff / 36e5) % 24).padStart(2, '0'); const mm = String(Math.floor(diff / 6e4) % 60).padStart(2, '0'); const ss = String(Math.floor(diff / 1e3) % 60).padStart(2, '0');
      return T(`<div class="pv-cd"><b>${dd} : ${hh} : ${mm} : ${ss}</b><span>hari &nbsp;:&nbsp; jam &nbsp;:&nbsp; menit &nbsp;:&nbsp; detik</span><span>menuju hari bahagia</span><b class="pv-cd-date">${esc(s.dateLabel)}</b></div>`);
    }
    case 'location': return T(`<div class="pv-loc"><div class="pv-map">&#128205;</div><b>${esc(s.venue)}</b><p>${esc(s.venueAddr)}</p><span class="pv-link">Lihat Lokasi</span></div>`);
    case 'verse': return T(`<p class="pv-verse">${esc(item.text || s.verse)}</p>`);
    case 'voice': {
      const bars = Array.from({ length: 26 }, (_, i) => `<i style="height:${6 + ((i * 7) % 20)}px"></i>`).join('');
      return T(`<div class="pv-vn"><span class="pv-play">&#9654;</span><span class="pv-wave">${bars}</span></div><div class="pv-cap">${esc(item.caption || 'Pesan suara')}</div>`);
    }
    case 'gift': return T(`<b>&#128140; Amplop Digital</b>` + s.gift.map((g) => `<div class="pv-gift"><span>${esc(g.bank)}</span><b>${esc(g.num)}</b><em>SALIN</em><span class="pv-gift-name">A.n. ${esc(g.name)}</span></div>`).join(''));
    case 'poll': {
      const d = state.data;
      return T(`<div class="pv-pollq">${esc(d.poll.question)}</div>` + d.poll.options.map((o) => `<div class="pv-opt"><span class="pv-box"></span>${esc(o)}</div>`).join(''));
    }
    case 'group': return T(`<div class="pv-group"><b>${esc(s.groupName)}</b><p>Grup para tamu. Buku tamu dan ucapan ada di sini.</p><span class="pv-link">Gabung Grup</span></div>`);
    default: return '';
  }
}
function paintPreview() {
  const el = $('#pv-thread');
  if (!el || !state.data) return;
  const s = state.data.settings;
  el.innerHTML = `<div class="pv-sys">&#128274; Pesan dan panggilan terenkripsi secara end-to-end.</div>` +
    state.data.script.map((item) => pvBubble(s, item)).join('');
}

function render() {
  const d = state.data; if (!d) return;
  const pane = $('#pane');
  clearInterval(state.grupTimer); state.grupTimer = null;

  if (state.mod === 'ringkas') {
    const uniq = new Set([...d.votes.map((v) => v.guest.toLowerCase()), ...d.messages.map((m) => m.name.toLowerCase())]).size;
    const stats = [
      ['&#128499;', d.poll.total, 'Suara RSVP masuk'],
      ['&#128101;', uniq, 'Tamu unik (suara + grup)'],
      ['&#128172;', d.messages.length, 'Pesan di grup resepsi'],
      ['&#128221;', d.script.length, 'Bubble di naskah undangan'],
    ].map(([ic, n, label]) => `<div class="stat"><span class="stat-ic">${ic}</span><span><b>${n}</b><small>${label}</small></span></div>`).join('');
    const lastVotes = d.votes.slice(0, 5).map((v) => `<div class="mini-row"><span class="dot" style="background:${CHOICE_COLORS[v.choice]}"></span><span class="mini-main"><b>${esc(v.guest)}</b> memilih ${esc(d.poll.options[v.choice])}</span><small>${fmt(v.ts)}</small></div>`).join('');
    const lastMsgs = d.messages.slice(0, 5).map((m) => `<div class="mini-row"><span class="mini-ava" style="background:${nameColor(m.name)}">${esc((m.name || '?').slice(0, 1).toUpperCase())}</span><span class="mini-main"><b>${esc(m.name)}</b>: ${esc(m.text)}</span><small>${fmt(m.ts)}</small></div>`).join('');
    pane.innerHTML = head('Ringkasan', '<button class="btn ghost" id="rf">Muat ulang</button>') +
      `<div class="stats">${stats}</div>` + pollBars(d) +
      `<div class="cols">
        <div class="card"><div class="card-title">Suara terbaru</div>${lastVotes || '<p class="empty">Belum ada suara masuk.</p>'}<button class="btn ghost sm" data-goto="rsvp">Lihat semua suara</button></div>
        <div class="card"><div class="card-title">Pesan grup terbaru</div>${lastMsgs || '<p class="empty">Belum ada pesan di grup.</p>'}<button class="btn ghost sm" data-goto="grup">Buka grup resepsi</button></div>
      </div>`;
    $('#rf').onclick = reload;
    pane.querySelectorAll('[data-goto]').forEach((b) => b.onclick = () => setMod(b.dataset.goto));
  }

  if (state.mod === 'rsvp') {
    const rows = d.votes.map((v) => `<div class="vote-row" data-name="${esc(v.guest.toLowerCase())}"><span class="vote-ava" style="background:${CHOICE_COLORS[v.choice]}">${esc((v.guest || '?').slice(0, 1).toUpperCase())}</span><span class="vote-main"><b>${esc(v.guest)}</b><small style="color:${CHOICE_COLORS[v.choice]}">${esc(d.poll.options[v.choice])}</small></span><span class="vote-time">${fmt(v.ts)}</span></div>`).join('');
    pane.innerHTML = head('Polling RSVP', '<button class="btn ghost" id="rf">Muat ulang</button>') + pollBars(d) +
      `<div class="card"><div class="card-title">Daftar tamu</div><input id="rsvp-q" class="search-in" type="text" placeholder="Cari nama tamu..."><div id="vote-list">${rows || '<p class="empty">Belum ada suara masuk.</p>'}</div></div>`;
    $('#rf').onclick = reload;
    const q = $('#rsvp-q');
    if (q) q.oninput = () => { const needle = q.value.toLowerCase(); pane.querySelectorAll('.vote-row').forEach((r) => r.style.display = r.dataset.name.includes(needle) ? '' : 'none'); };
  }

  if (state.mod === 'grup') {
    const oldPanel = pane.querySelector('.grup-panel');
    const wasNearBottom = !oldPanel || (oldPanel.scrollHeight - oldPanel.scrollTop - oldPanel.clientHeight < 120);
    const chrono = d.messages.slice().reverse();
    const bubbles = chrono.map((m) => `<div class="g-row"><div class="g-bubble"><div class="g-name" style="color:${nameColor(m.name)}">${esc(m.name)}</div><p>${esc(m.text)}</p><div class="g-meta"><span>${fmt(m.ts)}</span><button class="g-del" data-del="${m.id}">Hapus</button></div></div></div>`).join('');
    pane.innerHTML = head('Grup Resepsi', '<button class="btn ghost" id="rf">Muat ulang</button>') +
      `<div class="grup-note">Pesan tampil kayak di grup WhatsApp beneran, yang lama di atas. Halaman ini nyegarkan sendiri tiap 25 detik.</div>
       <div class="grup-panel">${bubbles || '<p class="empty light">Belum ada pesan di grup.</p>'}</div>`;
    $('#rf').onclick = reload;
    pane.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Yakin?'; setTimeout(() => { b.classList.remove('confirm'); b.textContent = 'Hapus'; }, 2600); return; }
      await api('/api/message-delete?id=' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
      toast('Pesan dihapus'); refresh();
    });
    const panel = pane.querySelector('.grup-panel');
    if (panel && wasNearBottom) panel.scrollTop = panel.scrollHeight;
    state.grupTimer = setInterval(() => { if (state.mod === 'grup') refresh(); }, 25000);
  }

  if (state.mod === 'naskah') {
    const KINDS = { text: 'Teks', photo: 'Foto', countdown: 'Hitung Mundur', location: 'Lokasi', verse: 'Ayat', voice: 'Voice Note', gift: 'Amplop', poll: 'Polling RSVP', group: 'Kartu Grup' };
    const items = d.script.map((s, i) => {
      const editable = s.kind === 'text' || s.kind === 'verse';
      const capEditable = s.kind === 'photo' || s.kind === 'voice';
      let mid;
      if (editable) mid = `<textarea data-f="text" data-i="${i}">${esc(s.text || '')}</textarea>`;
      else if (capEditable) mid = `<span class="cap-edit"><span class="fixed-note">${s.kind === 'photo' ? 'Foto mempelai (selalu tampil utuh)' : 'Voice note berisi lagu pengantar'}</span><input data-f="caption" data-i="${i}" value="${esc(s.caption || '')}" placeholder="Caption"></span>`;
      else mid = `<span class="fixed-note">Blok otomatis dari Pengaturan (tanggal, lokasi, amplop, polling, grup).</span>`;
      const srcSel = s.kind === 'photo' ? `<select data-f="src" data-i="${i}"><option value="/assets/img/couple.webp" ${s.src === '/assets/img/couple.webp' || !s.src ? 'selected' : ''}>Berdua</option><option value="/assets/img/groom.webp" ${s.src === '/assets/img/groom.webp' ? 'selected' : ''}>Usra</option><option value="/assets/img/bride.webp" ${s.src === '/assets/img/bride.webp' ? 'selected' : ''}>Zee</option></select>` : '';
      return `<div class="script-item"><span class="kind">${KINDS[s.kind] || s.kind}</span>${mid}${srcSel}<span class="s-btns"><button data-mv="-1" data-i="${i}" title="Naik">&#8593;</button><button data-mv="1" data-i="${i}" title="Turun">&#8595;</button><button data-rm="${i}" title="Hapus">&#10005;</button></span></div>`;
    }).join('');
    pane.innerHTML = head('Naskah Undangan', '<button class="btn" id="save-script">Simpan Naskah</button>') +
      `<div class="editor-grid"><div class="editor-main">
        <div class="card add-card"><b>Tambah bubble:</b><select id="add-kind"><option value="text">Teks</option><option value="photo">Foto</option><option value="voice">Voice Note</option><option value="countdown">Hitung Mundur</option><option value="location">Lokasi</option><option value="verse">Ayat</option><option value="gift">Amplop</option><option value="poll">Polling RSVP</option><option value="group">Kartu Grup</option></select><button class="btn ghost" id="add-btn">Tambah</button><span class="hint">Placeholder {nama} di bubble teks akan diganti nama tamu dari link undangannya.</span></div>
        ${items}
      </div>
      <aside class="preview-col"><div class="phone"><div class="phone-bar"><span class="avatar sm"><img src="/assets/img/couple.webp" alt=""></span><span class="phone-names"><b>${esc(d.settings.groom)} &amp; ${esc(d.settings.bride)}</b><small>online</small></span></div><div class="pv-thread" id="pv-thread"></div></div><p class="preview-note">Pratinjau langsung. Edit di kiri, hasilnya kelihatan di sini kayak di HP tamu.</p></aside></div>`;
    paintPreview();
    pane.querySelectorAll('textarea[data-f], input[data-f]').forEach((el) => el.oninput = () => { d.script[Number(el.dataset.i)][el.dataset.f] = el.value; paintPreview(); });
    pane.querySelectorAll('select[data-f]').forEach((el) => el.onchange = () => { d.script[Number(el.dataset.i)][el.dataset.f] = el.value; paintPreview(); });
    pane.querySelectorAll('[data-mv]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.i), j = i + Number(b.dataset.mv); if (j < 0 || j >= d.script.length) return; [d.script[i], d.script[j]] = [d.script[j], d.script[i]]; render(); });
    pane.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { d.script.splice(Number(b.dataset.rm), 1); render(); });
    $('#add-btn').onclick = () => { const k = $('#add-kind').value; d.script.push({ id: 's' + Date.now().toString(36), kind: k, text: k === 'text' ? 'Pesan baru' : undefined, caption: '' }); render(); };
    $('#save-script').onclick = async () => { await api('/api/content', { method: 'PATCH', body: JSON.stringify({ script: d.script }) }); toast('Naskah tersimpan'); refresh(); };
  }

  if (state.mod === 'atur') {
    const s = d.settings;
    const F = (k, label, full) => `<label class="${full ? 'full' : ''}">${label}<input data-set="${k}" value="${esc(s[k] || '')}"></label>`;
    pane.innerHTML = head('Pengaturan', '<button class="btn" id="save-set">Simpan</button>') +
      `<div class="card"><div class="card-title">Mempelai &amp; Acara</div><div class="form-grid">
        ${F('groom', 'Nama panggilan pria')}${F('bride', 'Nama panggilan wanita')}
        ${F('groomFull', 'Nama lengkap pria')}${F('brideFull', 'Nama lengkap wanita')}
        ${F('dateLabel', 'Label tanggal')}${F('groupName', 'Nama grup resepsi')}
        <label>Tanggal acara (target hitung mundur)<input id="set-date" type="date" value="${esc((s.dateISO || '').slice(0, 10))}"></label>
        ${F('akad', 'Jam akad')}${F('resepsi', 'Jam resepsi')}
        ${F('venue', 'Tempat')}${F('venueAddr', 'Alamat tempat')}
        ${F('mapsUrl', 'Link Google Maps', true)}
        <label class="full">Ayat / kutipan<textarea data-set="verse" rows="3">${esc(s.verse || '')}</textarea></label>
      </div></div>
      <div class="card"><div class="card-title">Polling RSVP</div><div class="form-grid">
        <label class="full">Pertanyaan polling<input data-pollq value="${esc(d.poll.question)}"></label>
      </div><p class="hint">Pilihan jawabannya tetap: ${d.poll.options.map(esc).join(', ')}.</p></div>
      <div class="card"><div class="card-title">Amplop Digital</div><div class="form-grid">
        ${s.gift.map((g, i) => `<label>Bank ${i + 1}<input data-gift="${i}:bank" value="${esc(g.bank)}"></label><label>Nomor ${i + 1}<input data-gift="${i}:num" value="${esc(g.num)}"></label><label class="full">Atas nama ${i + 1}<input data-gift="${i}:name" value="${esc(g.name)}"></label>`).join('')}
      </div></div>
      <div class="card"><div class="card-title">Ganti Password</div><div class="form-grid">
        <label>Password lama<input id="pw-cur" type="password"></label>
        <label>Password baru (min 8)<input id="pw-new" type="password"></label>
      </div><div style="margin-top:12px"><button class="btn" id="pw-btn">Ganti Password</button></div></div>`;
    $('#save-set').onclick = async () => {
      const settings = {};
      pane.querySelectorAll('[data-set]').forEach((el) => settings[el.dataset.set] = el.value);
      settings.groupName = pane.querySelector('[data-set="groupName"]').value;
      const dv = pane.querySelector('#set-date');
      if (dv && dv.value) settings.dateISO = dv.value + 'T03:00:00.000Z';
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
if (state.token) enter().catch((e) => { if (e.message === 'unauthorized') logout(); });
