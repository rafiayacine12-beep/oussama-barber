/**
 * BACKEND — Barber Junior (Google Apps Script) · v11 (comptes coiffeurs + caisse)
 * ---------------------------------------------------
 * Feuilles (kaytwjdo b wa7dhom):
 *   Reservations · Blocages · Attente · Produits · Commandes
 *
 * Statut d'une réservation (colonne "statut"): en attente · confirmé · venu · absent · annulé
 *   - "en attente" => l-client sifet, Oussama khasso yvalidi men l-admin (l-crénau msdod).
 *   - "annulé" => l-crénau kayrje3 khawi.
 *
 * Blocages (pause, congé, 3id…): date | de | a | coiffeur | raison
 *   - coiffeur khawi wla "tous" => l-salon kamel msdod f dak l-wa9t.
 *   - de/a khawyin => nhar kamel.
 *
 * ⚙️ RÉGLAGES — beddel hna
 */
const ADMIN_PIN = 'CHANGE_MOI';          // ⚠️ code dyal mol s-salon: beddlo GHIR f Apps Script, ma t7ottouch hna (repo public)
// (Codes dyal les coiffeurs kaytsjjlo men l-admin → Salon → L-équipe)
const NOTIFY_EMAIL = '';                  // khawi = email dyal compte Google li dar déploiement
const TELEGRAM_TOKEN = '';                // optionnel: token dyal bot Telegram (@BotFather)
const TELEGRAM_CHAT_ID = '';              // optionnel: chat id dyal Oussama
// Notification f WhatsApp (gratuit, CallMeBot): numéro (212…) + apikey li katwsel men CallMeBot
const WHATSAPP_PHONE = '';                // ex: '212655778899'
const WHATSAPP_APIKEY = '';               // ex: '1234567'
// Notification push b l-application ntfy (gratuit): smiya dyal topic (sirriya!)
const NTFY_TOPIC = '';                    // ex: 'oussama-barber-x7k2p9'

// Validation & anti-fake
const REQUIRE_VALIDATION = true;          // true = kol réservation katbda "en attente" 7ta tvalidiha
const MAX_ACTIVE_PER_PHONE = 1;           // ch7al mn réservation jaya y9der ykoun 3and nefs n-numéro
const ABSENT_LIMIT = 2;                   // men b3d ch7al mn "absent" kaytbloka n-numéro automatiquement (0 = la)
const SALON = 'Oussama Barber';
// Équipe par défaut (mra lowla). Mn b3d kolchi katbeddlo men page admin → onglet "Équipe".
const DEFAULT_TEAM = ['Oussama', 'Yassine', 'Aymane'];
const DEFAULT_HOURS = ['11:00', '21:00'];
const DAYKEYS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
// Services par défaut (mra lowla). Mn b3d katbeddlo men page admin → "Salon" → "Services".
const DEFAULT_SERVICES = [
  { id: 's1', prix: 40, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Coupe', da: 'Coupe', ar: 'حلاقة الشعر' }, desc: { fr: 'Coupe + shampoing', da: 'Coupe + lavage', ar: 'قص وغسل' } },
  { id: 's2', prix: 50, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Dégradé', da: 'Dégradé', ar: 'ديغرادي' }, desc: { fr: 'Fade bas, mid ou high', da: 'Fade bas, mid wla high', ar: 'منخفض، متوسط أو عالي' } },
  { id: 's3', prix: 25, duree: 20, top: false, actif: true, photo: '', nom: { fr: 'Barbe', da: 'Barbe', ar: 'اللحية' }, desc: { fr: 'Taille, contours et serviette chaude', da: 'Taille, contours w serviette skhouna', ar: 'تشذيب وتحديد ومنشفة ساخنة' } },
  { id: 's4', prix: 60, duree: 45, top: true,  actif: true, photo: '', nom: { fr: 'Coupe + Barbe', da: 'Coupe + Barbe', ar: 'شعر + لحية' }, desc: { fr: 'La formule complète', da: 'L-pack kamel', ar: 'الباقة الكاملة' } },
  { id: 's5', prix: 60, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Soin visage', da: 'Soin visage', ar: 'عناية بالوجه' }, desc: { fr: 'Masque et nettoyage', da: 'Masque w nettoyage', ar: 'قناع وتنظيف' } },
  { id: 's6', prix: 30, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Coupe enfant', da: 'Coupe enfant', ar: 'حلاقة الأطفال' }, desc: { fr: 'Moins de 12 ans', da: '9el mn 12 3am', ar: 'أقل من 12 سنة' } }
];
const SITE_URL = 'https://barber-junior.vercel.app';

const SHEETS = {
  Reservations: ['date','heure','debut_min','duree_min','coiffeur','services','prix_dh','nom','telephone','statut','cree_le','id','remise_dh','langue'],
  Blocages:     ['date','de','a','coiffeur','raison','id','cree_le'],
  Attente:      ['date','nom','telephone','services','coiffeur','statut','cree_le','id'],
  Bloques:      ['telephone','raison','cree_le'],
  Produits:     ['id','nom','categorie','prix_dh','ancien_prix_dh','description','photo','stock','actif','ordre'],
  Commandes:    ['id','cree_le','nom','telephone','mode','ville','adresse','produits','sous_total_dh','livraison_dh','total_dh','statut','note','items_json']
};

/* ---------------- helpers ---------------- */
function sh_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold');
  } else if (sh.getLastColumn() < SHEETS[name].length) {
    // zid les colonnes jdad ila kanet l-feuille 9dima
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
  }
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function day_(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v).replace(/^'/, '').trim(); }
function hm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  const s = String(v).replace(/^'/, '').trim(); return /^\d{1,2}:\d{2}$/.test(s) ? ('0' + s).slice(-5) : '';
}
function toMin_(s) { const p = s.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function hh_(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
function phone_(p) { let d = String(p || '').replace(/\D/g, ''); if (d.indexOf('212') === 0) d = '0' + d.slice(3); return d; }
function txt_(v) { return "'" + v; }
function today_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function id_() { return Utilities.getUuid().slice(0, 8).toUpperCase(); }
function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function cancelled_(st) { return String(st).toLowerCase().indexOf('annul') === 0; }
function pending_(st) { return String(st).toLowerCase().indexOf('attente') >= 0; }
function absent_(st) { return String(st).toLowerCase().indexOf('absent') === 0; }

function rows_(name) {
  const sh = sh_(name), vals = sh.getDataRange().getValues(), head = SHEETS[name];
  return vals.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => o[h] = r[j]);
    return o;
  });
}
function reservations_() {
  return rows_('Reservations').map(r => ({
    row: r._row, date: day_(r.date), heure: hm_(r.heure) || hh_(Number(r.debut_min)), start: Number(r.debut_min), dur: Number(r.duree_min),
    barber: String(r.coiffeur), services: String(r.services), prix: Number(r.prix_dh) || 0, nom: String(r.nom),
    tel: String(r.telephone).replace(/^'/, ''), statut: String(r.statut || 'confirmé'), id: String(r.id), remise: Number(r.remise_dh) || 0,
    langue: String(r.langue || '')
  }));
}
function blocks_() {
  return rows_('Blocages').map(r => {
    const de = hm_(r.de), a = hm_(r.a), c = String(r.coiffeur || '').trim();
    return { row: r._row, date: day_(r.date), start: de ? toMin_(de) : 0, end: a ? toMin_(a) : 24 * 60,
      barber: (!c || c.toLowerCase() === 'tous') ? '*' : c, raison: String(r.raison || ''), id: String(r.id || ''), de: de, a: a };
  }).filter(b => isDate_(b.date));
}
function busyFor_(date) {
  const res = reservations_().filter(r => r.date === date && !cancelled_(r.statut)).map(r => ({ start: r.start, dur: r.dur, barber: r.barber }));
  const bl = blocks_().filter(b => b.date === date).map(b => ({ start: b.start, dur: b.end - b.start, barber: b.barber }));
  return res.concat(bl);
}
function overlaps_(l, b, s, d) { return l.some(x => (x.barber === '*' || x.barber === b) && s < x.start + x.dur && x.start < s + d); }

/* ---------------- config (équipe + galerie) ---------------- */
function config_() {
  const raw = PropertiesService.getScriptProperties().getProperty('config');
  let c = null; try { c = raw ? JSON.parse(raw) : null; } catch (e) {}
  if (!c) c = { coiffeurs: DEFAULT_TEAM.map((n, i) => ({ id: 'c' + (i + 1), nom: n, actif: true, photo: '', de: DEFAULT_HOURS[0], a: DEFAULT_HOURS[1], repos: [] })), galerie: [] };
  c.coiffeurs = c.coiffeurs || []; c.galerie = c.galerie || [];
  if (!Array.isArray(c.services) || !c.services.length) c.services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
  c.salon = c.salon || { maps: '', instagram: '', facebook: '' };
  if (!c.salon.nom) c.salon.nom = SALON;
  return c;
}
function saveConfig_(c) { PropertiesService.getScriptProperties().setProperty('config', JSON.stringify(c)); }
function publicConfig_() {
  const c = config_();
  return { ok: true, coiffeurs: c.coiffeurs.filter(x => x.actif).map(x => ({ id: x.id, nom: x.nom, photo: x.photo || '', de: x.de, a: x.a, repos: x.repos || [] })),
    galerie: c.galerie.map(g => g.url),
    salon: c.salon,
    services: c.services.filter(s => s.actif).map(s => ({ id: s.id, nom: s.nom, desc: s.desc, prix: s.prix, duree: s.duree, top: !!s.top, photo: s.photo || '' })),
    boutique: (() => { try { return publicShop_(); } catch (e) { return null; } })() };
}
function worksAt_(name, date, start, dur) {
  const c = config_().coiffeurs.find(x => x.nom === name);
  if (!c) return true;                                   // coiffeur ma kaynch f config → ma nmn3ouch
  if (!c.actif) return false;
  const p = date.split('-').map(Number), day = DAYKEYS[new Date(p[0], p[1] - 1, p[2]).getDay()];
  if ((c.repos || []).indexOf(day) >= 0) return false;
  return start >= toMin_(c.de || DEFAULT_HOURS[0]) && start + dur <= toMin_(c.a || DEFAULT_HOURS[1]);
}
function photosFolder_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('folder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(SALON + ' — Photos du site');
  props.setProperty('folder', f.getId());
  return f;
}
function imgUrl_(id) { return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200'; }
function upload_(b) {
  const data = String(b.data || ''), mime = String(b.mime || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$/.test(mime) || !data || data.length > 8 * 1024 * 1024) return null;
  const blob = Utilities.newBlob(Utilities.base64Decode(data), mime, (b.name || 'photo') + '.' + mime.split('/')[1]);
  const file = photosFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), url: imgUrl_(file.getId()) };
}

/* ---------------- boutique ---------------- */
// Statut dyal commande: nouvelle · confirmée · prête · livrée · annulée
const SHOP_DEFAULT = { actif: true, whatsapp: true, salon: true, livraison: true, frais: 30, gratuitDes: 300, delai: '24–48h', villes: '' };
function shop_() {
  let s = null; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('shop') || 'null'); } catch (e) {}
  return Object.assign({}, SHOP_DEFAULT, s || {});
}
function products_() {
  return rows_('Produits').map(r => ({
    id: String(r.id || ''), nom: String(r.nom || ''), cat: String(r.categorie || ''), prix: Number(r.prix_dh) || 0,
    ancien: Number(r.ancien_prix_dh) || 0, desc: String(r.description || ''), photo: String(r.photo || ''),
    stock: r.stock === '' || r.stock === null ? null : Number(r.stock), actif: !(r.actif === false || String(r.actif).toLowerCase() === 'false'), ordre: Number(r.ordre) || 0
  })).filter(x => x.id && x.nom).sort((a, b) => a.ordre - b.ordre);
}
function saveProducts_(list) {
  const sh = sh_('Produits'), n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, SHEETS.Produits.length).clearContent();
  if (!list.length) return;
  sh.getRange(2, 1, list.length, SHEETS.Produits.length).setValues(list.map((x, i) =>
    [x.id, x.nom, x.cat, x.prix, x.ancien || '', x.desc, x.photo, x.stock === null ? '' : x.stock, x.actif, i + 1]));
}
function publicShop_() {
  const sh = shop_();
  return { shop: { actif: sh.actif, whatsapp: sh.whatsapp, salon: sh.salon, livraison: sh.livraison, frais: sh.frais, gratuitDes: sh.gratuitDes, delai: sh.delai, villes: sh.villes },
    produits: sh.actif ? products_().filter(x => x.actif).map(x => ({ id: x.id, nom: x.nom, cat: x.cat, prix: x.prix, ancien: x.ancien, desc: x.desc, photo: x.photo, stock: x.stock })) : [] };
}
function orders_() {
  return rows_('Commandes').map(r => ({
    row: r._row, id: String(r.id || ''), date: r.cree_le instanceof Date ? Utilities.formatDate(r.cree_le, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(r.cree_le || ''),
    nom: String(r.nom || ''), tel: String(r.telephone || '').replace(/^'/, ''), mode: String(r.mode || ''), ville: String(r.ville || ''), adresse: String(r.adresse || ''),
    produits: String(r.produits || ''), sousTotal: Number(r.sous_total_dh) || 0, livraison: Number(r.livraison_dh) || 0, total: Number(r.total_dh) || 0,
    statut: String(r.statut || 'nouvelle'), note: String(r.note || ''), items: (() => { try { return JSON.parse(String(r.items_json || '[]')); } catch (e) { return []; } })()
  })).filter(o => o.id);
}
function restock_(items, sign) {
  const list = products_(); let ch = false;
  items.forEach(it => { const p = list.find(x => x.id === it.id); if (p && p.stock !== null) { p.stock = Math.max(0, p.stock + sign * it.q); ch = true; } });
  if (ch) saveProducts_(list);
}
function order_(b) {
  if (b.hp) return { ok: false, error: 'invalid' };
  const sh = shop_(), mode = String(b.mode || '');
  if (!sh.actif || ['whatsapp', 'salon', 'livraison'].indexOf(mode) < 0 || !sh[mode]) return { ok: false, error: 'mode' };
  const name = String(b.name || '').trim().slice(0, 80), ph = phone_(b.phone);
  if (name.length < 2 || ph.length < 9) return { ok: false, error: 'invalid' };
  if (isBlocked_(ph)) return { ok: false, error: 'blocked' };
  const ville = String(b.ville || '').trim().slice(0, 60), adresse = String(b.adresse || '').trim().slice(0, 200);
  if (mode === 'livraison' && (ville.length < 2 || adresse.length < 4)) return { ok: false, error: 'address' };
  const cache = CacheService.getScriptCache(), k = 'ord_' + ph, n = Number(cache.get(k) || 0);
  if (n >= 5) return { ok: false, error: 'limit' };
  const prods = products_().filter(x => x.actif), items = [];
  (Array.isArray(b.items) ? b.items : []).slice(0, 30).forEach(it => {
    const p = prods.find(x => x.id === String(it.id)), q = Math.max(1, Math.min(20, Math.round(Number(it.q) || 1)));
    if (p) items.push({ id: p.id, n: p.nom, p: p.prix, q: q, stock: p.stock });
  });
  if (!items.length) return { ok: false, error: 'empty' };
  const out = items.filter(it => it.stock !== null && it.q > it.stock);
  if (out.length) return { ok: false, error: 'stock', items: out.map(it => ({ id: it.id, stock: it.stock })) };
  const sub = items.reduce((a, it) => a + it.p * it.q, 0);
  const liv = mode === 'livraison' ? (sh.gratuitDes > 0 && sub >= sh.gratuitDes ? 0 : Number(sh.frais) || 0) : 0;
  const id = 'C' + id_().slice(0, 6), txtItems = items.map(it => it.q + '× ' + it.n).join(' + ');
  sh_('Commandes').appendRow([id, new Date(), name, txt_(String(b.phone).slice(0, 30)), mode, ville, adresse, txtItems, sub, liv, sub + liv, 'nouvelle',
    String(b.note || '').slice(0, 200), JSON.stringify(items.map(it => ({ id: it.id, n: it.n, p: it.p, q: it.q })))]);
  restock_(items, -1);
  cache.put(k, String(n + 1), 3600);
  const mlabel = { whatsapp: 'WhatsApp', salon: 'F s-salon', livraison: 'Livraison' }[mode];
  notify_('Commande jdida 🛍️', ['🧾 #' + id + ' · ' + mlabel, '🙍 ' + name + ' · ' + b.phone, '📦 ' + txtItems, '💰 ' + (sub + liv) + ' DH' + (liv ? ' (livraison ' + liv + ')' : '')]
    .concat(mode === 'livraison' ? ['📍 ' + ville + ' — ' + adresse] : []), SITE_URL + '/admin.html#boutique', 'book');
  return { ok: true, id: id, sousTotal: sub, livraison: liv, total: sub + liv };
}

/* ---------------- notifications ---------------- */
/* Notifications WhatsApp (CallMeBot) — kaytsjjlo men l-admin → Paramètres */
function notif_() {
  let n = null; try { n = JSON.parse(PropertiesService.getScriptProperties().getProperty('notif') || 'null'); } catch (e) {}
  n = n || {};
  return { phone: n.phone || WHATSAPP_PHONE, apikey: n.apikey || WHATSAPP_APIKEY,
    book: n.book !== false, cancel: n.cancel !== false, wait: n.wait !== false };
}
function sendWa_(n, text) {
  const r = UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent('+' + n.phone) +
    '&apikey=' + encodeURIComponent(n.apikey) + '&text=' + encodeURIComponent(text), { muteHttpExceptions: true });
  return { code: r.getResponseCode(), text: String(r.getContentText() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) };
}
function notify_(subject, lines, link, kind) {
  const body = lines.join('\n');
  const url = link || (SITE_URL + '/admin.html');
  try {
    const n = notif_();
    if (n.phone && n.apikey && n[kind || 'book'] !== false) sendWa_(n, '💈 *' + subject + '*\n\n' + body + '\n\n👉 ' + url);
  } catch (e) { console.error(e); }
  try {
    if (NTFY_TOPIC) {
      UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(NTFY_TOPIC), {
        method: 'post', muteHttpExceptions: true, payload: body,
        headers: { 'Title': '💈 ' + subject, 'Priority': 'high', 'Tags': 'barber', 'Click': url, 'Actions': 'view, Valider, ' + url }
      });
    }
  } catch (e) { console.error(e); }
  try {
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: '💈 ' + subject + '\n\n' + body,
          reply_markup: { inline_keyboard: [[{ text: '👉 Valider / Refuser', url: url }]] } })
      });
    }
  } catch (e) { console.error(e); }
  try {
    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, '💈 ' + subject + ' — ' + (config_().salon.nom || SALON), body + '\n\n👉 ' + url);
  } catch (e) { console.error(e); }
}

/* ---------------- GET ---------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'loyalty') return json_(loyalty_(p.phone));
  if (p.action === 'config') return json_(publicConfig_());
  if (p.action === 'status') {
    const id = String(p.id || '').toUpperCase(), ph = phone_(p.phone);
    const r = reservations_().find(x => x.id.toUpperCase() === id && phone_(x.tel) === ph);
    return json_(r ? { ok: true, statut: r.statut, date: r.date, heure: hh_(r.start), barber: r.barber } : { ok: false, error: 'notfound' });
  }
  if (!isDate_(p.date)) return json_({ ok: false, error: 'date' });
  return json_({ ok: true, bookings: busyFor_(p.date) });
}

function loyalty_(phone) {
  const ph = phone_(phone);
  if (ph.length < 9) return { ok: false, error: 'phone' };
  const t = today_();
  const visits = reservations_().filter(r => phone_(r.tel) === ph && r.date <= t && !cancelled_(r.statut) && !absent_(r.statut) && !pending_(r.statut)).length;
  return { ok: true, visits: visits };
}

/* ---------------- POST ---------------- */
const READ_OPS = ['login', 'list', 'pending', 'blocked', 'blocks', 'waitlist', 'stats', 'getnotif', 'getconfig', 'getshop', 'orders'];
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'json' }); }
  // L-9raya (admin) ma kat7tajch lock: kaytjbdo b jouj f nefs l-wa9t → l-admin kayt7el dghya
  if (b.action === 'admin' && READ_OPS.indexOf(b.op) >= 0) return json_(admin_(b));
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (b.action || 'book') {
      case 'book':     return json_(book_(b));
      case 'cancel':   return json_(cancel_(b));
      case 'waitlist': return json_(waitlist_(b));
      case 'order':    return json_(order_(b));
      case 'admin':    return json_(admin_(b));
      default:         return json_({ ok: false, error: 'action' });
    }
  } finally { lock.releaseLock(); }
}

function blockedPhones_() {
  return rows_('Bloques').map(r => ({ row: r._row, tel: phone_(r.telephone), raison: String(r.raison || ''), date: r.cree_le })).filter(x => x.tel.length >= 9);
}
function isBlocked_(ph) {
  if (blockedPhones_().some(x => x.tel === ph)) return true;
  if (ABSENT_LIMIT > 0) {
    const n = reservations_().filter(r => phone_(r.tel) === ph && absent_(r.statut)).length;
    if (n >= ABSENT_LIMIT) return true;
  }
  return false;
}
function book_(b) {
  const valid = isDate_(b.date) && b.start >= 0 && b.dur > 0 && b.dur <= 480 &&
    String(b.name || '').trim() && phone_(b.phone).length >= 9 && Array.isArray(b.candidates) && b.candidates.length;
  if (!valid) return { ok: false, error: 'invalid' };
  if (b.hp) return { ok: false, error: 'invalid' };                         // piège l les robots
  const ph = phone_(b.phone);
  if (isBlocked_(ph)) return { ok: false, error: 'blocked' };
  if (MAX_ACTIVE_PER_PHONE > 0) {
    const t = today_();
    const active = reservations_().filter(r => phone_(r.tel) === ph && r.date >= t && !cancelled_(r.statut) && !absent_(r.statut)).length;
    if (active >= MAX_ACTIVE_PER_PHONE) return { ok: false, error: 'limit' };
  }
  const busy = busyFor_(b.date);
  const barber = b.candidates.find(c => worksAt_(String(c), b.date, b.start, b.dur) && !overlaps_(busy, String(c), b.start, b.dur));
  if (!barber) return { ok: false, error: 'taken' };
  const id = id_(), hh = hh_(b.start);
  sh_('Reservations').appendRow([txt_(b.date), txt_(hh), b.start, b.dur, String(barber), String(b.services || '').slice(0, 300),
    Number(b.price) || 0, String(b.name).slice(0, 80), txt_(String(b.phone).slice(0, 30)), REQUIRE_VALIDATION ? 'en attente' : 'confirmé', new Date(), id,
    Number(b.discount) || 0, String(b.lang || '').slice(0, 4)]);
  notify_(REQUIRE_VALIDATION ? 'Réservation jdida — khassha validation' : 'Réservation jdida',
    ['📅 ' + b.date + ' · ' + hh, '💈 ' + barber, '✂️ ' + b.services + ' (' + (Number(b.price) || 0) + ' DH)',
    '🙍 ' + b.name + ' · ' + b.phone, '🔖 #' + id], SITE_URL + '/admin.html#pending');
  return { ok: true, barber: String(barber), id: id, statut: REQUIRE_VALIDATION ? 'en attente' : 'confirmé' };
}

function cancel_(b) {
  const id = String(b.id || '').replace('#', '').trim().toUpperCase(), ph = phone_(b.phone);
  if (!id || ph.length < 9) return { ok: false, error: 'invalid' };
  const r = reservations_().find(x => x.id.toUpperCase() === id && phone_(x.tel) === ph);
  if (!r) return { ok: false, error: 'notfound' };
  if (cancelled_(r.statut)) return { ok: true, already: true };
  if (r.date < today_()) return { ok: false, error: 'past' };
  sh_('Reservations').getRange(r.row, 10).setValue('annulé');
  const waiting = rows_('Attente').filter(w => day_(w.date) === r.date && String(w.statut || 'en attente').indexOf('attente') >= 0);
  const lines = ['🙍 ' + r.nom + ' · ' + String(r.tel).replace(/^'/, ''), '📅 ' + r.date + ' · ' + r.heure, '💈 ' + r.barber, '✂️ ' + (r.services || ''), '🔖 #' + r.id, '', '✅ L-blassa wliat khawya f s-site.'];
  if (waiting.length) lines.push('', '⏳ Kaynin ' + waiting.length + ' f liste d\'attente had nhar:', ...waiting.map(w => '• ' + w.nom + ' · ' + String(w.telephone).replace(/^'/, '')));
  notify_('❌ Client annula r-rendez-vous', lines, SITE_URL + '/admin.html', 'cancel');
  return { ok: true, date: r.date, heure: r.heure };
}

function waitlist_(b) {
  if (!isDate_(b.date) || !String(b.name || '').trim() || phone_(b.phone).length < 9) return { ok: false, error: 'invalid' };
  const id = id_();
  sh_('Attente').appendRow([txt_(b.date), String(b.name).slice(0, 80), txt_(String(b.phone).slice(0, 30)), String(b.services || '').slice(0, 300),
    String(b.barber || 'Ay wa7ed'), 'en attente', new Date(), id]);
  notify_('Liste d\'attente', ['📅 ' + b.date, '🙍 ' + b.name + ' · ' + b.phone, '✂️ ' + (b.services || ''), '💈 ' + (b.barber || 'Ay wa7ed')], null, 'wait');
  return { ok: true, id: id };
}

/* ---------------- ADMIN ---------------- */
/* Chkoun dkhel: mol s-salon (ADMIN_PIN) wla coiffeur (code dyalo) */
function who_(pin) {
  pin = String(pin || '');
  if (!pin) return null;
  if (pin === ADMIN_PIN) return { role: 'owner', barber: '' };
  const c = config_().coiffeurs.find(x => x.actif && x.pin && String(x.pin) === pin);
  return c ? { role: 'barber', barber: c.nom } : null;
}
// Chno y9der ydir l-coiffeur (ghir l-khdma dyalo)
const BARBER_OPS = ['login', 'list', 'pending', 'status', 'reschedule', 'getconfig', 'stats', 'blocks', 'block', 'unblock', 'waitlist', 'waitdone', 'add', 'price'];
function safeTeam_(list) { return list.map(x => { const o = Object.assign({}, x); o.hasPin = !!o.pin; delete o.pin; return o; }); }
function rowOut_(r) { return { id: r.id, date: r.date, heure: hh_(r.start), dur: r.dur, barber: r.barber, services: r.services, prix: r.prix, nom: r.nom, tel: r.tel, statut: r.statut, langue: r.langue }; }

function admin_(b) {
  const cache = CacheService.getScriptCache(), fails = Number(cache.get('pinfails') || 0);
  if (fails >= 8) return { ok: false, error: 'locked' };
  const me = who_(b.pin);
  if (!me) { cache.put('pinfails', String(fails + 1), 900); return { ok: false, error: 'pin' }; }
  cache.remove('pinfails');
  const isB = me.role === 'barber', mine = r => !isB || r.barber === me.barber;
  if (isB && BARBER_OPS.indexOf(b.op) < 0) return { ok: false, error: 'forbidden' };

  switch (b.op) {
    case 'login': return { ok: true, salon: config_().salon.nom || SALON, role: me.role, barber: me.barber, v: 11 };
    case 'list': {
      const from = isDate_(b.from) ? b.from : today_(), to = isDate_(b.to) ? b.to : from;
      const list = reservations_().filter(r => r.date >= from && r.date <= to && mine(r))
        .sort((x, y) => (x.date + hh_(x.start)).localeCompare(y.date + hh_(y.start))).map(rowOut_);
      return { ok: true, list: list };
    }
    case 'reschedule': {
      const r = reservations_().find(x => x.id === String(b.id));
      if (!r || !mine(r)) return { ok: false, error: 'notfound' };
      if (cancelled_(r.statut)) return { ok: false, error: 'cancelled' };
      const start = Number(b.start);
      if (!isDate_(b.date) || !(start >= 0) || b.date < today_()) return { ok: false, error: 'invalid' };
      if (!worksAt_(r.barber, b.date, start, r.dur)) return { ok: false, error: 'hours' };
      const busy = reservations_().filter(x => x.row !== r.row && x.date === b.date && !cancelled_(x.statut)).map(x => ({ start: x.start, dur: x.dur, barber: x.barber }))
        .concat(blocks_().filter(k => k.date === b.date).map(k => ({ start: k.start, dur: k.end - k.start, barber: k.barber })));
      if (overlaps_(busy, r.barber, start, r.dur)) return { ok: false, error: 'taken' };
      const sh = sh_('Reservations');
      sh.getRange(r.row, 1, 1, 3).setValues([[txt_(b.date), txt_(hh_(start)), start]]);
      if (pending_(r.statut)) sh.getRange(r.row, 10).setValue('confirmé');
      return { ok: true, date: b.date, heure: hh_(start) };
    }
    case 'pending': {
      const t = today_();
      return { ok: true, list: reservations_().filter(r => r.date >= t && pending_(r.statut) && mine(r))
        .sort((x, y) => (x.date + hh_(x.start)).localeCompare(y.date + hh_(y.start))).map(rowOut_) };
    }
    case 'blocked': return { ok: true, list: blockedPhones_().map(x => ({ tel: x.tel, raison: x.raison })) };
    case 'blockphone': {
      const ph = phone_(b.tel); if (ph.length < 9) return { ok: false, error: 'phone' };
      if (!blockedPhones_().some(x => x.tel === ph)) sh_('Bloques').appendRow([txt_(ph), String(b.raison || '').slice(0, 120), new Date()]);
      // les réservations jayin dyal had n-numéro katlghaw
      const t = today_(); let n = 0;
      reservations_().forEach(r => { if (phone_(r.tel) === ph && r.date >= t && !cancelled_(r.statut)) { sh_('Reservations').getRange(r.row, 10).setValue('annulé'); n++; } });
      return { ok: true, cancelled: n };
    }
    case 'unblockphone': {
      const ph = phone_(b.tel), rows = blockedPhones_().filter(x => x.tel === ph).map(x => x.row).sort((a, c) => c - a);
      rows.forEach(r => sh_('Bloques').deleteRow(r));
      return { ok: true, removed: rows.length };
    }
    case 'status': {
      const ok = ['en attente', 'confirmé', 'venu', 'absent', 'annulé'];
      if (ok.indexOf(b.statut) < 0) return { ok: false, error: 'statut' };
      const r = reservations_().find(x => x.id === String(b.id));
      if (!r || !mine(r)) return { ok: false, error: 'notfound' };
      sh_('Reservations').getRange(r.row, 10).setValue(b.statut);
      return { ok: true };
    }
    case 'price': {   // l-flous li khelless l-client b-sa7 (ila tbeddel)
      const r = reservations_().find(x => x.id === String(b.id));
      if (!r || !mine(r)) return { ok: false, error: 'notfound' };
      const prix = Math.round(Number(b.prix));
      if (!(prix >= 0 && prix <= 100000)) return { ok: false, error: 'prix' };
      sh_('Reservations').getRange(r.row, 7).setValue(prix);
      return { ok: true, prix: prix };
    }
    case 'add': {     // rendez-vous men l-admin (client f s-salon, telephone…)
      const barber = isB ? me.barber : String(b.barber || '').trim();
      const start = Number(b.start), dur = Math.round(Number(b.dur));
      const name = String(b.nom || '').trim().slice(0, 80) || 'Client';
      if (!isDate_(b.date) || !(start >= 0 && start < 24 * 60) || !(dur > 0 && dur <= 480) || !barber) return { ok: false, error: 'invalid' };
      if (!b.force && overlaps_(busyFor_(b.date), barber, start, dur)) return { ok: false, error: 'taken' };
      const statut = ['confirmé', 'venu'].indexOf(b.statut) >= 0 ? b.statut : 'confirmé', id = id_();
      sh_('Reservations').appendRow([txt_(b.date), txt_(hh_(start)), start, dur, barber, String(b.services || '').slice(0, 300),
        Math.max(0, Math.round(Number(b.prix) || 0)), name, txt_(String(b.tel || '').slice(0, 30)), statut, new Date(), id, 0, 'da']);
      return { ok: true, id: id };
    }
    case 'blocks': {
      const t = today_();
      return { ok: true, list: blocks_().filter(x => x.date >= t && (!isB || x.barber === me.barber || x.barber === '*')).sort((x, y) => (x.date + x.de).localeCompare(y.date + y.de))
        .map(x => ({ id: x.id || ('row' + x.row), date: x.date, de: x.de, a: x.a, coiffeur: x.barber === '*' ? 'tous' : x.barber, raison: x.raison })) };
    }
    case 'block': {
      if (!isDate_(b.date)) return { ok: false, error: 'date' };
      const de = hm_(b.de || ''), a = hm_(b.a || '');
      if ((de && !a) || (!de && a) || (de && a && toMin_(a) <= toMin_(de))) return { ok: false, error: 'time' };
      const id = id_();
      sh_('Blocages').appendRow([txt_(b.date), de ? txt_(de) : '', a ? txt_(a) : '', isB ? me.barber : String(b.coiffeur || 'tous'), String(b.raison || '').slice(0, 120), id, new Date()]);
      return { ok: true, id: id };
    }
    case 'unblock': {
      const x = blocks_().find(k => k.id === String(b.id) || ('row' + k.row) === String(b.id));
      if (!x || (isB && x.barber !== me.barber)) return { ok: false, error: 'notfound' };
      sh_('Blocages').deleteRow(x.row);
      return { ok: true };
    }
    case 'waitlist': {
      const t = today_();
      return { ok: true, list: rows_('Attente').map(w => ({ id: String(w.id), date: day_(w.date), nom: String(w.nom), tel: String(w.telephone).replace(/^'/, ''),
        services: String(w.services), barber: String(w.coiffeur), statut: String(w.statut || 'en attente'), row: w._row }))
        .filter(w => w.date >= t).sort((x, y) => x.date.localeCompare(y.date)) };
    }
    case 'waitdone': {
      const w = rows_('Attente').find(k => String(k.id) === String(b.id));
      if (!w) return { ok: false, error: 'notfound' };
      sh_('Attente').getRange(w._row, 6).setValue('contacté');
      return { ok: true };
    }
    case 'stats': {
      const from = isDate_(b.from) ? b.from : today_(), to = isDate_(b.to) ? b.to : today_();
      const every = reservations_().filter(mine);
      const all = every.filter(r => r.date >= from && r.date <= to);
      const live = all.filter(r => !cancelled_(r.statut));
      const done = live.filter(r => !absent_(r.statut) && !pending_(r.statut));
      const svc = {}, brb = {}, days = {}, team = {}, hours = {};
      done.forEach(r => {
        r.services.split(' + ').forEach(s => svc[s] = (svc[s] || 0) + 1);
        brb[r.barber] = (brb[r.barber] || 0) + 1;
        days[r.date] = (days[r.date] || 0) + r.prix;
        const h = Math.floor(r.start / 60); hours[h] = (hours[h] || 0) + 1;
      });
      live.forEach(r => {
        const k = team[r.barber] = team[r.barber] || { n: 0, venu: 0, ca: 0, encaisse: 0, absent: 0 };
        if (absent_(r.statut)) { k.absent++; return; }
        if (pending_(r.statut)) return;
        k.n++; k.ca += r.prix;
        if (String(r.statut).toLowerCase() === 'venu') { k.venu++; k.encaisse += r.prix; }
      });
      // clients jdad: awel merra jaw f had l-periode
      const first = {};
      every.filter(r => !cancelled_(r.statut) && !absent_(r.statut) && !pending_(r.statut)).forEach(r => { const p = phone_(r.tel); if (p && (!first[p] || r.date < first[p])) first[p] = r.date; });
      const phones = Object.keys(done.reduce((m, r) => (m[phone_(r.tel)] = 1, m), {}));
      // l-periode li 9bel (bach nqarno)
      let prev = null;
      if (isDate_(b.prevFrom) && isDate_(b.prevTo))
        prev = every.filter(r => r.date >= b.prevFrom && r.date <= b.prevTo && !cancelled_(r.statut) && !absent_(r.statut) && !pending_(r.statut)).reduce((a, r) => a + r.prix, 0);
      let shopCa = null;
      if (!isB) { try { shopCa = orders_().filter(o => o.statut === 'livrée' && o.date.slice(0, 10) >= from && o.date.slice(0, 10) <= to).reduce((a, o) => a + o.total, 0); } catch (e) {} }
      return { ok: true, stats: {
        total: all.length, confirmed: live.filter(r => !pending_(r.statut)).length, cancelled: all.length - live.length,
        absent: live.filter(r => absent_(r.statut)).length, pending: live.filter(r => pending_(r.statut)).length, revenue: done.reduce((a, r) => a + r.prix, 0),
        encaisse: done.filter(r => String(r.statut).toLowerCase() === 'venu').reduce((a, r) => a + r.prix, 0),
        clients: phones.length, newClients: phones.filter(p => first[p] >= from && first[p] <= to).length,
        services: svc, barbers: brb, days: days, team: team, hours: hours, prev: prev, shop: shopCa } };
    }
    case 'getnotif': { const n = notif_(); return { ok: true, phone: n.phone || '', hasKey: !!n.apikey, book: n.book, cancel: n.cancel, wait: n.wait }; }
    case 'savenotif': case 'testnotif': {
      const old = notif_();
      let ph = String(b.phone || '').replace(/\D/g, ''); if (ph.indexOf('0') === 0) ph = '212' + ph.slice(1);
      if (ph.length < 11 || ph.length > 15) return { ok: false, error: 'phone' };
      const key = String(b.apikey || '').trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || (ph === old.phone ? old.apikey : '');
      if (!key) return { ok: false, error: 'apikey' };
      const n = { phone: ph, apikey: key, book: b.book !== false, cancel: b.cancel !== false, wait: b.wait !== false };
      if (b.op === 'testnotif') {
        const r = sendWa_(n, '💈 *' + (config_().salon.nom || SALON) + '*\n\n✅ Test: les notifications WhatsApp khddamin! Ghadi twslek msg f kol réservation jdida w f kol annulation.');
        const okSend = r.code === 200 && !/error|invalid|not (yet )?activ|apikey/i.test(r.text);
        if (!okSend) return { ok: false, error: 'send', detail: r.text };
      }
      PropertiesService.getScriptProperties().setProperty('notif', JSON.stringify(n));
      return { ok: true, phone: ph, hasKey: true };
    }
    case 'getconfig': { const c = config_(); return { ok: true, v: 11, role: me.role, barber: me.barber, coiffeurs: safeTeam_(c.coiffeurs), galerie: isB ? [] : c.galerie, services: c.services, salon: c.salon }; }
    case 'savesalon': {
      const url = v => { v = String(v || '').trim().slice(0, 300); return /^https:\/\//.test(v) ? v : ''; };
      const ig = String(b.instagram || '').trim().replace(/^@/, '').slice(0, 300);
      const c = config_(), old = c.salon || {};
      const str = (v, n) => String(v || '').trim().slice(0, n);
      const hm = s => /^\d{2}:\d{2}$/.test(String(s || ''));
      let horaires = old.horaires || null;
      if (b.horaires && typeof b.horaires === 'object') {
        horaires = {};
        DAYKEYS.forEach(d => { const v = b.horaires[d]; horaires[d] = Array.isArray(v) && hm(v[0]) && hm(v[1]) && toMin_(v[1]) > toMin_(v[0]) ? [v[0], v[1]] : null; });
        if (!DAYKEYS.some(d => horaires[d])) return { ok: false, error: 'horaires' };
      }
      let wa = String(b.whatsapp || '').replace(/\D/g, ''); if (wa.indexOf('0') === 0) wa = '212' + wa.slice(1);
      const col = /^#[0-9a-fA-F]{6}$/.test(String(b.couleur || '')) ? b.couleur : (old.couleur || '');
      c.salon = {
        nom: str(b.nom, 40) || old.nom || SALON, adresse: str(b.adresse, 80) || old.adresse || '', ville: str(b.ville, 40) || old.ville || '',
        whatsapp: wa.length >= 11 ? wa.slice(0, 15) : (old.whatsapp || ''), tel: str(b.tel, 20) || old.tel || '',
        horaires: horaires, couleur: col,
        maps: url(b.maps), instagram: /^https:\/\//.test(ig) ? ig : ig.replace(/[^A-Za-z0-9._]/g, ''), facebook: url(b.facebook)
      };
      saveConfig_(c);
      return { ok: true, salon: c.salon };
    }
    case 'saveservices': {
      if (!Array.isArray(b.services)) return { ok: false, error: 'services' };
      const str = (v, n) => String(v || '').trim().slice(0, n);
      const lang = (o, n) => ({ fr: str(o && o.fr, n), da: str(o && o.da, n), ar: str(o && o.ar, n) });
      const list = b.services.slice(0, 30).map((s, i) => ({
        id: str(s.id, 40) || ('s' + Date.now() + i), prix: Math.max(0, Math.min(5000, Math.round(Number(s.prix) || 0))),
        duree: Math.max(5, Math.min(240, Math.round((Number(s.duree) || 30) / 5) * 5)), top: !!s.top, actif: s.actif !== false,
        photo: str(s.photo, 300), nom: lang(s.nom, 40), desc: lang(s.desc, 90)
      })).filter(s => s.nom.da || s.nom.fr || s.nom.ar);
      if (!list.length) return { ok: false, error: 'empty' };
      const c = config_(); c.services = list; saveConfig_(c);
      return { ok: true, services: list };
    }
    case 'saveteam': {
      if (!Array.isArray(b.coiffeurs)) return { ok: false, error: 'team' };
      const hm = s => /^\d{2}:\d{2}$/.test(String(s || ''));
      const oldPins = {}; config_().coiffeurs.forEach(x => { if (x.pin) oldPins[x.id] = String(x.pin); });
      const team = b.coiffeurs.slice(0, 20).map((x, i) => ({
        id: String(x.id || ('c' + Date.now() + i)).slice(0, 40), nom: String(x.nom || '').trim().slice(0, 40),
        pin: /^\d{4,8}$/.test(String(x.pin || '')) ? String(x.pin) : (x.clearPin ? '' : (oldPins[String(x.id)] || '')),
        actif: x.actif !== false, photo: String(x.photo || '').slice(0, 300),
        de: hm(x.de) ? x.de : DEFAULT_HOURS[0], a: hm(x.a) ? x.a : DEFAULT_HOURS[1],
        repos: (Array.isArray(x.repos) ? x.repos : []).filter(d => DAYKEYS.indexOf(d) >= 0)
      })).filter(x => x.nom);
      if (team.some(x => toMin_(x.a) <= toMin_(x.de))) return { ok: false, error: 'hours' };
      const names = team.map(x => x.nom.toLowerCase());
      if (new Set(names).size !== names.length) return { ok: false, error: 'dup' };
      const pins = team.map(x => x.pin).filter(Boolean);
      if (new Set(pins).size !== pins.length || pins.indexOf(String(ADMIN_PIN)) >= 0) return { ok: false, error: 'pindup' };
      const c = config_(), old = {};
      c.coiffeurs.forEach(x => old[x.id] = x.nom);
      // smiya tbeddlat → beddelha ta f les rendez-vous, blocages w liste d'attente
      const ren = {};
      team.forEach(x => { if (old[x.id] && old[x.id] !== x.nom) ren[old[x.id]] = x.nom; });
      let renamed = 0;
      if (Object.keys(ren).length) {
        ['Reservations', 'Blocages', 'Attente'].forEach(name => {
          const sh = sh_(name), col = SHEETS[name].indexOf('coiffeur') + 1, n = sh.getLastRow() - 1;
          if (n < 1) return;
          const rg = sh.getRange(2, col, n, 1), vals = rg.getValues();
          let ch = false;
          vals.forEach(v => { const k = String(v[0]).trim(); if (ren.hasOwnProperty(k)) { v[0] = ren[k]; ch = true; renamed++; } });
          if (ch) rg.setValues(vals);
        });
      }
      c.coiffeurs = team; saveConfig_(c);
      return { ok: true, coiffeurs: safeTeam_(team), renamed: renamed };
    }
    case 'upload': {
      const r = upload_(b);
      return r ? { ok: true, id: r.id, url: r.url } : { ok: false, error: 'image' };
    }
    case 'addphoto': {
      const r = upload_(b); if (!r) return { ok: false, error: 'image' };
      const c = config_(); c.galerie.unshift({ id: r.id, url: r.url }); c.galerie = c.galerie.slice(0, 60); saveConfig_(c);
      return { ok: true, galerie: c.galerie };
    }
    case 'delphoto': {
      const c = config_(), g = c.galerie.find(x => x.id === String(b.id));
      if (!g) return { ok: false, error: 'notfound' };
      c.galerie = c.galerie.filter(x => x.id !== g.id); saveConfig_(c);
      try { DriveApp.getFileById(g.id).setTrashed(true); } catch (e) {}
      return { ok: true, galerie: c.galerie };
    }
    case 'movephoto': {
      const c = config_(), i = c.galerie.findIndex(x => x.id === String(b.id)), j = i + (b.dir === 'up' ? -1 : 1);
      if (i < 0 || j < 0 || j >= c.galerie.length) return { ok: true, galerie: c.galerie };
      const t = c.galerie[i]; c.galerie[i] = c.galerie[j]; c.galerie[j] = t; saveConfig_(c);
      return { ok: true, galerie: c.galerie };
    }
    case 'getshop': return { ok: true, shop: shop_(), produits: products_() };
    case 'saveproducts': {
      if (!Array.isArray(b.produits)) return { ok: false, error: 'produits' };
      const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
      const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
      const list = b.produits.slice(0, 200).map((x, i) => ({
        id: str(x.id, 40) || ('p' + Date.now().toString(36) + i), nom: str(x.nom, 70), cat: str(x.cat, 30), prix: num(x.prix, 100000), ancien: num(x.ancien, 100000),
        desc: str(x.desc, 400), photo: str(x.photo, 300), stock: x.stock === '' || x.stock === null || x.stock === undefined ? null : num(x.stock, 99999), actif: x.actif !== false
      })).filter(x => x.nom);
      saveProducts_(list);
      return { ok: true, produits: products_() };
    }
    case 'saveshop': {
      const o = b.shop || {}, num = (v, d) => { const n = Math.round(Number(v)); return isFinite(n) && n >= 0 ? Math.min(n, 100000) : d; };
      const s = { actif: o.actif !== false, whatsapp: o.whatsapp !== false, salon: o.salon !== false, livraison: o.livraison !== false,
        frais: num(o.frais, SHOP_DEFAULT.frais), gratuitDes: num(o.gratuitDes, 0), delai: String(o.delai || '').slice(0, 30), villes: String(o.villes || '').slice(0, 300) };
      if (!s.whatsapp && !s.salon && !s.livraison) return { ok: false, error: 'modes' };
      PropertiesService.getScriptProperties().setProperty('shop', JSON.stringify(s));
      return { ok: true, shop: s };
    }
    case 'orders': {
      const list = orders_().reverse().slice(0, 300).map(o => { const x = Object.assign({}, o); delete x.row; return x; });
      return { ok: true, list: list };
    }
    case 'orderstatus': {
      const ok = ['nouvelle', 'confirmée', 'prête', 'livrée', 'annulée'];
      if (ok.indexOf(String(b.statut)) < 0) return { ok: false, error: 'statut' };
      const o = orders_().find(x => x.id === String(b.id)); if (!o) return { ok: false, error: 'notfound' };
      const was = o.statut === 'annulée', now = b.statut === 'annulée';
      sh_('Commandes').getRange(o.row, SHEETS.Commandes.indexOf('statut') + 1).setValue(b.statut);
      if (was !== now && o.items.length) restock_(o.items, now ? 1 : -1);
      return { ok: true };
    }
    default: return { ok: false, error: 'op' };
  }
}

/* Mra wa7da men l-éditeur: Exécuter "setup" bach ytwjdo les feuilles w t3ti l-autorisations (email). */
function setup() {
  Object.keys(SHEETS).forEach(sh_);
  MailApp.getRemainingDailyQuota();
  photosFolder_();
  if (!PropertiesService.getScriptProperties().getProperty('config')) saveConfig_(config_());
}
