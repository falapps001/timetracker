// Data: salinan lengkap di perangkat (IndexedDB) + sinkronisasi Firebase.
//
// Struktur di server (Firestore), semuanya di bawah users/{uid}:
//   days/{YYYY-MM-DD}  { entries: { [id]: {a,s,e,n,u,del} }, u: <waktu server> }
//                      -> 1 dokumen per hari, bukan per catatan (hemat kuota baca)
//   meta/acts          { acts: { [id]: {name,icon,color,order,hidden,u} }, u }
//   devices/{deviceId} { name, last }
//
// Sinkronisasi hanya mengambil dokumen hari yang berubah sejak sinkron terakhir
// (field `u` > cursor). Perubahan lokal masuk antrean (outbox) di IndexedDB dulu,
// jadi aman saat offline atau aplikasi ditutup sebelum sempat terkirim.

import { CONFIG, SDK, EMULATOR } from './firebase-config.js';

export const DEFAULT_ACTS = [
  ['kerja', 'Kerja', '💼', '#4F7CE8'],
  ['self-development', 'Self Development', '🌱', '#2E9E6E'],
  ['self-management', 'Self Management', '🧭', '#6E8F3A'],
  ['nihonggo', 'Nihonggo', '⛩️', '#D9534F'],
  ['sholat', 'Sholat', '🕌', '#1F9D8A'],
  ['makan', 'Makan', '🍽️', '#D9822B'],
  ['tidur', 'Tidur', '😴', '#5B5BD6'],
  ['mandi', 'Mandi', '🚿', '#2B9BC9'],
  ['get-ready', 'Get Ready', '👔', '#6C8EBF'],
  ['otw', 'OTW', '🛵', '#607D8B'],
  ['scroll-gajelas', 'Scroll Gajelas', '📱', '#8B6FD6'],
  ['ngasoh', 'Ngasoh Merenung Rokokan', '🚬', '#6B7584'],
  ['bokep', 'Bokep', '🔞', '#9E3B4E'],
  ['masak', 'Masak Kora2', '🍳', '#C98A1E'],
  ['home-cleaning', 'Home Cleaning', '🧹', '#A0794F'],
  ['umbah', 'Umbah2 Mepe', '🧺', '#7C6FB0'],
  ['blonjo', 'Blonjo', '🛒', '#C96B2E'],
  ['sosial', 'Sosial', '👥', '#B8860B'],
  ['family', 'Family', '👨‍👩‍👧', '#C9579A'],
  ['baca-buku', 'Baca Buku', '📖', '#3F8F4D'],
  ['internet', 'Internet', '🌐', '#2A9DA8'],
  ['research', 'Research', '🔬', '#3F6FB5'],
  ['piano', 'Piano', '🎹', '#7A4FC9'],
  ['skincare', 'Skincare', '🧴', '#E07BA6'],
  ['file-management', 'File Management', '📁', '#56789F'],
  ['love', 'Love', '❤️', '#E5484D'],
].map(([id, name, icon, color], order) => ({ id, name, icon, color, order, hidden: false, u: 0 }));
const DEFAULTS_V = 2;
const OLD_DEFAULTS = ['belajar', 'olahraga', 'perjalanan', 'rumah', 'hiburan']; // daftar bawaan versi 1.0

// Ganti daftar bawaan lama dengan yang baru. Aktivitas yang sudah Anda ubah sendiri tidak disentuh.
function migrateDefaults() {
  const used = new Set(S.entries.map(x => x.a));
  const untouched = a => !(a.u > 0);
  S.acts = S.acts.filter(a => !(OLD_DEFAULTS.includes(a.id) && untouched(a) && !used.has(a.id)));
  S.acts.forEach(a => { if (OLD_DEFAULTS.includes(a.id) && untouched(a)) a.hidden = true; });
  for (const d of DEFAULT_ACTS) {
    const ex = S.acts.find(a => a.id === d.id);
    if (!ex) S.acts.push({ ...d }); else if (untouched(ex)) Object.assign(ex, { ...d });
  }
  const rank = a => { const i = DEFAULT_ACTS.findIndex(d => d.id === a.id); return i >= 0 ? i : 100 + (a.order ?? 0); };
  S.acts.sort((p, q) => rank(p) - rank(q));
}

export const S = { acts: [], entries: [], tombs: {} };
export const sync = {
  enabled: !!CONFIG, user: null, status: 'local', // local | idle | syncing | offline | error
  lastSync: 0, pending: 0, error: '', deviceId: '', ready: false,
  stats: { reads: 0, writes: 0 }, // perkiraan pemakaian kuota sejak aplikasi dibuka
};
let onChange = () => {}, onStatus = () => {};
export function listen(change, status) { onChange = change; onStatus = status; }
const setStatus = (st, err = '') => { sync.status = st; sync.error = err; onStatus(); };

/* ---------------- util ---------------- */
const pad = n => String(n).padStart(2, '0');
export const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const rand = () => Math.random().toString(36).slice(2, 8);
export const uid = () => Date.now().toString(36) + rand();

/* ---------------- IndexedDB ---------------- */
let idb = null;
const mem = { kv: new Map(), entries: new Map(), outbox: new Map() }; // cadangan bila IndexedDB tidak tersedia
let memKey = 1;
function openDB() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('waktu', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('entries', { keyPath: 'id' });
        d.createObjectStore('kv');
        d.createObjectStore('outbox', { autoIncrement: true });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}
const P = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function tx(stores, mode, fn) {
  if (!idb) return Promise.resolve(fn(null));
  return new Promise((res, rej) => {
    const t = idb.transaction(stores, mode); let out;
    Promise.resolve(fn(t)).then(v => out = v);
    t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error);
  });
}
async function kvGet(k) { if (!idb) return mem.kv.get(k); return P(idb.transaction('kv').objectStore('kv').get(k)); }
async function kvSet(k, v) { if (!idb) { mem.kv.set(k, v); return; } return tx(['kv'], 'readwrite', t => { t.objectStore('kv').put(v, k); }); }

/* ---------------- deteksi perubahan lokal ---------------- */
// UI cukup mengubah S lalu memanggil commit(); di sini dicari apa yang berubah.
const sigE = x => `${x.a}|${x.s}|${x.e}|${x.n}`;
const sigA = a => `${a.name}|${a.icon}|${a.color}|${a.order}|${a.hidden ? 1 : 0}`;
let prevE = new Map(), prevA = new Map();
function snapshotPrev() {
  prevE = new Map(S.entries.map(x => [x.id, { sig: sigE(x), day: dayKey(x.s) }]));
  prevA = new Map(S.acts.map(a => [a.id, sigA(a)]));
}
const recE = x => ({ a: x.a, s: x.s, e: x.e ?? null, n: x.n || '', u: x.u, del: false });
const recA = a => ({ name: a.name, icon: a.icon, color: a.color, order: a.order, hidden: !!a.hidden, u: a.u });

export function commit() {
  S.acts.forEach((a, i) => { a.order = i; });
  const now = Date.now(), ops = [], put = [], del = [], cur = new Set();
  for (const x of S.entries) {
    cur.add(x.id);
    const p = prevE.get(x.id), sg = sigE(x), day = dayKey(x.s);
    if (p && p.sig === sg) continue;
    x.u = now; if (x.e === undefined) x.e = null; put.push(x);
    ops.push({ k: 'd', day, id: x.id, rec: recE(x) });
    if (p && p.day !== day) ops.push({ k: 'd', day: p.day, id: x.id, rec: { del: true, u: now } });
  }
  for (const [id, p] of prevE) if (!cur.has(id)) {
    del.push(id); S.tombs[id] = now;
    ops.push({ k: 'd', day: p.day, id, rec: { del: true, u: now } });
  }
  let actsChanged = false;
  for (const a of S.acts) if (prevA.get(a.id) !== sigA(a)) {
    a.u = now; actsChanged = true; ops.push({ k: 'a', id: a.id, rec: recA(a) });
  }
  snapshotPrev();
  if (!ops.length) return Promise.resolve();
  sync.pending += 1;
  const done = persistLocal(put, del, actsChanged || del.length, ops).then(() => flushSoon());
  onStatus();
  return done;
}

async function persistLocal(put, del, metaChanged, ops) {
  if (!idb) {
    put.forEach(x => mem.entries.set(x.id, { ...x })); del.forEach(id => mem.entries.delete(id));
    if (ops) mem.outbox.set(memKey++, { ops });
    return;
  }
  await tx(['entries', 'kv', 'outbox'], 'readwrite', t => {
    const es = t.objectStore('entries');
    put.forEach(x => es.put({ id: x.id, a: x.a, s: x.s, e: x.e ?? null, n: x.n || '', u: x.u || 0 }));
    del.forEach(id => es.delete(id));
    if (metaChanged) {
      t.objectStore('kv').put(S.acts.map(a => ({ ...a })), 'acts');
      t.objectStore('kv').put(S.tombs, 'tombs');
    }
    if (ops) t.objectStore('outbox').add({ ops });
  });
}

/* ---------------- menerapkan data dari server ---------------- */
// Server menyimpan versi yang TIBA terakhir, belum tentu yang TERBARU.
// Bila server ternyata memegang versi lebih lama dari salinan lokal, versi lokal dikirim ulang
// (resend) supaya semua perangkat akhirnya sama.
function applyDay(dayId, entries, resend) {
  let changed = 0; const put = [], del = [];
  const byId = new Map(S.entries.map(x => [x.id, x]));
  for (const [id, r] of Object.entries(entries || {})) {
    const local = byId.get(id);
    if (r.del) {
      if (!S.tombs[id] || S.tombs[id] < r.u) S.tombs[id] = r.u;
      // hapus hanya bila salinan lokal memang masih di hari ini dan tidak lebih baru
      if (local && dayKey(local.s) === dayId && (local.u || 0) <= r.u) {
        S.entries.splice(S.entries.indexOf(local), 1); byId.delete(id); del.push(id); changed++;
      }
      continue;
    }
    if (S.tombs[id] && S.tombs[id] >= r.u) {           // sudah dihapus di sini setelahnya
      if (S.tombs[id] > r.u) resend.push({ k: 'd', day: dayId, id, rec: { del: true, u: S.tombs[id] } });
      continue;
    }
    if (local && (local.u || 0) >= r.u) {              // salinan lokal lebih baru / sama
      if ((local.u || 0) > r.u) resend.push(dayKey(local.s) === dayId
        ? { k: 'd', day: dayId, id, rec: recE(local) }
        : { k: 'd', day: dayId, id, rec: { del: true, u: local.u } });  // sudah pindah ke hari lain
      continue;
    }
    const x = { id, a: r.a, s: r.s, e: r.e ?? null, n: r.n || '', u: r.u };
    if (local) Object.assign(local, x); else { S.entries.push(x); byId.set(id, x); }
    put.push(x); changed++;
  }
  return { changed, put, del };
}
function applyActs(remote, resend) {
  let changed = false;
  for (const [id, r] of Object.entries(remote || {})) {
    const local = S.acts.find(a => a.id === id);
    if (local && (local.u || 0) >= r.u) { if ((local.u || 0) > r.u) resend.push({ k: 'a', id, rec: recA(local) }); continue; }
    const a = { id, name: r.name, icon: r.icon, color: r.color, order: r.order ?? 99, hidden: !!r.hidden, u: r.u };
    if (local) Object.assign(local, a); else S.acts.push(a);
    changed = true;
  }
  if (changed) S.acts.sort((p, q) => (p.order ?? 99) - (q.order ?? 99));
  return changed;
}
// Dua perangkat bisa memulai aktivitas berbeda saat belum sinkron.
// Yang lebih lama dihentikan tepat saat yang terbaru dimulai.
function normalizeRunning() {
  const run = S.entries.filter(x => x.e == null).sort((p, q) => q.s - p.s);
  if (run.length < 2) return false;
  for (const x of run.slice(1)) {
    if (run[0].s - x.s >= 60e3) x.e = run[0].s; else S.entries.splice(S.entries.indexOf(x), 1);
  }
  return true;
}

/* ---------------- Firebase ---------------- */
let fb = null, unsubDays = null, unsubActs = null, cursor = 0, firstServer = null, lastDeviceMark = 0;

async function loadFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${SDK}/`;
  const files = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => base + f);
  const [app, auth, fs] = await Promise.all(files.map(f => import(f)));
  // simpan library ke cache supaya aplikasi tetap bisa sinkron walau dibuka saat offline
  try { caches.open('sdk-' + SDK).then(c => Promise.all(files.map(f => c.match(f).then(m => m || c.add(f))))).catch(() => {}); } catch {}
  const fapp = app.initializeApp(CONFIG);
  const a = auth.getAuth(fapp);
  const db = fs.initializeFirestore(fapp, { localCache: fs.memoryLocalCache() });
  if (EMULATOR) {
    auth.connectAuthEmulator(a, `http://${EMULATOR}:9099`, { disableWarnings: true });
    fs.connectFirestoreEmulator(db, EMULATOR, 8080);
  }
  fb = { auth: a, A: auth, fs, db };
}
const col = (...p) => fb.fs.collection(fb.db, 'users', sync.user.uid, ...p);
const ref = (...p) => fb.fs.doc(fb.db, 'users', sync.user.uid, ...p);

function startListeners() {
  stopListeners();
  const { onSnapshot } = fb.fs;
  unsubActs = onSnapshot(ref('meta', 'acts'), snap => {
    if (!snap.metadata.fromCache) sync.stats.reads++;
    if (!snap.exists() || snap.metadata.hasPendingWrites) return;
    const resend = [];
    if (applyActs(snap.data().acts, resend)) { snapshotPrev(); kvSet('acts', S.acts.map(a => ({ ...a }))); onChange(); }
    queueOps(resend);
  }, onSyncError);
  listenDays();
}
function listenDays() {
  unsubDays?.();
  const { onSnapshot, query, where, Timestamp } = fb.fs;
  // cursor disimpan dalam mikrodetik (presisi waktu server), jadi tidak ada dokumen yang dibaca ulang
  const since = new Timestamp(Math.floor(cursor / 1e6), (cursor % 1e6) * 1000);
  let resolveFirst; firstServer = new Promise(r => { resolveFirst = r; });
  // includeMetadataChanges: supaya tahu kapan server sudah mengonfirmasi, walau tidak ada data baru
  unsubDays = onSnapshot(query(col('days'), where('u', '>', since)), { includeMetadataChanges: true }, snap => {
    let changed = 0, maxU = cursor; const put = [], del = [], resend = [];
    if (!snap.metadata.fromCache) sync.stats.reads += Math.max(1, snap.docChanges().filter(c => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites).length);
    for (const c of snap.docChanges()) {
      if (c.type === 'removed' || c.doc.metadata.hasPendingWrites) continue;
      const d = c.doc.data(), r = applyDay(c.doc.id, d.entries, resend);
      changed += r.changed; put.push(...r.put); del.push(...r.del);
      const u = d.u ? d.u.seconds * 1e6 + Math.floor(d.u.nanoseconds / 1e3) : 0; if (u > maxU) maxU = u;
    }
    if (changed) {
      const fixed = normalizeRunning();
      snapshotPrev();
      persistLocal(put, del, true, null);
      if (fixed) commit();
      onChange();
    }
    queueOps(resend);
    if (maxU > cursor) { cursor = maxU; kvSet('cursor', cursor); }
    if (!snap.metadata.fromCache) { resolveFirst(); markSynced(); }
  }, onSyncError);
}
function stopListeners() { unsubDays?.(); unsubActs?.(); unsubDays = unsubActs = null; }
function onSyncError(err) {
  console.warn(err);
  setStatus(navigator.onLine ? 'error' : 'offline', err.code === 'permission-denied' ? 'Access denied. Check the Firestore security rules.' : err.message);
}

function markSynced() {
  sync.lastSync = Date.now();
  if (!flushing) setStatus('idle');
  kvSet('lastSync', sync.lastSync);
  if (Date.now() - lastDeviceMark > 5 * 60e3) markDevice();
}
function markDevice() {
  if (!sync.user) return;
  lastDeviceMark = Date.now();
  sync.stats.writes++;
  fb.fs.setDoc(ref('devices', sync.deviceId), { name: deviceName(), last: fb.fs.serverTimestamp() }, { merge: true }).catch(() => {});
}

/* ---------------- kirim antrean ---------------- */
function queueOps(ops) {
  if (!ops.length) return;
  sync.pending += 1;
  persistLocal([], [], false, ops).then(() => flushSoon());
}
let flushing = null, flushTimer = 0;
function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 300); }
export function flush() {
  if (!sync.user || !fb) return Promise.resolve(false);
  if (flushing) return flushing;
  flushing = (async () => {
    let keys = [], items = [];
    if (idb) {
      await tx(['outbox'], 'readonly', async t => {
        const st = t.objectStore('outbox');
        [keys, items] = await Promise.all([P(st.getAllKeys()), P(st.getAll())]);
      });
    } else { keys = [...mem.outbox.keys()]; items = [...mem.outbox.values()]; }
    sync.pending = items.length; onStatus();
    if (!items.length) return true;
    setStatus('syncing');
    // gabungkan semua perubahan per dokumen; versi terbaru per catatan yang menang
    const days = new Map(), acts = {};
    for (const it of items) for (const op of it.ops) {
      if (op.k === 'd') {
        const m = days.get(op.day) || {}; const p = m[op.id];
        if (!p || p.u <= op.rec.u) m[op.id] = op.rec; days.set(op.day, m);
      } else if (!acts[op.id] || acts[op.id].u <= op.rec.u) acts[op.id] = op.rec;
    }
    const { writeBatch, serverTimestamp } = fb.fs;
    const writes = [...days].map(([day, m]) => [ref('days', day), { entries: m, u: serverTimestamp() }]);
    if (Object.keys(acts).length) writes.push([ref('meta', 'acts'), { acts, u: serverTimestamp() }]);
    for (let i = 0; i < writes.length; i += 400) {
      const b = writeBatch(fb.db);
      writes.slice(i, i + 400).forEach(([r, d]) => b.set(r, d, { merge: true }));
      await b.commit(); sync.stats.writes += Math.min(400, writes.length - i);
    }
    if (idb) await tx(['outbox'], 'readwrite', t => { const st = t.objectStore('outbox'); keys.forEach(k => st.delete(k)); });
    else keys.forEach(k => mem.outbox.delete(k));
    sync.pending = 0; setStatus('idle'); markSynced();
    return true;
  })().catch(err => { onSyncError(err); return false; }).finally(() => { flushing = null; });
  return flushing;
}

/* ---------------- tombol sinkron ---------------- */
export async function syncNow() {
  if (!sync.user) throw new Error('Sign in from Settings to sync your data.');
  if (!navigator.onLine) throw new Error('No internet. Your data is saved on this device and will upload automatically later.');
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('The server is not responding. Try again later.')), 20e3));
  setStatus('syncing');
  try {
    await Promise.race([(async () => {
      const ok = await flush(); if (ok === false) throw new Error(sync.error || 'Failed to upload data.');
      listenDays();                       // ambil ulang perubahan terbaru dari server
      await firstServer;
    })(), timeout]);
    markDevice(); setStatus('idle'); markSynced();
  } catch (e) { setStatus(navigator.onLine ? 'error' : 'offline', e.message); throw e; }
}

/* ---------------- akun ---------------- */
const authMsg = e => ({
  'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with this email yet.', 'auth/invalid-email': 'Invalid email address.',
  'auth/email-already-in-use': 'This email is already registered. Use Sign in.', 'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/network-request-failed': 'No internet.', 'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase (see guide step 4).',
  'auth/admin-restricted-operation': 'New sign-ups are disabled in Firebase.',
}[e.code] || e.message);
export async function signIn(email, pw) { try { await fb.A.signInWithEmailAndPassword(fb.auth, email, pw); } catch (e) { throw new Error(authMsg(e)); } }
export async function signUp(email, pw) { try { await fb.A.createUserWithEmailAndPassword(fb.auth, email, pw); } catch (e) { throw new Error(authMsg(e)); } }
export async function resetPassword(email) { try { await fb.A.sendPasswordResetEmail(fb.auth, email); } catch (e) { throw new Error(authMsg(e)); } }
export async function signOut() {
  stopListeners();
  await fb.A.signOut(fb.auth);
  await wipeLocal();
  location.reload();
}
async function wipeLocal() {
  if (idb) await tx(['entries', 'kv', 'outbox'], 'readwrite', t => { ['entries', 'kv', 'outbox'].forEach(n => t.objectStore(n).clear()); });
}
async function onUser(u) {
  if (!u) {
    sync.user = null; stopListeners(); setStatus('local'); return;
  }
  const prevUid = await kvGet('uid');
  if (prevUid && prevUid !== u.uid) {
    // data lokal milik akun lain: bersihkan dulu
    await wipeLocal(); S.entries = []; S.tombs = {}; S.acts = DEFAULT_ACTS.map(a => ({ ...a })); cursor = 0;
    snapshotPrev(); await kvSet('deviceId', sync.deviceId); onChange();
  }
  await kvSet('uid', u.uid);
  sync.user = { uid: u.uid, email: u.email };
  setStatus('syncing');
  startListeners();
  flush();
}

export async function listDevices() {
  if (!sync.user) return [];
  const snap = await fb.fs.getDocs(col('devices')); sync.stats.reads += Math.max(1, snap.size);
  return snap.docs.map(d => ({ id: d.id, name: d.data().name, last: d.data().last?.toMillis?.() || 0, me: d.id === sync.deviceId }))
    .sort((p, q) => q.last - p.last);
}

export function deviceName() {
  const u = navigator.userAgent;
  const ipad = /iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1);
  const os = /iPhone/.test(u) ? 'iPhone' : ipad ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows'
    : /Mac/.test(u) ? 'Mac' : /CrOS/.test(u) ? 'Chromebook' : /Linux/.test(u) ? 'Linux' : 'Device';
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  return /iPhone|iPad|Android/.test(os) ? os : (br ? `${br} di ${os}` : os);
}
export const isMobileName = n => /iPhone|iPad|Android/.test(n);

/* ---------------- backup ---------------- */
export const getLastBackup = () => kvGet('lastBackup');
export const setLastBackup = t => kvSet('lastBackup', t);

/* ---------------- mulai ---------------- */
let starting = null;
function startFirebase() {
  if (fb || starting) return starting;
  starting = (async () => {
    try {
      await loadFirebase();
      fb.A.onAuthStateChanged(fb.auth, u => { onUser(u).catch(onSyncError); });
    } catch (e) {
      console.warn(e); fb = null;
      setStatus(navigator.onLine ? 'error' : 'offline', navigator.onLine ? 'Could not load Firebase. Check your internet or firebase-config.js.' : 'Offline · will send automatically when online');
    } finally { starting = null; }
  })();
  return starting;
}

export async function init() {
  idb = await openDB();
  try { navigator.storage?.persist?.(); } catch {}
  const [acts, tombs, cur, dev, last] = await Promise.all(['acts', 'tombs', 'cursor', 'deviceId', 'lastSync'].map(kvGet));
  S.acts = acts?.length ? acts : DEFAULT_ACTS.map(a => ({ ...a }));
  S.acts.sort((p, q) => (p.order ?? 99) - (q.order ?? 99));
  const defaultsV = await kvGet('defaultsV');
  S.tombs = tombs || {};
  cursor = cur > 1e15 ? cur : 0; // mikrodetik
  sync.lastSync = last || 0;
  sync.deviceId = dev || (uid() + rand());
  if (!dev) await kvSet('deviceId', sync.deviceId);
  S.entries = idb ? await P(idb.transaction('entries').objectStore('entries').getAll()) : [];
  if ((defaultsV || 1) < DEFAULTS_V) {
    if (acts?.length) migrateDefaults();
    await kvSet('acts', S.acts.map(a => ({ ...a }))); await kvSet('defaultsV', DEFAULTS_V);
  }
  if (idb) sync.pending = await P(idb.transaction('outbox').objectStore('outbox').count());
  snapshotPrev();
  sync.ready = true;

  if (CONFIG) await startFirebase();
  addEventListener('online', () => {
    if (CONFIG && !fb) return startFirebase();          // gagal dimuat saat offline: coba lagi
    if (sync.user) { setStatus('syncing'); flush(); listenDays(); }
  });
  addEventListener('offline', () => { if (sync.user) setStatus('offline'); });
  // setelah lama di latar belakang, pasang ulang listener dengan cursor terbaru (lebih hemat kuota)
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (sync.user && Date.now() - hiddenAt > 20 * 60e3) { listenDays(); flush(); }
  });
}
