/**
 * BACKEND DYAL RÉSERVATIONS — Google Apps Script
 * --------------------------------------------------
 * 1. Dir Google Sheet jdida (sheets.new), smmiha "Réservations".
 * 2. Extensions > Apps Script. Ms7 kolchi w lsse9 had l-code.
 * 3. Déployer > Nouveau déploiement > Type: Application Web
 *      - Exécuter en tant que : Moi
 *      - Qui a accès : Tout le monde
 * 4. Copier l-URL (kat-sali b /exec) w 7ottha f CONFIG.apiUrl f index.html.
 *
 * Les réservations kayban f l-feuille "Reservations".
 * Bach tlghi réservation : bddel l-colonne "statut" l "annulé" (l-crénau kaywelli khawi).
 */

const SHEET_NAME = 'Reservations';
const HEADERS = ['date', 'heure', 'debut_min', 'duree_min', 'coiffeur', 'services', 'prix_dh', 'nom', 'telephone', 'statut', 'cree_le', 'id'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@'); // date b7al text
    sh.getRange('B:B').setNumberFormat('@');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function day_(v) {
  return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v).trim();
}

function bookingsFor_(date) {
  const rows = sheet_().getDataRange().getValues().slice(1);
  return rows
    .filter(r => day_(r[0]) === date && String(r[9]).toLowerCase().indexOf('annul') !== 0)
    .map(r => ({ start: Number(r[2]), dur: Number(r[3]), barber: String(r[4]) }));
}

function overlaps_(list, barber, start, dur) {
  return list.some(b => b.barber === barber && start < b.start + b.dur && b.start < start + dur);
}

// GET ?date=YYYY-MM-DD  -> crénaux li m7jouzin f dak nhar
function doGet(e) {
  const date = (e && e.parameter && e.parameter.date) || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json_({ ok: false, error: 'date' });
  return json_({ ok: true, bookings: bookingsFor_(date) });
}

// POST (text/plain JSON) -> tsjil réservation
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'json' }); }

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.start >= 0 && b.dur > 0 && b.dur <= 480 &&
    String(b.name || '').trim() && String(b.phone || '').replace(/\D/g, '').length >= 9 &&
    Array.isArray(b.candidates) && b.candidates.length;
  if (!valid) return json_({ ok: false, error: 'invalid' });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const list = bookingsFor_(b.date);
    const barber = b.candidates.find(c => !overlaps_(list, String(c), b.start, b.dur));
    if (!barber) return json_({ ok: false, error: 'taken' });

    const id = Utilities.getUuid().slice(0, 8).toUpperCase();
    const hh = ('0' + Math.floor(b.start / 60)).slice(-2) + ':' + ('0' + (b.start % 60)).slice(-2);
    sheet_().appendRow([
      "'" + b.date, "'" + hh, b.start, b.dur, String(barber),
      String(b.services || '').slice(0, 300), Number(b.price) || 0,
      String(b.name).slice(0, 80), "'" + String(b.phone).slice(0, 30),
      'confirmé', new Date(), id
    ]);
    return json_({ ok: true, barber: String(barber), id: id });
  } finally {
    lock.releaseLock();
  }
}
