#!/usr/bin/env python3
"""Kaywjjed demo/index.html w demo/admin.html men index.html w admin.html dyal s-site l-asli.
Khddmo mn racine dyal repo:  python3 demo/build.py
(Ila beddelti chi 7aja f s-site, 3awed khddem had script bach l-démo tbqa m3a l-version jdida.)"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://demo.api/exec"
OLD_API = re.compile(r'https://script\.google\.com/macros/s/[A-Za-z0-9_\-]+/exec')


def sub(s, old, new, count=1, required=True):
    if old not in s:
        if required:
            sys.exit(f"build.py: ma l9itch: {old[:70]!r}")
        return s
    return s.replace(old, new, count if count else -1)


BANNER_CSS = """
<style>
.dm-bar{position:sticky;top:0;z-index:9999;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:#17140F;color:#fff;font:600 13px/1.3 'Instrument Sans',system-ui,sans-serif;text-align:center}
.dm-bar b{color:#FFB37A}
.dm-bar a,.dm-bar button{color:#17140F;background:#fff;border:0;border-radius:999px;padding:5px 12px;font:700 12px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer}
.dm-fab{position:fixed;left:14px;bottom:88px;z-index:9998;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;background:#17140F;color:#fff;font:700 14px/1 'Instrument Sans',system-ui,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.dm-hint{margin:10px auto 0;padding:10px 14px;max-width:300px;border-radius:12px;background:#FFF1E7;border:1px dashed #E2560A;color:#C34807;font:700 14px/1.4 'Instrument Sans',system-ui,sans-serif}
</style>"""


def common(s):
    s = OLD_API.sub(API, s)
    s = s.replace('"ob_', '"dm_')                        # storage dyal démo bo7do, ma ykhltch m3a s-site l-asli
    s = s.replace('href="icons/', 'href="../icons/').replace('icon:"icons/', 'icon:"../icons/')
    s = sub(s, '<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="robots" content="noindex">\n<script src="mock-api.js"></script>')
    return s


def build_index():
    s = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    s = common(s)
    s = sub(s, '<link rel="manifest" href="manifest.webmanifest">\n', '')
    s = sub(s, 'content="Réservi f Oussama Barber, Tabriquet Salé. 24h/24, f 30 seconde."', 'content="Démo — site de réservation l salon dyalek."')
    s = sub(s, '<title>Oussama Barber · Réservation</title>', '<title>Votre Salon · Démo</title>')
    s = sub(s, 'salon:    "Oussama Barber"', 'salon:    "Votre Salon"')
    s = sub(s, 'ville:    "Salé"', 'ville:    "Votre ville"')
    s = sub(s, 'adresse:  "Tabriquet, Salé"', 'adresse:  "Votre adresse"')
    s = re.sub(r'mapsUrl:  "[^"]*"', 'mapsUrl:  "https://maps.google.com/"', s, count=1)
    s = sub(s, 'coiffeurs: ["Oussama", "Yassine", "Aymane"]', 'coiffeurs: ["Karim", "Anas", "Hamza"]')
    s = re.sub(r'(\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche):\s*)\["11:00", "21:00"\]', r'\1["10:00", "21:00"]', s)
    s = sub(s, 'pendingNote:"Oussama ghadi', 'pendingNote:"Salon ghadi')
    s = sub(s, 'PRODID:-//Oussama Barber//FR', 'PRODID:-//Votre Salon//FR')
    # service worker: la f démo
    s = re.sub(r'\nif \("serviceWorker" in navigator[^\n]*', '', s, count=1)
    bar = BANNER_CSS + """
<div class="dm-bar" id="dmBar"><span>🎬 <b>Démo</b> · Jrreb dir réservation</span>
  <button type="button" onclick="DEMO_RESET()">↺ Réinitialiser</button></div>
<a class="dm-fab" href="admin.html">🔐 Chouf l-admin</a>
"""
    s = sub(s, '<body>', '<body>' + bar)
    return s


def build_admin():
    s = open(os.path.join(ROOT, "admin.html"), encoding="utf-8").read()
    s = common(s)
    s = sub(s, '<title>Admin · Oussama Barber</title>', '<title>Admin · Votre Salon (démo)</title>')
    s = sub(s, '<h1>Oussama<small>Barber · Admin</small></h1>', '<h1>Votre<small>Salon · Admin</small></h1>')
    s = sub(s, '<span>Oussama<small>Admin</small></span>', '<span>Démo<small>Admin</small></span>')
    s = sub(s, '<p>Dkhel l-code dyalek</p>', '<p>Dkhel l-code dyalek</p>\n    <div class="dm-hint">🎬 Démo · Code: <b>1234</b></div>')
    s = s.replace('"Oussama Barber"', '"Votre Salon"').replace("Admin · Oussama Barber", "Admin · Votre Salon")
    s = s.replace('"Tabriquet, Salé"', '"Votre adresse"').replace('placeholder="Salé"', 'placeholder="Votre ville"').replace('|| "Salé"', '|| "Votre ville"')
    s = sub(s, 'placeholder="Oussama Barber"', 'placeholder="Votre Salon"', required=False)
    s = s.replace("https://maps.google.com/?q=Oussama+Barber+Tabriquet+Sal%C3%A9", "https://maps.google.com/")
    # nefs l-onglet: f WhatsApp, onglet jdid kayt7el f navigateur akhor w l-data ma katbanch
    s = s.replace('href="./" target="_blank" rel="noopener"', 'href="./"')
    bar = BANNER_CSS + """
<div class="dm-bar"><span>🎬 <b>Admin démo</b></span>
  <a href="./">👀 Chouf s-site</a>
  <button type="button" onclick="DEMO_RESET()">↺ Réinitialiser</button></div>
"""
    s = sub(s, '<body>', '<body>' + bar)
    return s


if __name__ == "__main__":
    out = os.path.join(ROOT, "demo")
    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(build_index())
    open(os.path.join(out, "admin.html"), "w", encoding="utf-8").write(build_admin())
    print("✓ demo/index.html + demo/admin.html")
