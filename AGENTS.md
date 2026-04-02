# VZP Editor — AGENTS.md
# Kontextdatei für KI-Assistenten (Claude, ChatGPT, Codex)

## Was ist VZP?

Mobile-first Web-App für RSA 2021-konforme Verkehrszeichenpläne (VZP) für Baustellen.
Betrieben von **QFM GmbH** (Tiefbau/Leitungsbau Berlin).
Ziel: Professionelle VZP-Erstellung auf dem Handy, ohne Desktop oder CAD-Software.

**Live:** https://vzp.app

---

## Architektur

```
vzp.app (Cloudflare Workers + KV)
├── index.html          ← Haupt-App (Single Page, alles inline)
├── js/
│   ├── regelplan-templates.js   ← RSA 21 Regelplan-Platzierung (B II/1-5)
│   ├── pdf-export.js            ← PDF-Export mit dom-to-image + jsPDF
│   ├── drag-handles.js          ← Drag-Handles für Linienpunkte
│   ├── massketten.js            ← Maßketten/Bemaßungen (SVG overlay)
│   ├── regelplan-image-overlay.js ← RSA-Bild als Overlay auf Karte
│   └── leaflet-imageoverlay-rotated.js ← Leaflet Plugin
├── assets/
│   ├── svg/                     ← SVG-Symbole (Schranken, Baken, VZ)
│   ├── rp_BII*_rsa21.png       ← RSA 21 PDF Ausschnitte
│   └── vz/                      ← VZ-Bilder (JPG)
└── css/app.css                  ← Nicht mehr genutzt (CSS ist in index.html)
```

### Hosting & Deploy

- **Cloudflare Workers** mit **KV Storage** (Namespace `VZP_FILES`)
- Deploy API: `POST https://vzp.app/api/deploy`
  - Header: `Authorization: Bearer vzp123`, `User-Agent: VZP-Deploy/1.0`
  - Body: `{"files": [{"path": "index.html", "content": "..."}, ...]}`
- Fallback: `https://vzp-deploy.fatih-m-a.workers.dev/api/deploy`
- Lesen: `GET https://vzp.app/api/list?token=vzp123`
- Datei lesen: `GET https://vzp-deploy.fatih-m-a.workers.dev/api/read?token=vzp123&path=js/regelplan-templates.js`

### Deploy-Scripts

```bash
./deploy.sh                              # Alle .html/.js/.css/.svg deployen
./deploy.sh index.html                   # Einzelne Datei
./deploy.sh js/regelplan-templates.js js/pdf-export.js  # Mehrere
./pull.sh                                # Alle Live-Dateien herunterladen
```

---

## Tech Stack

| Komponente | Technologie |
|-----------|------------|
| Frontend | Vanilla JS, HTML, CSS (kein Framework) |
| Karte | Leaflet.js 1.9.4 |
| Basiskarten | Geoportal Berlin WMS (K5 Farbe, Straßenbefahrung, TrueDOP 2024), OSM |
| Symbole | SVG-Dateien in `assets/svg/` |
| PDF Export | jsPDF + dom-to-image (CDN, lazy loaded) |
| Fonts | IBM Plex Sans + IBM Plex Mono (Google Fonts) |
| Design | Hell, Baugewerbe-Look, Orange Akzent (#e65100) |

---

## Aktive JS-Module (in index.html geladen)

| Datei | Funktion | Status |
|-------|---------|--------|
| `regelplan-templates.js` | Platziert RSA 21 Elemente auf der Karte | ✅ Aktiv (v32) |
| `pdf-export.js` | PDF-Export mit Screenshot | ✅ Aktiv (v5) |
| `drag-handles.js` | Drag-Punkte für Linienbearbeitung | ✅ Aktiv |
| `massketten.js` | Bemaßungen/Dimensionslinien | ⚠️ Geladen, nicht getestet |
| `regelplan-image-overlay.js` | RSA-PDF-Bild als Karten-Overlay | ✅ Aktiv |
| `leaflet-imageoverlay-rotated.js` | Leaflet Plugin für rotierte Bilder | ✅ Aktiv |

### NICHT geladene alte Module (im KV aber nicht in index.html)

`map.js`, `ui.js`, `objects.js`, `draw-tools.js`, `layers.js`, `snap.js`, `vz-catalog.js`, `ki-assistent.js`, `regelplan-engine.js` — **können gelöscht oder ignoriert werden.**

---

## Regelplan-System (regelplan-templates.js)

### Koordinatensystem

- **Gezeichnete Linie** (`lls`) = Grenze Fahrbahn ↔ Baufeld
- **sf** (Seitenfaktor): `+1` = Baufeld RECHTS der Linie, `-1` = LINKS
- **sideOffset** positiv = Richtung Baufeld, negativ = Richtung Fahrbahn
- **alongOffset** positiv = in Fahrtrichtung

### Symbolgrößen

Symbole werden NICHT maßstäblich gerendert. Stattdessen:
```
Schranke Breite: max(18px, m2px(2.0m))  — 2m Segment
Schranke Höhe:   max(5px, W * 0.22)
Bake Höhe:       max(18px, m2px(1.0m))
Bake Breite:     max(5px, H * 0.28)
VZ:              max(18px, m2px(1.0m))
```

### SVG-Dateien für Absperrungen

| Datei | Beschreibung | Ausrichtung |
|-------|-------------|-------------|
| `absperrschranke.svg` | Rot-weiß gestreifter Balken (200×24) | Horizontal → `bearing-90` für längs |
| `absperrschranke_leuchte.svg` | Wie oben + 3 Warnleuchten (200×36) | Horizontal → `bearing` für quer |
| `bake_rechts.svg` | Doppelseitige Leitbake | Vertikal → `bearing` aufrecht |
| `bake_rechts_leuchte.svg` | Leitbake mit Warnleuchte | Vertikal → `bearing` aufrecht |

### Rotation (WICHTIG!)

CSS `rotate()` vs. geographischer Bearing:
- **Längsabsperrung** (Schranke parallel zur Straße): `bearing - 90`
- **Querabsperrung** (Schranke quer): `bearing`
- **Leitbaken** (aufrecht stehend): `bearing`

### Implementierte Regelpläne

| ID | RSA-Seite | Beschreibung |
|----|-----------|-------------|
| BII1 | S.77 | Radwegsperrung, geringe Einengung |
| BII2 | S.78 | Radweg mit Umleitung + VZ 259 |
| BII3 | S.79 | Nicht benutzungspfl. Radweg (nur Schranken) |
| BII4 | S.80 | **Gehwegsperrung** — Notweg auf FB, 3 diag. Leitbaken |
| BII5 | S.81 | Halbseitige Sperrung + LZA (VZ 306/308) |

---

## App-Workflow

1. **Adresse suchen** → Header-Suchfeld → Nominatim API
2. **Karte wählen** → K5 / Straßen / Luftbild / OSM (oben links)
3. **Regelplan wählen** → Panel oder Sidebar (B II/1-5 Cards)
4. **Parameter einstellen** → Seite (R/L), Breite, Tempo
5. **"Platzieren"** → 2 Punkte auf Karte tippen → Regelplan wird gerendert
6. **Anpassen** → Drag-Handles verschieben Start/Ende
7. **Exportieren** → PDF (A3 Querformat, Screenshot + Plankopf)

---

## Geoportal Berlin WMS-Dienste

| Karte | WMS URL | Layer | CRS |
|-------|---------|-------|-----|
| K5 Farbe | `gdi.berlin.de/services/wms/k5_farbe` | `k5_farbe` | EPSG:3857 ✓ |
| Straßenbefahrung | `gdi.berlin.de/services/wms/strassenbefahrung` | `cm_fahrbahn,cl_gehweg,ch_radweg,...` | EPSG:3857 ✓ |
| TrueDOP 2024 | `gdi.berlin.de/services/wms/truedop_2024` | `truedop_2024` | EPSG:3857 ✓ |

Alle mit `crossOrigin: 'anonymous'` und `Access-Control-Allow-Origin: *`.

---

## Deploy-Hinweise

- **Große Payloads** (>100KB): In Temp-Datei schreiben, dann `curl -d @file`
- **Batches**: Max 10-15 Dateien pro Request
- **Timeout**: 120s für große Payloads
- **Fallback-URL** (`vzp-deploy.fatih-m-a.workers.dev`) ist zuverlässiger für Server-Calls
- **Binäre Dateien** (PNG/JPG): Als `data:image/png;base64,...` im content-Feld

---

## Bekannte Probleme

1. **Leitbaken-Rotation** bei bestimmten Straßenwinkeln evtl. noch nicht perfekt
2. **Maßketten** geladen aber nicht verifiziert mit neuer regelplan-templates v32
3. **PDF-Export** auf manchen iOS-Versionen langsam (dom-to-image + große Karte)
4. **Kein Offline-Modus** — App braucht Internet
5. **Kein Projekt-Speichern** — Plan geht beim Schließen verloren
6. **Nur 1 Regelplan gleichzeitig** — kein Multi-Plan-Support
7. **Alte JS-Module** im KV die nicht mehr genutzt werden (Performance)

---

## Nächste geplante Features (Priorität)

1. GPS-Standort Button
2. Projekt speichern/laden (localStorage oder KV)
3. Maßketten reparieren + RSA-Validierung
4. Mehrere Regelpläne pro Projekt
5. Baustellenlänge + Restfahrbahnbreite anzeigen
6. Snap-to-Road

---

## Wichtige Regeln

- **GitHub ≠ Live**: GitHub-Repo ist Archiv. Live-Dateien kommen aus Cloudflare KV.
- **Nur SVGs**: Keine PNGs/JPGs im Rendering-Layer (Ausnahme: RSA-Bild-Overlay)
- **Mobile-first**: Kein Double-Click, Touch-freundlich, explizite "Fertig"-Buttons
- **Nur B II/1-5**: Keine B I Regelpläne nötig
- **Deploy-Test**: Nach jedem Deploy auf vzp.app testen!
