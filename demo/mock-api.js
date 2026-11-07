/* =====================================================================
   DEMO BACKEND — kaykhddem f l-navigateur (localStorage), bla Google Sheet.
   Nefs l-API dyal backend/Code.gs. L-site w l-admin dyal /demo kaychoufo
   nefs l-data, donc l-client y9der yreservi f s-site w ychoufha f l-admin.
   ===================================================================== */
(function(){
  const API = "https://demo.api/exec";
  const KEY = "dm_db";
  const PIN = "1234";
  const SALON = "Votre Salon";
  const DAYKEYS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const HOURS = ['10:00', '21:00'];
  const TEAM = ['Karim', 'Anas', 'Hamza'];
  const SERVICES = [
    { id: 's1', prix: 40, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Coupe', da: 'Coupe', ar: 'حلاقة الشعر' }, desc: { fr: 'Coupe + shampoing', da: 'Coupe + lavage', ar: 'قص وغسل' } },
    { id: 's2', prix: 50, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Dégradé', da: 'Dégradé', ar: 'ديغرادي' }, desc: { fr: 'Fade bas, mid ou high', da: 'Fade bas, mid wla high', ar: 'منخفض، متوسط أو عالي' } },
    { id: 's3', prix: 25, duree: 20, top: false, actif: true, photo: '', nom: { fr: 'Barbe', da: 'Barbe', ar: 'اللحية' }, desc: { fr: 'Taille, contours et serviette chaude', da: 'Taille, contours w serviette skhouna', ar: 'تشذيب وتحديد ومنشفة ساخنة' } },
    { id: 's4', prix: 60, duree: 45, top: true,  actif: true, photo: '', nom: { fr: 'Coupe + Barbe', da: 'Coupe + Barbe', ar: 'شعر + لحية' }, desc: { fr: 'La formule complète', da: 'L-pack kamel', ar: 'الباقة الكاملة' } },
    { id: 's5', prix: 60, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Soin visage', da: 'Soin visage', ar: 'عناية بالوجه' }, desc: { fr: 'Masque et nettoyage', da: 'Masque w nettoyage', ar: 'قناع وتنظيف' } },
    { id: 's6', prix: 30, duree: 30, top: false, actif: true, photo: '', nom: { fr: 'Coupe enfant', da: 'Coupe enfant', ar: 'حلاقة الأطفال' }, desc: { fr: 'Moins de 12 ans', da: '9el mn 12 3am', ar: 'أقل من 12 سنة' } }
  ];
  const REQUIRE_VALIDATION = true, MAX_ACTIVE_PER_PHONE = 1, ABSENT_LIMIT = 2;

  /* ---------- helpers ---------- */
  const pad = n => ('0' + n).slice(-2);
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today_ = () => iso(new Date());
  const toMin_ = s => { const p = String(s).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  const hh_ = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const hm_ = v => { const s = String(v || '').trim(); return /^\d{1,2}:\d{2}$/.test(s) ? ('0' + s).slice(-5) : ''; };
  const phone_ = p => { let d = String(p || '').replace(/\D/g, ''); if (d.indexOf('212') === 0) d = '0' + d.slice(3); return d; };
  const id_ = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const isDate_ = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
  const cancelled_ = st => String(st).toLowerCase().indexOf('annul') === 0;
  const pending_ = st => String(st).toLowerCase().indexOf('attente') >= 0;
  const absent_ = st => String(st).toLowerCase().indexOf('absent') === 0;
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- data ---------- */
  function seed(){
    const names = ['Youssef', 'Mehdi', 'Amine', 'Ayoub', 'Hamza B.', 'Omar', 'Zakaria', 'Ilyas', 'Reda', 'Soufiane', 'Adam', 'Bilal', 'Hicham', 'Walid', 'Nabil', 'Saad', 'Ismail', 'Othmane', 'Taha', 'Badr'];
    const phones = names.map((_, i) => '06' + String(11223300 + i * 7919).slice(0, 8));
    const svc = [[0], [1], [1], [3], [3], [2], [0, 2], [1, 2], [5], [4]];
    const res = [];
    let k = 0;
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    for (let off = -30; off <= 6; off++){
      const d = new Date(); d.setDate(d.getDate() + off);
      const date = iso(d), n = off < 0 ? 5 + ((off * 7 + 30) % 5) : off === 0 ? 6 : off <= 2 ? 4 : 2;
      const used = {};
      for (let i = 0; i < n; i++){
        const barber = TEAM[(k + i) % TEAM.length];
        let start = toMin_(HOURS[0]) + 30 * ((k * 5 + i * 3) % 20);
        while (used[barber + start]) start += 30;
        if (start + 45 > toMin_(HOURS[1])) continue;
        used[barber + start] = used[barber + (start + 30)] = 1;
        const ss = svc[(k + i * 2) % svc.length].map(j => SERVICES[j]);
        const dur = ss.reduce((a, s) => a + s.duree, 0), prix = ss.reduce((a, s) => a + s.prix, 0);
        const who = (k * 3 + i) % names.length;
        let statut = 'confirmé';
        const past = off < 0 || (off === 0 && start + dur < nowMin);
        if (past) statut = (k + i) % 13 === 0 ? 'absent' : (k + i) % 11 === 0 ? 'annulé' : 'venu';
        else if (off <= 2 && i === n - 1) statut = 'en attente';
        res.push({ date, start, dur, barber, services: ss.map(s => s.nom.fr).join(' + '), prix, nom: names[who], tel: phones[who], statut, id: id_(), remise: 0, langue: ['da', 'fr', 'ar'][who % 3] });
      }
      k++;
    }
    const d1 = new Date(); d1.setDate(d1.getDate() + 1);
    const d3 = new Date(); d3.setDate(d3.getDate() + 3);
    return {
      v: 1,
      res,
      blocks: [{ date: iso(d3), de: '13:00', a: '14:30', coiffeur: 'tous', raison: 'Pause déjeuner', id: id_() }],
      wait: [{ date: iso(d1), nom: 'Anouar', tel: '0677889900', services: 'Dégradé', barber: 'Ay wa7ed', statut: 'en attente', id: id_() }],
      blocked: [],
      notif: {},
      config: {
        coiffeurs: TEAM.map((n, i) => ({ id: 'c' + (i + 1), nom: n, actif: true, photo: '', de: HOURS[0], a: HOURS[1], repos: i === 2 ? ['lundi'] : [] })),
        galerie: [],
        services: clone(SERVICES),
        salon: { nom: SALON, adresse: 'Votre adresse', ville: 'Votre ville', whatsapp: '', tel: '', horaires: null, couleur: '', maps: '', instagram: '', facebook: '' }
      }
    };
  }
  let DB;
  function load(){ try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ DB = null; } if (!DB || DB.v !== 1) { DB = seed(); save(); } }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch(e){ /* quota: photos kbar */ } }
  load();

  window.DEMO_RESET = function(){
    try {
      Object.keys(localStorage).filter(k => k.indexOf('dm_') === 0).forEach(k => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k => k.indexOf('dm_') === 0).forEach(k => sessionStorage.removeItem(k));
    } catch(e){}
    location.reload();
  };

  const config_ = () => DB.config;
  const busyFor_ = date => DB.res.filter(r => r.date === date && !cancelled_(r.statut)).map(r => ({ start: r.start, dur: r.dur, barber: r.barber }))
    .concat(blocks_().filter(b => b.date === date).map(b => ({ start: b.start, dur: b.end - b.start, barber: b.barber })));
  function blocks_(){
    return DB.blocks.map(b => {
      const c = String(b.coiffeur || '').trim();
      return { date: b.date, start: b.de ? toMin_(b.de) : 0, end: b.a ? toMin_(b.a) : 1440, barber: (!c || c.toLowerCase() === 'tous') ? '*' : c, raison: b.raison, id: b.id, de: b.de, a: b.a };
    });
  }
  const overlaps_ = (l, b, s, d) => l.some(x => (x.barber === '*' || x.barber === b) && s < x.start + x.dur && x.start < s + d);
  function publicConfig_(){
    const c = config_();
    return { ok: true, coiffeurs: c.coiffeurs.filter(x => x.actif).map(x => ({ id: x.id, nom: x.nom, photo: x.photo || '', de: x.de, a: x.a, repos: x.repos || [] })),
      galerie: c.galerie.map(g => g.url), salon: c.salon,
      services: c.services.filter(s => s.actif).map(s => ({ id: s.id, nom: s.nom, desc: s.desc, prix: s.prix, duree: s.duree, top: !!s.top, photo: s.photo || '' })) };
  }
  function worksAt_(name, date, start, dur){
    const c = config_().coiffeurs.find(x => x.nom === name);
    if (!c) return true;
    if (!c.actif) return false;
    const p = date.split('-').map(Number), day = DAYKEYS[new Date(p[0], p[1] - 1, p[2]).getDay()];
    if ((c.repos || []).indexOf(day) >= 0) return false;
    return start >= toMin_(c.de || HOURS[0]) && start + dur <= toMin_(c.a || HOURS[1]);
  }
  function upload_(b){
    const data = String(b.data || ''), mime = String(b.mime || 'image/jpeg');
    if (!/^image\/(jpeg|png|webp)$/.test(mime) || !data) return null;
    const id = id_();
    return { id, url: 'data:' + mime + ';base64,' + data };
  }
  const row = r => ({ id: r.id, date: r.date, heure: hh_(r.start), dur: r.dur, barber: r.barber, services: r.services, prix: r.prix, nom: r.nom, tel: r.tel, statut: r.statut, langue: r.langue });
  const byTime = (x, y) => (x.date + hh_(x.start)).localeCompare(y.date + hh_(y.start));

  /* ---------- GET ---------- */
  function doGet(p){
    if (p.action === 'loyalty'){
      const ph = phone_(p.phone); if (ph.length < 9) return { ok: false, error: 'phone' };
      const t = today_();
      return { ok: true, visits: DB.res.filter(r => phone_(r.tel) === ph && r.date <= t && !cancelled_(r.statut) && !absent_(r.statut) && !pending_(r.statut)).length };
    }
    if (p.action === 'config') return publicConfig_();
    if (p.action === 'status'){
      const id = String(p.id || '').toUpperCase(), ph = phone_(p.phone);
      const r = DB.res.find(x => x.id.toUpperCase() === id && phone_(x.tel) === ph);
      return r ? { ok: true, statut: r.statut, date: r.date, heure: hh_(r.start), barber: r.barber } : { ok: false, error: 'notfound' };
    }
    if (!isDate_(p.date)) return { ok: false, error: 'date' };
    return { ok: true, bookings: busyFor_(p.date) };
  }

  /* ---------- POST ---------- */
  const isBlocked_ = ph => DB.blocked.some(x => x.tel === ph) || (ABSENT_LIMIT > 0 && DB.res.filter(r => phone_(r.tel) === ph && absent_(r.statut)).length >= ABSENT_LIMIT);
  function book_(b){
    const valid = isDate_(b.date) && b.start >= 0 && b.dur > 0 && b.dur <= 480 && String(b.name || '').trim() && phone_(b.phone).length >= 9 && Array.isArray(b.candidates) && b.candidates.length;
    if (!valid || b.hp) return { ok: false, error: 'invalid' };
    const ph = phone_(b.phone);
    if (isBlocked_(ph)) return { ok: false, error: 'blocked' };
    if (MAX_ACTIVE_PER_PHONE > 0){
      const t = today_();
      if (DB.res.filter(r => phone_(r.tel) === ph && r.date >= t && !cancelled_(r.statut) && !absent_(r.statut)).length >= MAX_ACTIVE_PER_PHONE) return { ok: false, error: 'limit' };
    }
    const busy = busyFor_(b.date);
    const barber = b.candidates.find(c => worksAt_(String(c), b.date, b.start, b.dur) && !overlaps_(busy, String(c), b.start, b.dur));
    if (!barber) return { ok: false, error: 'taken' };
    const id = id_(), statut = REQUIRE_VALIDATION ? 'en attente' : 'confirmé';
    DB.res.push({ date: b.date, start: b.start, dur: b.dur, barber: String(barber), services: String(b.services || '').slice(0, 300), prix: Number(b.price) || 0,
      nom: String(b.name).slice(0, 80), tel: String(b.phone).slice(0, 30), statut, id, remise: Number(b.discount) || 0, langue: String(b.lang || '').slice(0, 4) });
    save();
    return { ok: true, barber: String(barber), id, statut };
  }
  function cancel_(b){
    const id = String(b.id || '').replace('#', '').trim().toUpperCase(), ph = phone_(b.phone);
    if (!id || ph.length < 9) return { ok: false, error: 'invalid' };
    const r = DB.res.find(x => x.id.toUpperCase() === id && phone_(x.tel) === ph);
    if (!r) return { ok: false, error: 'notfound' };
    if (cancelled_(r.statut)) return { ok: true, already: true };
    if (r.date < today_()) return { ok: false, error: 'past' };
    r.statut = 'annulé'; save();
    return { ok: true, date: r.date, heure: hh_(r.start) };
  }
  function waitlist_(b){
    if (!isDate_(b.date) || !String(b.name || '').trim() || phone_(b.phone).length < 9) return { ok: false, error: 'invalid' };
    const id = id_();
    DB.wait.push({ date: b.date, nom: String(b.name).slice(0, 80), tel: String(b.phone).slice(0, 30), services: String(b.services || ''), barber: String(b.barber || 'Ay wa7ed'), statut: 'en attente', id });
    save();
    return { ok: true, id };
  }

  function admin_(b){
    if (String(b.pin || '') !== PIN) return { ok: false, error: 'pin' };
    const t = today_();
    switch (b.op){
      case 'login': return { ok: true, salon: config_().salon.nom || SALON };
      case 'list': {
        const from = isDate_(b.from) ? b.from : t, to = isDate_(b.to) ? b.to : from;
        return { ok: true, list: DB.res.filter(r => r.date >= from && r.date <= to).sort(byTime).map(row) };
      }
      case 'reschedule': {
        const r = DB.res.find(x => x.id === String(b.id));
        if (!r) return { ok: false, error: 'notfound' };
        if (cancelled_(r.statut)) return { ok: false, error: 'cancelled' };
        const start = Number(b.start);
        if (!isDate_(b.date) || !(start >= 0) || b.date < t) return { ok: false, error: 'invalid' };
        if (!worksAt_(r.barber, b.date, start, r.dur)) return { ok: false, error: 'hours' };
        const busy = DB.res.filter(x => x !== r && x.date === b.date && !cancelled_(x.statut)).map(x => ({ start: x.start, dur: x.dur, barber: x.barber }))
          .concat(blocks_().filter(k => k.date === b.date).map(k => ({ start: k.start, dur: k.end - k.start, barber: k.barber })));
        if (overlaps_(busy, r.barber, start, r.dur)) return { ok: false, error: 'taken' };
        r.date = b.date; r.start = start; if (pending_(r.statut)) r.statut = 'confirmé'; save();
        return { ok: true, date: b.date, heure: hh_(start) };
      }
      case 'pending': return { ok: true, list: DB.res.filter(r => r.date >= t && pending_(r.statut)).sort(byTime).map(row) };
      case 'blocked': return { ok: true, list: DB.blocked.map(x => ({ tel: x.tel, raison: x.raison })) };
      case 'blockphone': {
        const ph = phone_(b.tel); if (ph.length < 9) return { ok: false, error: 'phone' };
        if (!DB.blocked.some(x => x.tel === ph)) DB.blocked.push({ tel: ph, raison: String(b.raison || '').slice(0, 120) });
        let n = 0; DB.res.forEach(r => { if (phone_(r.tel) === ph && r.date >= t && !cancelled_(r.statut)) { r.statut = 'annulé'; n++; } });
        save(); return { ok: true, cancelled: n };
      }
      case 'unblockphone': {
        const ph = phone_(b.tel), before = DB.blocked.length;
        DB.blocked = DB.blocked.filter(x => x.tel !== ph); save();
        return { ok: true, removed: before - DB.blocked.length };
      }
      case 'status': {
        if (['en attente', 'confirmé', 'venu', 'absent', 'annulé'].indexOf(b.statut) < 0) return { ok: false, error: 'statut' };
        const r = DB.res.find(x => x.id === String(b.id)); if (!r) return { ok: false, error: 'notfound' };
        r.statut = b.statut; save(); return { ok: true };
      }
      case 'blocks': return { ok: true, list: blocks_().filter(x => x.date >= t).sort((x, y) => (x.date + (x.de || '')).localeCompare(y.date + (y.de || '')))
        .map(x => ({ id: x.id, date: x.date, de: x.de || '', a: x.a || '', coiffeur: x.barber === '*' ? 'tous' : x.barber, raison: x.raison })) };
      case 'block': {
        if (!isDate_(b.date)) return { ok: false, error: 'date' };
        const de = hm_(b.de), a = hm_(b.a);
        if ((de && !a) || (!de && a) || (de && a && toMin_(a) <= toMin_(de))) return { ok: false, error: 'time' };
        const id = id_(); DB.blocks.push({ date: b.date, de, a, coiffeur: String(b.coiffeur || 'tous'), raison: String(b.raison || '').slice(0, 120), id }); save();
        return { ok: true, id };
      }
      case 'unblock': {
        const i = DB.blocks.findIndex(k => k.id === String(b.id)); if (i < 0) return { ok: false, error: 'notfound' };
        DB.blocks.splice(i, 1); save(); return { ok: true };
      }
      case 'waitlist': return { ok: true, list: DB.wait.filter(w => w.date >= t).sort((x, y) => x.date.localeCompare(y.date)).map(w => clone(w)) };
      case 'waitdone': {
        const w = DB.wait.find(k => k.id === String(b.id)); if (!w) return { ok: false, error: 'notfound' };
        w.statut = 'contacté'; save(); return { ok: true };
      }
      case 'stats': {
        const from = isDate_(b.from) ? b.from : t, to = isDate_(b.to) ? b.to : t;
        const all = DB.res.filter(r => r.date >= from && r.date <= to), live = all.filter(r => !cancelled_(r.statut));
        const done = live.filter(r => !absent_(r.statut) && !pending_(r.statut)), svc = {}, brb = {}, days = {};
        done.forEach(r => { r.services.split(' + ').forEach(s => svc[s] = (svc[s] || 0) + 1); brb[r.barber] = (brb[r.barber] || 0) + 1; days[r.date] = (days[r.date] || 0) + r.prix; });
        return { ok: true, stats: { total: all.length, confirmed: live.filter(r => !pending_(r.statut)).length, cancelled: all.length - live.length,
          absent: live.filter(r => absent_(r.statut)).length, pending: live.filter(r => pending_(r.statut)).length, revenue: done.reduce((a, r) => a + r.prix, 0),
          clients: Object.keys(done.reduce((m, r) => (m[phone_(r.tel)] = 1, m), {})).length, services: svc, barbers: brb, days } };
      }
      case 'getnotif': { const n = DB.notif || {}; return { ok: true, phone: n.phone || '', hasKey: !!n.apikey, book: n.book !== false, cancel: n.cancel !== false, wait: n.wait !== false }; }
      case 'savenotif': case 'testnotif': {
        let ph = String(b.phone || '').replace(/\D/g, ''); if (ph.indexOf('0') === 0) ph = '212' + ph.slice(1);
        if (ph.length < 11 || ph.length > 15) return { ok: false, error: 'phone' };
        const key = String(b.apikey || '').replace(/[^A-Za-z0-9]/g, '') || (DB.notif || {}).apikey || '';
        if (!key) return { ok: false, error: 'apikey' };
        DB.notif = { phone: ph, apikey: key, book: b.book !== false, cancel: b.cancel !== false, wait: b.wait !== false }; save();
        return { ok: true, phone: ph, hasKey: true };
      }
      case 'getconfig': { const c = config_(); return { ok: true, v: 9, coiffeurs: clone(c.coiffeurs), galerie: clone(c.galerie), services: clone(c.services), salon: clone(c.salon) }; }
      case 'savesalon': {
        const url = v => { v = String(v || '').trim().slice(0, 300); return /^https:\/\//.test(v) ? v : ''; };
        const str = (v, n) => String(v || '').trim().slice(0, n), hm = s => /^\d{2}:\d{2}$/.test(String(s || ''));
        const ig = String(b.instagram || '').trim().replace(/^@/, '').slice(0, 300);
        const c = config_(), old = c.salon || {};
        let horaires = old.horaires || null;
        if (b.horaires && typeof b.horaires === 'object'){
          horaires = {};
          DAYKEYS.forEach(d => { const v = b.horaires[d]; horaires[d] = Array.isArray(v) && hm(v[0]) && hm(v[1]) && toMin_(v[1]) > toMin_(v[0]) ? [v[0], v[1]] : null; });
          if (!DAYKEYS.some(d => horaires[d])) return { ok: false, error: 'horaires' };
        }
        let wa = String(b.whatsapp || '').replace(/\D/g, ''); if (wa.indexOf('0') === 0) wa = '212' + wa.slice(1);
        c.salon = { nom: str(b.nom, 40) || old.nom || SALON, adresse: str(b.adresse, 80) || old.adresse || '', ville: str(b.ville, 40) || old.ville || '',
          whatsapp: wa.length >= 11 ? wa.slice(0, 15) : (old.whatsapp || ''), tel: str(b.tel, 20) || old.tel || '', horaires,
          couleur: /^#[0-9a-fA-F]{6}$/.test(String(b.couleur || '')) ? b.couleur : (old.couleur || ''),
          maps: url(b.maps), instagram: /^https:\/\//.test(ig) ? ig : ig.replace(/[^A-Za-z0-9._]/g, ''), facebook: url(b.facebook) };
        save(); return { ok: true, salon: clone(c.salon) };
      }
      case 'saveservices': {
        if (!Array.isArray(b.services)) return { ok: false, error: 'services' };
        const str = (v, n) => String(v || '').trim().slice(0, n), lang = (o, n) => ({ fr: str(o && o.fr, n), da: str(o && o.da, n), ar: str(o && o.ar, n) });
        const list = b.services.slice(0, 30).map((s, i) => ({ id: str(s.id, 40) || ('s' + Date.now() + i), prix: Math.max(0, Math.min(5000, Math.round(Number(s.prix) || 0))),
          duree: Math.max(5, Math.min(240, Math.round((Number(s.duree) || 30) / 5) * 5)), top: !!s.top, actif: s.actif !== false,
          photo: String(s.photo || ''), nom: lang(s.nom, 40), desc: lang(s.desc, 90) })).filter(s => s.nom.da || s.nom.fr || s.nom.ar);
        if (!list.length) return { ok: false, error: 'empty' };
        config_().services = list; save(); return { ok: true, services: clone(list) };
      }
      case 'saveteam': {
        if (!Array.isArray(b.coiffeurs)) return { ok: false, error: 'team' };
        const hm = s => /^\d{2}:\d{2}$/.test(String(s || ''));
        const team = b.coiffeurs.slice(0, 20).map((x, i) => ({ id: String(x.id || ('c' + Date.now() + i)).slice(0, 40), nom: String(x.nom || '').trim().slice(0, 40),
          actif: x.actif !== false, photo: String(x.photo || ''), de: hm(x.de) ? x.de : HOURS[0], a: hm(x.a) ? x.a : HOURS[1],
          repos: (Array.isArray(x.repos) ? x.repos : []).filter(d => DAYKEYS.indexOf(d) >= 0) })).filter(x => x.nom);
        if (team.some(x => toMin_(x.a) <= toMin_(x.de))) return { ok: false, error: 'hours' };
        const names = team.map(x => x.nom.toLowerCase());
        if (new Set(names).size !== names.length) return { ok: false, error: 'dup' };
        const c = config_(), old = {}, ren = {}; let renamed = 0;
        c.coiffeurs.forEach(x => old[x.id] = x.nom);
        team.forEach(x => { if (old[x.id] && old[x.id] !== x.nom) ren[old[x.id]] = x.nom; });
        [DB.res, DB.wait].forEach(l => l.forEach(r => { if (ren.hasOwnProperty(r.barber)) { r.barber = ren[r.barber]; renamed++; } }));
        DB.blocks.forEach(k => { if (ren.hasOwnProperty(k.coiffeur)) { k.coiffeur = ren[k.coiffeur]; renamed++; } });
        c.coiffeurs = team; save(); return { ok: true, coiffeurs: clone(team), renamed };
      }
      case 'upload': { const r = upload_(b); return r ? { ok: true, id: r.id, url: r.url } : { ok: false, error: 'image' }; }
      case 'addphoto': {
        const r = upload_(b); if (!r) return { ok: false, error: 'image' };
        const c = config_(); c.galerie.unshift({ id: r.id, url: r.url }); c.galerie = c.galerie.slice(0, 12); save();
        return { ok: true, galerie: clone(c.galerie) };
      }
      case 'delphoto': { const c = config_(); c.galerie = c.galerie.filter(x => x.id !== String(b.id)); save(); return { ok: true, galerie: clone(c.galerie) }; }
      case 'movephoto': {
        const c = config_(), i = c.galerie.findIndex(x => x.id === String(b.id)), j = i + (b.dir === 'up' ? -1 : 1);
        if (i >= 0 && j >= 0 && j < c.galerie.length){ const x = c.galerie[i]; c.galerie[i] = c.galerie[j]; c.galerie[j] = x; save(); }
        return { ok: true, galerie: clone(c.galerie) };
      }
      default: return { ok: false, error: 'op' };
    }
  }
  function doPost(b){
    switch (b.action || 'book'){
      case 'book': return book_(b);
      case 'cancel': return cancel_(b);
      case 'waitlist': return waitlist_(b);
      case 'admin': return admin_(b);
      default: return { ok: false, error: 'action' };
    }
  }

  /* ---------- fetch shim ---------- */
  const realFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(API) !== 0) return realFetch(input, init);
    load();                                            // l-tab lakhor y9der ykoun beddel chi 7aja
    let out;
    try {
      if (init && String(init.method || 'GET').toUpperCase() === 'POST'){ let b = {}; try { b = JSON.parse(init.body || '{}'); } catch(e){} out = doPost(b); }
      else { const p = {}; new URL(url).searchParams.forEach((v, k) => p[k] = v); out = doGet(p); }
    } catch(e){ console.error(e); out = { ok: false, error: 'demo' }; }
    return new Promise(res => setTimeout(() => res(new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } })), 220));
  };
})();
