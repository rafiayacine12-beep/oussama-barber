/**
 * BACKEND — Oussama Barber (Google Apps Script) · v2
 * ---------------------------------------------------
 * Feuilles (kaytwjdo b wa7dhom):
 *   Reservations · Blocages · Attente
 *
 * Statut d'une réservation (colonne "statut"): confirmé · venu · absent · annulé
 *   - "annulé" => l-crénau kayrje3 khawi.
 *
 * Blocages (pause, congé, 3id…): date | de | a | coiffeur | raison
 *   - coiffeur khawi wla "tous" => l-salon kamel msdod f dak l-wa9t.
 *   - de/a khawyin => nhar kamel.
 *
 * ⚙️ RÉGLAGES — beddel hna
 */
const ADMIN_PIN = '2468';                 // code dyal page admin (beddlo!)
const NOTIFY_EMAIL = '';                  // khawi = email dyal compte Google li dar déploiement
const TELEGRAM_TOKEN = '';                // optionnel: token dyal bot Telegram (@BotFather)
const TELEGRAM_CHAT_ID = '';              // optionnel: chat id dyal Oussama
const SALON = 'Oussama Barber';
const SITE_URL = 'https://oussama-barber.vercel.app';

const SHEETS = {
  Reservations: ['date','heure','debut_min','duree_min','coiffeur','services','prix_dh','nom','telephone','statut','cree_le','id','remise_dh','langue'],
  Blocages:     ['date','de','a','coiffeur','raison','id','cree_le'],
  Attente:      ['date','nom','telephone','services','coiffeur','statut','cree_le','id']
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
    tel: String(r.telephone).replace(/^'/, ''), statut: String(r.statut || 'confirmé'), id: String(r.id), remise: Number(r.remise_dh) || 0
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

/* ---------------- notifications ---------------- */
function notify_(subject, lines) {
  const body = lines.join('\n');
  try {
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: '💈 ' + subject + '\n\n' + body })
      });
    }
  } catch (e) { console.error(e); }
  try {
    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, '💈 ' + subject + ' — ' + SALON, body + '\n\n' + SITE_URL + '/admin.html');
  } catch (e) { console.error(e); }
}

/* ---------------- GET ---------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'loyalty') return json_(loyalty_(p.phone));
  if (!isDate_(p.date)) return json_({ ok: false, error: 'date' });
  return json_({ ok: true, bookings: busyFor_(p.date) });
}

function loyalty_(phone) {
  const ph = phone_(phone);
  if (ph.length < 9) return { ok: false, error: 'phone' };
  const t = today_();
  const visits = reservations_().filter(r => phone_(r.tel) === ph && r.date <= t && !cancelled_(r.statut) && r.statut.toLowerCase().indexOf('absent') !== 0).length;
  return { ok: true, visits: visits };
}

/* ---------------- POST ---------------- */
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (b.action || 'book') {
      case 'book':     return json_(book_(b));
      case 'cancel':   return json_(cancel_(b));
      case 'waitlist': return json_(waitlist_(b));
      case 'admin':    return json_(admin_(b));
      default:         return json_({ ok: false, error: 'action' });
    }
  } finally { lock.releaseLock(); }
}

function book_(b) {
  const valid = isDate_(b.date) && b.start >= 0 && b.dur > 0 && b.dur <= 480 &&
    String(b.name || '').trim() && phone_(b.phone).length >= 9 && Array.isArray(b.candidates) && b.candidates.length;
  if (!valid) return { ok: false, error: 'invalid' };
  const busy = busyFor_(b.date);
  const barber = b.candidates.find(c => !overlaps_(busy, String(c), b.start, b.dur));
  if (!barber) return { ok: false, error: 'taken' };
  const id = id_(), hh = hh_(b.start);
  sh_('Reservations').appendRow([txt_(b.date), txt_(hh), b.start, b.dur, String(barber), String(b.services || '').slice(0, 300),
    Number(b.price) || 0, String(b.name).slice(0, 80), txt_(String(b.phone).slice(0, 30)), 'confirmé', new Date(), id,
    Number(b.discount) || 0, String(b.lang || '').slice(0, 4)]);
  notify_('Réservation jdida', ['📅 ' + b.date + ' · ' + hh, '💈 ' + barber, '✂️ ' + b.services + ' (' + (Number(b.price) || 0) + ' DH)',
    '🙍 ' + b.name + ' · ' + b.phone, '🔖 #' + id]);
  return { ok: true, barber: String(barber), id: id };
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
  const lines = ['📅 ' + r.date + ' · ' + r.heure, '💈 ' + r.barber, '🙍 ' + r.nom + ' · ' + r.tel, '🔖 #' + r.id];
  if (waiting.length) lines.push('', '⏳ Kaynin ' + waiting.length + ' f liste d\'attente had nhar:', ...waiting.map(w => '• ' + w.nom + ' · ' + String(w.telephone).replace(/^'/, '')));
  notify_('Réservation tlghat', lines);
  return { ok: true, date: r.date, heure: r.heure };
}

function waitlist_(b) {
  if (!isDate_(b.date) || !String(b.name || '').trim() || phone_(b.phone).length < 9) return { ok: false, error: 'invalid' };
  const id = id_();
  sh_('Attente').appendRow([txt_(b.date), String(b.name).slice(0, 80), txt_(String(b.phone).slice(0, 30)), String(b.services || '').slice(0, 300),
    String(b.barber || 'Ay wa7ed'), 'en attente', new Date(), id]);
  notify_('Liste d\'attente', ['📅 ' + b.date, '🙍 ' + b.name + ' · ' + b.phone, '✂️ ' + (b.services || ''), '💈 ' + (b.barber || 'Ay wa7ed')]);
  return { ok: true, id: id };
}

/* ---------------- ADMIN ---------------- */
function admin_(b) {
  const cache = CacheService.getScriptCache(), fails = Number(cache.get('pinfails') || 0);
  if (fails >= 8) return { ok: false, error: 'locked' };
  if (String(b.pin || '') !== ADMIN_PIN) { cache.put('pinfails', String(fails + 1), 900); return { ok: false, error: 'pin' }; }
  cache.remove('pinfails');

  switch (b.op) {
    case 'login': return { ok: true, salon: SALON };
    case 'list': {
      const from = isDate_(b.from) ? b.from : today_(), to = isDate_(b.to) ? b.to : from;
      const list = reservations_().filter(r => r.date >= from && r.date <= to)
        .sort((x, y) => (x.date + hh_(x.start)).localeCompare(y.date + hh_(y.start)))
        .map(r => ({ id: r.id, date: r.date, heure: hh_(r.start), dur: r.dur, barber: r.barber, services: r.services, prix: r.prix, nom: r.nom, tel: r.tel, statut: r.statut }));
      return { ok: true, list: list };
    }
    case 'status': {
      const ok = ['confirmé', 'venu', 'absent', 'annulé'];
      if (ok.indexOf(b.statut) < 0) return { ok: false, error: 'statut' };
      const r = reservations_().find(x => x.id === String(b.id));
      if (!r) return { ok: false, error: 'notfound' };
      sh_('Reservations').getRange(r.row, 10).setValue(b.statut);
      return { ok: true };
    }
    case 'blocks': {
      const t = today_();
      return { ok: true, list: blocks_().filter(x => x.date >= t).sort((x, y) => (x.date + x.de).localeCompare(y.date + y.de))
        .map(x => ({ id: x.id || ('row' + x.row), date: x.date, de: x.de, a: x.a, coiffeur: x.barber === '*' ? 'tous' : x.barber, raison: x.raison })) };
    }
    case 'block': {
      if (!isDate_(b.date)) return { ok: false, error: 'date' };
      const de = hm_(b.de || ''), a = hm_(b.a || '');
      if ((de && !a) || (!de && a) || (de && a && toMin_(a) <= toMin_(de))) return { ok: false, error: 'time' };
      const id = id_();
      sh_('Blocages').appendRow([txt_(b.date), de ? txt_(de) : '', a ? txt_(a) : '', String(b.coiffeur || 'tous'), String(b.raison || '').slice(0, 120), id, new Date()]);
      return { ok: true, id: id };
    }
    case 'unblock': {
      const x = blocks_().find(k => k.id === String(b.id) || ('row' + k.row) === String(b.id));
      if (!x) return { ok: false, error: 'notfound' };
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
      const all = reservations_().filter(r => r.date >= from && r.date <= to);
      const live = all.filter(r => !cancelled_(r.statut));
      const done = live.filter(r => r.statut.toLowerCase().indexOf('absent') !== 0);
      const svc = {}, brb = {}, days = {};
      done.forEach(r => {
        r.services.split(' + ').forEach(s => svc[s] = (svc[s] || 0) + 1);
        brb[r.barber] = (brb[r.barber] || 0) + 1;
        days[r.date] = (days[r.date] || 0) + r.prix;
      });
      return { ok: true, stats: {
        total: all.length, confirmed: live.length, cancelled: all.length - live.length,
        absent: live.length - done.length, revenue: done.reduce((a, r) => a + r.prix, 0),
        clients: Object.keys(done.reduce((m, r) => (m[phone_(r.tel)] = 1, m), {})).length,
        services: svc, barbers: brb, days: days } };
    }
    default: return { ok: false, error: 'op' };
  }
}

/* Mra wa7da men l-éditeur: Exécuter "setup" bach ytwjdo les feuilles w t3ti l-autorisations (email). */
function setup() {
  Object.keys(SHEETS).forEach(sh_);
  MailApp.getRemainingDailyQuota();
}
