// samaWA public app: the invitation is a WhatsApp conversation.
const $ = (s) => document.querySelector(s);
const state = { data: null, guest: '', vote: null, playedAll: false, groupTimer: null, groupMsgs: [], pendingMsgs: [], joined: false, groupFrom: 'thread' };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2400); }
const webMq = window.matchMedia('(min-width: 900px)');
function fitApp() {
  const app = document.getElementById('app');
  if (!app) return;
  if (webMq.matches || !window.visualViewport) { app.style.height = ''; return; }
  app.style.height = window.visualViewport.height + 'px';
}
if (window.visualViewport) { window.visualViewport.addEventListener('resize', fitApp); window.visualViewport.addEventListener('scroll', fitApp); }
function isWeb() { return webMq.matches; }
function show(view) {
  if (isWeb()) {
    // WhatsApp Web mode: the chat list stays as the left pane, the target opens on the right
    document.querySelectorAll('.view').forEach((v) => { if (v.id !== 'view-chats') v.classList.remove('active'); });
    $('#view-chats').classList.add('active');
    $('#view-' + (view === 'chats' ? 'thread' : view)).classList.add('active');
  } else {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
  }
  if (view !== 'group') { clearInterval(state.groupTimer); state.groupTimer = null; }
  if (view === 'chats') updateGroupEntry();
  window.scrollTo(0, 0);
}
function guestName() {
  const url = new URLSearchParams(location.search).get('to');
  if (url) { localStorage.setItem('samawa_name', url.slice(0, 40)); return url.slice(0, 40); }
  return localStorage.getItem('samawa_name') || '';
}
function fmtTime(ts) { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }

// ---------- incoming chat tone (played when a chat bubble arrives) ----------
let audioCtx = null, audioUnlocked = false, lastGroupCount = null;
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* audio is a bonus */ }
}
document.addEventListener('pointerdown', () => { audioUnlocked = true; ensureAudio(); });
function chatTone() {
  if (!audioUnlocked) return;
  ensureAudio();
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(640, t);
    o.frequency.exponentialRampToValueAtTime(210, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.17);
  } catch { /* never break the app for a sound */ }
}
function bubbleTime(i) {
  const total = row.total || 1;
  const base = row.baseTs || Date.now();
  return fmtTime(base - (total - 1 - i) * 60000);
}

// ---------- bubble renderers ----------
function row(html, cls) { const nm = row.sender ? `<div class="sender-name" style="color:${senderNameColor(row.sender)}">${esc(row.sender)}</div>` : ''; return `<div class="row in"><div class="bubble ${cls || ''}">${nm}${html}<span class="time">${bubbleTime(row.i++)}</span></div></div>`; }
row.sender = null;
row.i = 0;
function senderNameColor(name) {
  const colors = ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff5722', '#795548', '#607d8b', '#f44336'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}
const R = {
  text(s, item) {
    let txt = esc(item.text || '');
    txt = txt.replace('{nama}', esc(state.guest || 'kamu'));
    return row(txt.replace(/\n/g, '<br>'));
  },
  photo(s, item) {
    const src = item.src || s.photo;
    return row(`<img src="${esc(src)}" alt="Foto mempelai"><div class="cap">${esc(item.caption || '')}</div>`, 'photo');
  },
  countdown(s) {
    const p = cdParts();
    return row(`<div class="countdown"><div class="cd-grid" data-cd-grid><div class="cd-cell days"><div class="cd-v" data-cd-d>${p.d}</div><div class="cd-l">hari</div></div><div class="cd-sep">:</div><div class="cd-cell"><div class="cd-v" data-cd-h>${p.h}</div><div class="cd-l">jam</div></div><div class="cd-sep">:</div><div class="cd-cell"><div class="cd-v" data-cd-m>${p.m}</div><div class="cd-l">menit</div></div><div class="cd-sep">:</div><div class="cd-cell"><div class="cd-v" data-cd-s>${p.s}</div><div class="cd-l">detik</div></div></div><div class="cd-label">menuju hari bahagia</div><div class="cd-date">${esc(s.dateLabel)}</div></div>`, 'cd');
  },
  location(s) {
    return row(`<div class="loc-card"><div class="loc-map"><span class="loc-pin">&#128205;</span></div><div class="loc-body"><b>${esc(s.venue)}</b><p>${esc(s.venueAddr)}</p></div><a class="loc-link" href="${esc(s.mapsUrl)}" target="_blank" rel="noopener">Lihat Lokasi</a></div>`, 'loc');
  },
  verse(s) {
    return row(`<p>${esc(s.verse)}</p>`, 'verse');
  },
  voice(s, item) {
    const bars = Array.from({ length: 30 }, () => 6 + Math.round(Math.random() * 22)).map((h) => `<i style="height:${h}px"></i>`).join('');
    return row(`<div class="vn"><button class="vn-play" data-vn-play>&#9654;</button><div class="vn-mid"><div class="vn-wave" data-vn-wave>${bars}</div><div class="vn-meta"><span data-vn-dur>0:23</span><span class="vn-cap">${esc(item.caption || 'Pesan suara')}</span><button class="vn-rate" data-vn-rate>1x</button></div></div><div class="vn-side"><span class="avatar"><img src="${esc(s.photo)}" alt="Usra dan Zee"></span></div></div>`);
  },
  gift(s) {
    const rowsHtml = s.gift.map((g) => `<div class="gift-row"><span class="gift-bank">${esc(g.bank)}</span><span class="gift-mid"><span class="gift-num">${esc(g.num)}</span><span class="gift-name">A.n. ${esc(g.name)}</span></span><button class="gift-copy" data-copy="${esc(g.num)}">SALIN</button></div>`).join('');
    return row(`<b>&#128140; Amplop Digital</b><p style="color:var(--muted);font-size:13.5px;margin:2px 0 4px">Doa restu kamu yang utama. Kalau ingin memberi tanda kasih, ini salurannya:</p>${rowsHtml}`, 'gift');
  },
  poll(s, item, poll) {
    return row(renderPoll(poll), 'pollwrap');
  },
  group(s, item, poll, group) {
    return row(`<div class="group-card"><span class="avatar"><img src="${esc(s.photo)}" alt="Grup resepsi"></span><span><b>${esc(group.name)}</b><p>Grup para tamu. Buku tamu dan ucapan ada di sini.</p></span></div><button class="group-join" data-go-group>Gabung Grup</button>`);
  },
};
function renderPoll(poll) {
  const voted = state.vote != null;
  const opts = poll.options.map((opt, i) => {
    const n = poll.counts[i] || 0;
    const pct = poll.total ? Math.round((n / poll.total) * 100) : 0;
    return `<button class="poll-opt ${state.vote === i ? 'sel' : ''}" data-vote="${i}"><span class="poll-box">${state.vote === i ? '&#10003;' : ''}</span><span class="poll-opt-main">${esc(opt)}${voted ? `<span class="poll-bar"><i style="width:${pct}%"></i></span>` : ''}</span>${voted ? `<span class="poll-votes">${n} suara</span>` : ''}</button>`;
  }).join('');
  return `<div class="poll-q">${esc(poll.question)}</div><div class="poll-note">${voted ? 'Terima kasih sudah konfirmasi. Kamu bisa mengubah pilihanmu.' : 'Pilih satu jawaban buat konfirmasi kehadiran kamu.'}</div>${opts}<div class="poll-foot">${poll.total} suara masuk</div>`;
}

function cdParts() {
  if (!state.data) return { d: 0, h: '00', m: '00', s: '00' };
  let diff = Math.max(0, new Date(state.data.settings.dateISO).getTime() - Date.now());
  const d = Math.floor(diff / 864e5); diff -= d * 864e5;
  const h = Math.floor(diff / 36e5); diff -= h * 36e5;
  const m = Math.floor(diff / 6e4); diff -= m * 6e4;
  const sec = Math.floor(diff / 1e3);
  return { d, h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0'), s: String(sec).padStart(2, '0') };
}

// ---------- thread playback ----------
async function playThread() {
  const box = $('#thread-msgs');
  const d = state.data;
  row.i = 0; row.total = d.script.length; row.baseTs = Date.now(); row.sender = null;
  box.innerHTML = `<div class="date-chip">Hari ini</div><div class="sys-chip">&#128274; Pesan dan panggilan terenkripsi secara end-to-end. <b>Usra &amp; Zee</b> tidak bisa membaca chat ini, yang bisa cuma kamu dan tanggal 17 Januari 2050.</div>`;
  const instant = sessionStorage.getItem('samawa_seen') === '1';
  const statusEl = $('#typing-status');
  for (const item of d.script) {
    if (!R[item.kind]) continue;
    if (!instant) {
      statusEl.textContent = 'sedang mengetik...';
      const t = document.createElement('div');
      t.className = 'row in'; t.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
      box.appendChild(t); box.scrollTop = box.scrollHeight;
      await new Promise((r) => setTimeout(r, item.kind === 'text' ? 850 : 600));
      t.remove();
      statusEl.textContent = 'online';
    }
    box.insertAdjacentHTML('beforeend', R[item.kind](d.settings, item, d.poll, d.group));
    bindBubbleBits(box);
    box.scrollTop = box.scrollHeight;
    if (item.kind === 'countdown') startCountdown();
    if (!instant) { chatTone(); await new Promise((r) => setTimeout(r, 350)); }
  }
  sessionStorage.setItem('samawa_seen', '1');
  state.playedAll = true;
  startCountdown();
}

let cdTimer = null;
function startCountdown() {
  const grid = document.querySelector('[data-cd-grid]');
  if (!grid) return;
  const f = { d: grid.querySelector('[data-cd-d]'), h: grid.querySelector('[data-cd-h]'), m: grid.querySelector('[data-cd-m]'), s: grid.querySelector('[data-cd-s]') };
  const tick = () => {
    const p = cdParts();
    f.d.textContent = p.d;
    f.h.textContent = p.h;
    f.m.textContent = p.m;
    f.s.textContent = p.s;
  };
  tick(); clearInterval(cdTimer); cdTimer = setInterval(tick, 1000);
}

// ---------- voice note ----------
const audio = $('#vn-audio');
let vnRate = 1;
function bindBubbleBits(scope) {
  scope.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Nomor tersalin'); } catch { toast(b.dataset.copy); }
  });
  scope.querySelectorAll('[data-vote]').forEach((b) => b.onclick = () => vote(Number(b.dataset.vote)));
  scope.querySelectorAll('[data-go-group]').forEach((b) => b.onclick = openGroup);
  const play = scope.querySelector('[data-vn-play]');
  if (play && !play._bound) {
    play._bound = true;
    audio.src = state.data.settings.music;
    play.onclick = () => { if (audio.paused) { audio.play(); play.innerHTML = '&#10073;&#10073;'; } else { audio.pause(); play.innerHTML = '&#9654;'; } };
    const rate = scope.querySelector('[data-vn-rate]');
    if (rate) rate.onclick = () => { vnRate = vnRate === 1 ? 1.5 : vnRate === 1.5 ? 2 : 1; audio.playbackRate = vnRate; rate.textContent = vnRate + 'x'; };
    const wave = scope.querySelector('[data-vn-wave]');
    const dur = scope.querySelector('[data-vn-dur]');
    const paint = () => {
      if (!audio.duration) return;
      const p = audio.currentTime / audio.duration;
      wave.querySelectorAll('i').forEach((bar, i) => bar.classList.toggle('on', i / 30 <= p));
      const left = Math.ceil(audio.duration - audio.currentTime);
      dur.textContent = '0:' + String(left).padStart(2, '0');
    };
    audio.ontimeupdate = paint;
    audio.onended = () => { play.innerHTML = '&#9654;'; paint(); };
  }
}

function repaintPoll() {
  const wrap = document.querySelector('.bubble.pollwrap');
  if (wrap) { const time = wrap.querySelector('.time'); const nm = wrap.querySelector('.sender-name'); wrap.innerHTML = (nm ? nm.outerHTML : '') + renderPoll(state.data.poll) + (time ? time.outerHTML : ''); bindBubbleBits(wrap); }
}
async function vote(choice) {
  if (!state.guest) { openGate(() => vote(choice)); return; }
  const prevVote = state.vote, prevCounts = [...state.data.poll.counts], prevTotal = state.data.poll.total;
  if (prevVote !== choice) {
    if (prevVote != null) state.data.poll.counts[prevVote] = Math.max(0, (state.data.poll.counts[prevVote] || 0) - 1);
    else state.data.poll.total += 1;
    state.data.poll.counts[choice] = (state.data.poll.counts[choice] || 0) + 1;
  }
  state.vote = choice;
  repaintPoll();
  try {
    const res = await fetch('/api/rsvp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guest: state.guest, choice }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'gagal');
    localStorage.setItem('samawa_vote', String(choice));
    state.data.poll.counts = out.counts; state.data.poll.total = out.total;
    repaintPoll();
    toast('Konfirmasi tersimpan. Terima kasih!');
  } catch (e) {
    state.vote = prevVote; state.data.poll.counts = prevCounts; state.data.poll.total = prevTotal;
    repaintPoll();
    toast('Gagal menyimpan, coba lagi ya');
  }
}

// ---------- group ----------
function renderGroup(messages) {
  const box = $('#group-msgs');
  const mine = (m) => state.guest && m.name.toLowerCase() === state.guest.toLowerCase();
  box.innerHTML = `<div class="date-chip">Hari ini</div><div class="sys-chip">&#128274; Pesan terenkripsi secara end-to-end. Ucapkan selamat dan doa terbaikmu buat <b>Usra &amp; Zee</b> di sini.</div>` +
    messages.map((m) => mine(m)
      ? `<div class="row out"><div class="bubble">${esc(m.text)}<span class="time">${fmtTime(m.ts)}<span class="ticks">&#10003;&#10003;</span></span></div></div>`
      : `<div class="row in"><div class="bubble"><div class="sender-name" style="color:${senderNameColor(m.name)}">${esc(m.name)}</div>${esc(m.text)}<span class="time">${fmtTime(m.ts)}</span></div></div>`).join('');
  box.scrollTop = box.scrollHeight;
}
function mergedMsgs() {
  const msgs = [...state.groupMsgs];
  const key = (m) => m.name.toLowerCase() + '|' + m.text;
  const counts = {};
  msgs.forEach((m) => { const k = key(m); counts[k] = (counts[k] || 0) + 1; });
  state.pendingMsgs.forEach((p) => { const k = key(p); if (counts[k]) counts[k] -= 1; else msgs.push(p); });
  return msgs;
}
async function loadGroup() {
  try {
    const res = await fetch('/api/messages');
    const out = await res.json();
    const prevGroupCount = lastGroupCount;
    state.groupMsgs = out.messages || [];
    lastGroupCount = state.groupMsgs.length;
    if (prevGroupCount != null && state.groupMsgs.length > prevGroupCount && $('#view-group').classList.contains('active')) {
      const newest = state.groupMsgs[state.groupMsgs.length - 1];
      if (newest && !(state.guest && newest.name.toLowerCase() === state.guest.toLowerCase())) chatTone();
    }
    markGroupSeen();
    renderGroup(mergedMsgs());
    updateGroupEntry();
    const names = new Set(state.groupMsgs.map((m) => m.name.toLowerCase()));
    $('#group-members').textContent = `Usra, Zee, dan ${names.size} tamu lainnya`;
  } catch { /* keep last render */ }
}
function markGroupSeen() { try { localStorage.setItem('samawa_group_seen', String((state.groupMsgs || []).length)); } catch {} }
function updateGroupEntry() {
  const el = $('#chat-group');
  if (!el) return;
  if (!state.joined || !state.data) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('#group-chat-name').textContent = state.data.settings.groupName;
  const msgs = state.groupMsgs || [];
  const last = msgs[msgs.length - 1];
  const timeEl = $('#group-chat-time');
  if (last) {
    const mine = state.guest && last.name.toLowerCase() === state.guest.toLowerCase();
    $('#group-chat-preview').textContent = (mine ? 'Kamu' : last.name) + ': ' + last.text;
    timeEl.textContent = fmtTime(last.ts);
  } else {
    $('#group-chat-preview').textContent = 'Kamu sudah gabung grup ini';
    timeEl.textContent = '';
  }
  const seen = Number(localStorage.getItem('samawa_group_seen') || 0);
  const unread = Math.max(0, msgs.length - seen);
  const badge = $('#group-badge');
  badge.textContent = unread ? String(unread) : '';
  badge.classList.toggle('hidden', !unread);
  timeEl.classList.toggle('unread', unread > 0);
}
function openGroup() {
  if (!state.guest) { openGate(openGroup); return; }
  state.groupFrom = document.querySelector('#view-chats.active') ? 'chats' : 'thread';
  state.joined = true;
  try { localStorage.setItem('samawa_joined', '1'); } catch {}
  show('group');
  $('#group-name').textContent = state.data.settings.groupName;
  loadGroup();
  clearInterval(state.groupTimer);
  state.groupTimer = setInterval(loadGroup, 20000);
}
async function sendGroup() {
  const input = $('#group-input');
  const text = input.value.trim();
  if (!text) return;
  if (!state.guest) { openGate(sendGroup); return; }
  input.value = '';
  const pending = { name: state.guest, text, ts: Date.now() };
  state.pendingMsgs.push(pending);
  renderGroup(mergedMsgs());
  try {
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: state.guest, text }) });
    if (!res.ok) throw new Error();
    loadGroup();
  } catch {
    state.pendingMsgs = state.pendingMsgs.filter((p) => p !== pending);
    renderGroup(mergedMsgs());
    toast('Pesan gagal terkirim');
  }
}

// ---------- name gate ----------
let gateNext = null;
function openGate(next) { gateNext = next || null; $('#name-gate').classList.remove('hidden'); setTimeout(() => $('#gate-name').focus(), 60); }
function cancelGate() { $('#name-gate').classList.add('hidden'); gateNext = null; }
function closeGate() {
  const name = $('#gate-name').value.trim().slice(0, 40);
  if (!name) { toast('Isi nama dulu ya'); return; }
  state.guest = name; localStorage.setItem('samawa_name', name);
  $('#name-gate').classList.add('hidden');
  if (gateNext) { const f = gateNext; gateNext = null; f(); }
}

// ---------- status viewer ----------
const STATUS_ITEMS = [
  { src: '/assets/img/couple.webp', cap: 'Menuju hari bahagia, 17 Januari 2050' },
  { src: '/assets/img/groom.webp', cap: 'Yang berbahagia, Usra' },
  { src: '/assets/img/bride.webp', cap: 'Yang berbahagia, Zee' },
];
let statusIx = 0, statusTimer = null;
function openStatus() {
  show('status');
  statusIx = 0; runStatus();
}
function runStatus() {
  clearTimeout(statusTimer);
  const it = STATUS_ITEMS[statusIx];
  $('#status-img').src = it.src;
  $('#status-bg').src = it.src;
  $('#status-caption').textContent = it.cap;
  $('#status-progress').innerHTML = STATUS_ITEMS.map((_, i) => `<i><b style="width:${i < statusIx ? 100 : 0}%"></b></i>`).join('');
  const bar = $('#status-progress').children[statusIx].firstChild;
  requestAnimationFrame(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; });
  statusTimer = setTimeout(() => { statusIx < STATUS_ITEMS.length - 1 ? (statusIx++, runStatus()) : show('chats'); }, 5000);
}

// ---------- boot ----------
async function boot() {
  state.guest = guestName();
  const saved = localStorage.getItem('samawa_vote');
  if (saved != null) state.vote = Number(saved);
  try {
    const res = await fetch('/api/state');
    state.data = await res.json();
    const s = state.data.settings;
    document.title = `samaWA - Undangan Pernikahan ${s.groom} & ${s.bride}`;
    $('#profile-name').textContent = `${s.groom} & ${s.bride}`;
    $('#profile-venue').textContent = s.venue;
    $('#profile-venue-addr').textContent = s.venueAddr;
    $('#profile-maps').href = s.mapsUrl;
    $('#profile-group').textContent = s.groupName;
    $('#chat-time').textContent = fmtTime(Date.now());
    const stEl = $('#status-time'); if (stEl) stEl.textContent = 'Hari ini ' + fmtTime(Date.now());
    state.joined = localStorage.getItem('samawa_joined') === '1';
    if (state.joined) {
      try { const r2 = await fetch('/api/messages'); const o2 = await r2.json(); state.groupMsgs = o2.messages || []; } catch {}
    }
    updateGroupEntry();
  } catch { toast('Gagal memuat, periksa koneksi kamu'); }

  $('#chat-real').onclick = () => { $('#unread-badge') && ($('#unread-badge').style.display = 'none'); show('thread'); if (!state.playedAll) playThread(); else { $('#thread-msgs').scrollTop = $('#thread-msgs').scrollHeight; } };
  document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => show(b.dataset.go === 'group' ? 'group' : b.dataset.go));
  document.querySelectorAll('[data-go="group"]').forEach((b) => b.onclick = openGroup);
  document.querySelectorAll('[data-deco]').forEach((b) => b.onclick = () => toast('Tombol pajangan. Yang beneran tombolnya chat Usra & Zee.'));
  document.querySelectorAll('[data-deco-chat]').forEach((b) => b.onclick = () => toast('Chat ini cuma pajangan. Buka chat Usra & Zee ya.'));
  $('#open-profile').onclick = () => show('profile');
  $('#replay-btn').onclick = () => { sessionStorage.removeItem('samawa_seen'); state.playedAll = false; playThread(); toast('Undangan diputar ulang'); };
  $('#status-open').onclick = openStatus;
  $('#profile-status-row').onclick = openStatus;
  $('#status-close').onclick = () => { clearTimeout(statusTimer); show('chats'); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#view-status').classList.contains('active')) { clearTimeout(statusTimer); show('chats'); } });
  $('#status-next').onclick = () => { if (statusIx < STATUS_ITEMS.length - 1) { statusIx++; runStatus(); } else { clearTimeout(statusTimer); show('chats'); } };
  $('#status-prev').onclick = () => { if (statusIx > 0) { statusIx--; runStatus(); } };
  $('#chat-group').onclick = openGroup;
  $('#group-back').onclick = () => show(state.groupFrom === 'chats' ? 'chats' : 'thread');
  $('#group-send').onclick = () => { if ($('#group-input').value.trim()) sendGroup(); else { $('#group-input').focus(); toast('Ketik pesan dulu ya'); } };
  $('#group-input').addEventListener('focus', () => setTimeout(() => { window.scrollTo(0, 0); fitApp(); const b = $('#group-msgs'); b.scrollTop = b.scrollHeight; }, 350));
  $('#group-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendGroup(); });
  if (isWeb()) { show('thread'); playThread(); }
  let wasWeb = isWeb();
  window.addEventListener('resize', () => {
    const w = isWeb();
    if (w === wasWeb) return;
    wasWeb = w;
    const cur = document.querySelector('#view-group.active, #view-profile.active, #view-status.active, #view-thread.active');
    show(cur ? cur.id.replace('view-', '') : 'chats');
    if (w && !state.playedAll) playThread();
  });
  $('#gate-cancel').onclick = cancelGate;
  $('#name-gate').addEventListener('click', (e) => { if (e.target.id === 'name-gate') cancelGate(); });
  // poll for new group messages while the guest is elsewhere: update the chat-list entry, badge, and play the chat tone
  setInterval(async () => {
    if (!state.joined || !state.data) return;
    if ($('#view-group').classList.contains('active')) return;
    try {
      const r = await fetch('/api/messages');
      const o = await r.json();
      const msgs = o.messages || [];
      if (lastGroupCount == null) { lastGroupCount = msgs.length; state.groupMsgs = msgs; return; }
      if (msgs.length > lastGroupCount) {
        const m = msgs[msgs.length - 1];
        state.groupMsgs = msgs;
        lastGroupCount = msgs.length;
        updateGroupEntry();
        if (m && !(state.guest && m.name.toLowerCase() === state.guest.toLowerCase())) chatTone();
      }
    } catch { /* silent poll */ }
  }, 25000);
  $('#gate-save').onclick = closeGate;
  $('#gate-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') closeGate(); });
}
document.addEventListener('DOMContentLoaded', () => { fitApp(); boot(); });
