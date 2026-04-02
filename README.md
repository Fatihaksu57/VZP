# VZP Editor — Verkehrszeichenpläne (RSA 21)

Mobile-first Web-App für RSA 2021-konforme Verkehrszeichenpläne.

**Live:** https://vzp.app

## Quick Start

```bash
# Live-Dateien herunterladen
./pull.sh

# Änderungen deployen
./deploy.sh                    # Alles
./deploy.sh index.html         # Einzeln
./deploy.sh js/regelplan-templates.js js/pdf-export.js
```

## Dokumentation

Siehe `AGENTS.md` für vollständige technische Dokumentation.

## Stack

- Vanilla JS + Leaflet.js
- Cloudflare Workers + KV
- Geoportal Berlin WMS (K5, Straßenbefahrung, TrueDOP)
- jsPDF + dom-to-image für PDF-Export
