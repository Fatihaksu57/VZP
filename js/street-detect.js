/**
 * street-detect.js
 * Erkennt per Overpass API ob geklickt wurde auf:
 * - Fahrbahn (highway=residential/primary/secondary etc.)
 * - Gehweg  (highway=footway / footway=sidewalk)
 * - Radweg  (highway=cycleway)
 * Exportiert: initStreetDetect(map), getLastDetection()
 */

const StreetDetect = (() => {

  // ─── RSA-21 vzul Lookup ───────────────────────────────────────────────────
  const VZUL_FROM_MAXSPEED = {
    10: 10, 20: 20, 30: 30, 50: 50,
    60: 60, 70: 70, 80: 80, 100: 100, 130: 130
  };

  const DEFAULT_VZUL_BY_HIGHWAY = {
    living_street:  7,
    residential:   30,
    unclassified:  50,
    tertiary:      50,
    secondary:     70,
    primary:       70,
    trunk:        100,
    motorway:     130
  };

  // ─── Interner State ───────────────────────────────────────────────────────
  let _lastDetection = null;
  let _popup = null;
  let _map = null;
  let _active = false;

  // ─── Overpass Query ───────────────────────────────────────────────────────
  async function queryOverpass(lat, lng) {
    const radius = 15; // Meter um Klickpunkt
    const query = `
      [out:json][timeout:10];
      (
        way(around:${radius},${lat},${lng})["highway"];
      );
      out tags geom;
    `;

    const url = 'https://overpass-api.de/api/interpreter';
    const resp = await fetch(url, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!resp.ok) throw new Error('Overpass-Fehler: ' + resp.status);
    return resp.json();
  }

  // ─── Typ-Klassifikation ───────────────────────────────────────────────────
  function classifyWay(tags) {
    const hw = tags.highway || '';
    const footway = tags.footway || '';
    const sidewalk = tags.sidewalk || '';

    // Gehweg
    if (hw === 'footway' || hw === 'path' || hw === 'pedestrian' ||
        footway === 'sidewalk' || footway === 'yes') {
      return { type: 'footway', label: '🚶 Gehweg', color: '#e67e22' };
    }

    // Radweg
    if (hw === 'cycleway' || tags.bicycle === 'designated') {
      return { type: 'cycleway', label: '🚲 Radweg', color: '#27ae60' };
    }

    // Fahrbahn
    if (['motorway','trunk','primary','secondary','tertiary',
         'unclassified','residential','living_street','service'].includes(hw)) {
      return { type: 'road', label: '🚗 Fahrbahn', color: '#2980b9' };
    }

    return { type: 'unknown', label: '❓ Unbekannt', color: '#95a5a6' };
  }

  // ─── vzul ermitteln ───────────────────────────────────────────────────────
  function getVzul(tags) {
    if (tags.maxspeed) {
      const v = parseInt(tags.maxspeed);
      if (!isNaN(v)) return v;
    }
    return DEFAULT_VZUL_BY_HIGHWAY[tags.highway] || 50;
  }

  // ─── Anzahl Fahrspuren ────────────────────────────────────────────────────
  function getLanes(tags) {
    if (tags.lanes) {
      const l = parseInt(tags.lanes);
      if (!isNaN(l)) return l;
    }
    return null;
  }

  // ─── Popup anzeigen ───────────────────────────────────────────────────────
  function showPopup(latlng, detection) {
    if (_popup) _popup.remove();

    const { classification, vzul, lanes, tags } = detection;
    const name = tags.name ? `<br><small>${tags.name}</small>` : '';
    const lanesStr = lanes ? `· ${lanes} Spur${lanes > 1 ? 'en' : ''}` : '';

    const html = `
      <div style="font-family:sans-serif;min-width:160px">
        <div style="font-size:14px;font-weight:bold;color:${classification.color}">
          ${classification.label}
        </div>
        ${name}
        <div style="margin-top:6px;font-size:12px;color:#555">
          vzul: <strong>${vzul} km/h</strong> ${lanesStr}
        </div>
        <div style="margin-top:4px;font-size:11px;color:#888">
          highway=${tags.highway || '–'}
        </div>
        <div style="margin-top:8px">
          <button onclick="StreetDetect.useDetection()" style="
            background:${classification.color};color:#fff;border:none;
            padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">
            Übernehmen
          </button>
        </div>
      </div>
    `;

    _popup = L.popup({ maxWidth: 220 })
      .setLatLng(latlng)
      .setContent(html)
      .openOn(_map);
  }

  // ─── Click-Handler ────────────────────────────────────────────────────────
  async function onMapClick(e) {
    if (!_active) return;

    const { lat, lng } = e.latlng;

    // Ladeanzeige
    const loadPopup = L.popup({ maxWidth: 180 })
      .setLatLng(e.latlng)
      .setContent('<div style="font-family:sans-serif;font-size:13px">🔍 Erkenne Straßentyp…</div>')
      .openOn(_map);

    try {
      const data = await queryOverpass(lat, lng);

      if (!data.elements || data.elements.length === 0) {
        loadPopup.setContent('<div style="color:#c0392b">Keine Straße gefunden (OSM)</div>');
        return;
      }

      // Nächsten Way nehmen (erster = nächster durch Overpass around)
      const way = data.elements[0];
      const tags = way.tags || {};

      const classification = classifyWay(tags);
      const vzul = getVzul(tags);
      const lanes = getLanes(tags);

      _lastDetection = { classification, vzul, lanes, tags, latlng: e.latlng };

      loadPopup.remove();
      showPopup(e.latlng, _lastDetection);

      // Event feuern damit andere Module reagieren können
      document.dispatchEvent(new CustomEvent('streetDetected', {
        detail: _lastDetection
      }));

    } catch (err) {
      loadPopup.setContent(`<div style="color:#c0392b">Fehler: ${err.message}</div>`);
    }
  }

  // ─── Öffentliche API ──────────────────────────────────────────────────────
  function init(map) {
    _map = map;
    map.on('click', onMapClick);
    console.log('[StreetDetect] Initialisiert – Klicke auf Straße/Gehweg');
  }

  function setActive(bool) {
    _active = bool;
    _map.getContainer().style.cursor = bool ? 'crosshair' : '';
  }

  function getLastDetection() {
    return _lastDetection;
  }

  function useDetection() {
    if (!_lastDetection) return;
    document.dispatchEvent(new CustomEvent('streetDetectionConfirmed', {
      detail: _lastDetection
    }));
    if (_popup) { _popup.remove(); _popup = null; }
    setActive(false);
  }

  return { init, setActive, getLastDetection, useDetection };

})();

// Global zugänglich machen (für Popup-Button onclick)
window.StreetDetect = StreetDetect;
