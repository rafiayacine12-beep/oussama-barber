// /api/ics — kayrdd fichier .ics b Content-Type text/calendar.
// F iPhone (Safari) kayt7el nichan "Ajouter au calendrier" — l-client kaybrek ghir 3la "Ajouter".
module.exports = (req, res) => {
  const q = req.query || {};
  const clean = (v, n) => String(v || "").replace(/[\r\n]+/g, " ").replace(/([,;\\])/g, "\\$1").slice(0, n);
  const dt = v => (/^\d{8}T\d{6}$/.test(String(v || "")) ? String(v) : null);
  const start = dt(q.s), end = dt(q.e);
  if (!start || !end) { res.statusCode = 400; res.end("bad request"); return; }
  const id = String(q.id || "rdv").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || "rdv";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Barber Junior//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:Africa/Casablanca", "BEGIN:STANDARD", "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0100", "TZOFFSETTO:+0100", "TZNAME:+01", "END:STANDARD", "END:VTIMEZONE",
    "BEGIN:VEVENT", "UID:" + id + "@barber-junior", "DTSTAMP:" + stamp,
    "DTSTART;TZID=Africa/Casablanca:" + start, "DTEND;TZID=Africa/Casablanca:" + end,
    "SUMMARY:" + clean(q.t, 120), "LOCATION:" + clean(q.l, 160), "DESCRIPTION:" + clean(q.d, 300),
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:" + clean(q.a || q.t, 120), "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="rendez-vous-' + id + '.ics"');
  res.setHeader("Cache-Control", "no-store");
  res.end(ics);
};
