// ═══════════════════════════════════════════════════════════════
// VZP Editor — Gehweg-Breiten Overlay (Live)
// ═══════════════════════════════════════════════════════════════
// Laedt Gehweg-Polygone aus dem Berliner Geoportal-WFS fuer den
// sichtbaren Kartenausschnitt und faerbt sie nach geschaetzter
// Breite ein:
//   rot    <1.50 m  (RSA-kritisch)
//   gelb   <2.50 m
//   gruen  >=2.50 m
//
// Datenquelle: https://gdi.berlin.de/services/wfs/strassenbefahrung
// Feature Type: strassenbefahrung:cl_gehweg
// Lizenz: Datenlizenz Deutschland - Zero - Version 2.0
// Quellvermerk: "Geoportal Berlin / Strassenbefahrung 2014 - Gehweg"
//
// Performance-Strategie:
//   - Nur aktiv ab Zoom >= 17 (sonst zu viele Features)
//   - Labels nur ab Zoom >= 19 (sonst ueberladen)
//   - Debounce 300ms bei moveend
//   - In-Memory-Cache pro BBox-Kachel
//   - Abort laufender Request wenn neuer kommt
// ═══════════════════════════════════════════════════════════════

var GehwegOverlay = (function() {

  var WFS_URL = 'https://gdi.berlin.de/services/wfs/strassenbefahrung';
  var FEATURE_TYPE = 'strassenbefahrung:cl_gehweg';

  var MIN_ZOOM_POLYGONS = 17;
  var MIN_ZOOM_LABELS = 19;
  var DEBOUNCE_MS = 300;
  var MAX_FEATURES_PER_REQUEST = 500;

  var COLORS = {
    narrow:  { fill: '#dc2626', stroke: '#991b1b' }, // <1.5m
    medium:  { fill: '#d97706', stroke: '#92400e' }, // 1.5-2.5m
    wide:    { fill: '#059669', stroke: '#065f46' }, // >=2.5m
    unknown: { fill: '#6b7280', stroke: '#374151' }
  };

  var mapRef = null;
  var active = false;
  var polygonLayer = null;
  var labelLayer = null;
  var debounceTimer = null;
  var abortCtrl = null;
  var cache = {};
  var lastRequestKey = null;

  // ─── Lokale Meter-Projektion (equirectangular) ─────────────────
  // Fuer kleine Flaechen (< 1km) vollkommen ausreichend und ohne
  // UTM-Bibliothek. 1° Latitude ≈ 111320 m; 1° Longitude ≈ 111320 * cos(lat) m.
  function toLocalMeters(ring4326, lat0) {
    // ring4326: array of [lng, lat]
    var cosLat = Math.cos(lat0 * Math.PI / 180);
    var mPerDegLat = 111320;
    var mPerDegLng = 111320 * cosLat;
    return ring4326.map(function(p) {
      return [p[0] * mPerDegLng, p[1] * mPerDegLat];
    });
  }

  function polygonAreaMeters(ringM) {
    var area = 0;
    for (var i = 0; i < ringM.length - 1; i++) {
      area += ringM[i][0] * ringM[i + 1][1] - ringM[i + 1][0] * ringM[i][1];
    }
    return Math.abs(area) / 2;
  }

  function edgeLengths(ringM) {
    var out = [];
    for (var i = 0; i < ringM.length - 1; i++) {
      var dx = ringM[i + 1][0] - ringM[i][0];
      var dy = ringM[i + 1][1] - ringM[i][1];
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.15) out.push(len); // Rundungsartefakte filtern
    }
    return out;
  }

  // ─── Breiten-Heuristik ─────────────────────────────────────────
  // Gehweg-Polygone aus der Strassenbefahrung sind typisch schmale
  // Streifen mit 4-20 Ecken. Die Kuerzeste Kante ist nicht immer die
  // Breite (Polygon kann Ecken haben), aber: Wenn wir alle Kanten der
  // Laenge nach sortieren, sind die KURZEN Kanten die Querseiten
  // (ca. 30-40% der Gesamtkanten), die LANGEN die Laengsseiten.
  //
  // Strategie:
  // 1. "area / halfPerim" als Baseline (fuer ideale Rechtecke exakt).
  // 2. Median der unteren 40% der Kantenlaengen als Alternative.
  // 3. Wenn Polygon "dick" ist (A/L_max > 3), wird area/halfPerim
  //    unzuverlaessig → nur Median nehmen.
  // 4. Plausibilitaet: 0.3 m <= breite <= 12 m.
  function estimateWidthMeters(ring4326, lat0) {
    if (!ring4326 || ring4326.length < 4) return null;
    var ringM = toLocalMeters(ring4326, lat0);
    var edges = edgeLengths(ringM);
    if (edges.length < 3) return null;

    var area = polygonAreaMeters(ringM);
    if (area < 0.5) return null;

    var halfPerim = 0;
    for (var i = 0; i < edges.length; i++) halfPerim += edges[i];
    halfPerim /= 2;

    // Baseline: area / halfPerim → exakt fuer Rechteck mit L >> B
    var widthBaseline = halfPerim > 0 ? area / halfPerim : null;

    // Median der kuerzesten 40% Kanten (Querseiten)
    var sorted = edges.slice().sort(function(a, b) { return a - b; });
    var take = Math.max(1, Math.ceil(sorted.length * 0.4));
    var shortSlice = sorted.slice(0, take);
    var midIdx = Math.floor(shortSlice.length / 2);
    var widthMedian = shortSlice.length % 2 === 0
      ? (shortSlice[midIdx - 1] + shortSlice[midIdx]) / 2
      : shortSlice[midIdx];

    // Aspect-Ratio check: wenn laengste Kante stark groesser als kuerzeste
    // → laengliches Rechteck → widthBaseline ist praezise
    var longestEdge = sorted[sorted.length - 1];
    var aspect = longestEdge / widthMedian;

    var width;
    if (widthBaseline && aspect > 3 && widthBaseline < 12) {
      // Typisches langes Gehweg-Segment → Baseline ist am genausten
      // aber Median dient als Sanity-Check
      if (Math.abs(widthBaseline - widthMedian) / widthMedian < 0.6) {
        width = widthBaseline;
      } else {
        // Polygon hat Knicke — Median der kurzen Kanten ist robuster
        width = widthMedian;
      }
    } else {
      // "Kompaktes" Polygon (Platz, Eingangsbereich) — Median der kurzen
      // Kanten gibt eine sinnvolle "engste Stelle" zurueck
      width = widthMedian;
    }

    if (width < 0.3 || width > 15) return null;
    return width;
  }

  // ─── WFS-Query (BBox in 4326, lat,lng-Order) ──────────────────

  function bounds4326BBox(bounds) {
    return {
      minLat: bounds.getSouth(),
      minLng: bounds.getWest(),
      maxLat: bounds.getNorth(),
      maxLng: bounds.getEast()
    };
  }

  function cacheKey(bb) {
    // Auf ~5 m runden (5m ≈ 4.5e-5 deg Lat)
    var r = 0.00005;
    return [
      Math.floor(bb.minLat / r), Math.floor(bb.minLng / r),
      Math.ceil(bb.maxLat / r),  Math.ceil(bb.maxLng / r)
    ].join(',');
  }

  function fetchFeatures(bb) {
    var key = cacheKey(bb);
    if (cache[key]) return Promise.resolve(cache[key]);

    if (abortCtrl) { try { abortCtrl.abort(); } catch (e) {} }
    abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    // WFS 2.0 + urn:ogc:def:crs:EPSG::4326 erwartet lat,lng-Reihenfolge
    var url = WFS_URL +
      '?service=WFS&version=2.0.0&request=GetFeature' +
      '&typeNames=' + FEATURE_TYPE +
      '&bbox=' + bb.minLat.toFixed(6) + ',' + bb.minLng.toFixed(6) +
      ',' + bb.maxLat.toFixed(6) + ',' + bb.maxLng.toFixed(6) +
      ',urn:ogc:def:crs:EPSG::4326' +
      '&count=' + MAX_FEATURES_PER_REQUEST +
      '&outputFormat=application/json' +
      '&srsName=urn:ogc:def:crs:EPSG::4326';

    var opts = {};
    if (abortCtrl) opts.signal = abortCtrl.signal;

    return fetch(url, opts).then(function(r) {
      if (!r.ok) throw new Error('WFS ' + r.status);
      return r.json();
    }).then(function(gj) {
      var features = (gj && gj.features) || [];
      cache[key] = features;
      return features;
    });
  }

  // ─── Rendering ────────────────────────────────────────────────

  function classifyWidth(w) {
    if (w === null || w === undefined) return COLORS.unknown;
    if (w < 1.5) return COLORS.narrow;
    if (w < 2.5) return COLORS.medium;
    return COLORS.wide;
  }

  function coordsToLatLngs(coords) {
    // GeoJSON [lng, lat] → Leaflet [lat, lng]
    return coords.map(function(p) { return [p[1], p[0]]; });
  }

  function polygonCentroid(ring4326) {
    var lat = 0, lng = 0, n = Math.max(1, ring4326.length - 1);
    for (var i = 0; i < n; i++) { lat += ring4326[i][1]; lng += ring4326[i][0]; }
    return [lat / n, lng / n];
  }

  function renderFeatures(features, zoom) {
    if (!polygonLayer || !labelLayer) return;
    polygonLayer.clearLayers();
    labelLayer.clearLayers();

    var showLabels = zoom >= MIN_ZOOM_LABELS;

    features.forEach(function(f) {
      if (!f.geometry) return;
      var rings4326 = [];
      if (f.geometry.type === 'Polygon') {
        rings4326 = [f.geometry.coordinates[0]];
      } else if (f.geometry.type === 'MultiPolygon') {
        rings4326 = f.geometry.coordinates.map(function(p) { return p[0]; });
      } else {
        return;
      }

      rings4326.forEach(function(ring4326) {
        // Lokal-Meter-Projektion am Polygon-Centroid
        var c = polygonCentroid(ring4326);
        var width = estimateWidthMeters(ring4326, c[0]);
        var color = classifyWidth(width);
        var latlngs = coordsToLatLngs(ring4326);

        var poly = L.polygon(latlngs, {
          color: color.stroke,
          weight: 1,
          opacity: 0.85,
          fillColor: color.fill,
          fillOpacity: 0.35,
          interactive: true
        });

        poly.bindTooltip(
          width === null
            ? '<b>Gehweg</b><br>Breite unbestimmt'
            : '<b>Gehweg</b> ' + width.toFixed(2) + ' m',
          { sticky: true, direction: 'top', opacity: 0.95 }
        );

        polygonLayer.addLayer(poly);

        if (showLabels && width !== null) {
          var label = L.marker(c, {
            interactive: false,
            icon: L.divIcon({
              html: '<div style="font:700 10px \'IBM Plex Mono\',monospace;' +
                    'color:#fff;background:' + color.stroke + ';' +
                    'padding:1px 4px;border-radius:3px;' +
                    'box-shadow:0 1px 2px rgba(0,0,0,.35);' +
                    'white-space:nowrap">' + width.toFixed(1) + 'm</div>',
              iconSize: [36, 14],
              iconAnchor: [18, 7],
              className: ''
            })
          });
          labelLayer.addLayer(label);
        }
      });
    });
  }

  // ─── Refresh (debounced) ──────────────────────────────────────

  function refresh() {
    if (!active || !mapRef) return;
    var zoom = mapRef.getZoom();

    if (zoom < MIN_ZOOM_POLYGONS) {
      if (polygonLayer) polygonLayer.clearLayers();
      if (labelLayer)   labelLayer.clearLayers();
      setStatusPill('Weiter einzoomen fuer Gehweg-Daten', 'hint');
      return;
    }

    var bb = bounds4326BBox(mapRef.getBounds());
    var key = cacheKey(bb);
    if (key === lastRequestKey && cache[key]) {
      renderFeatures(cache[key], zoom);
      return;
    }
    lastRequestKey = key;

    setStatusPill('Lade Gehwege…', 'loading');
    fetchFeatures(bb).then(function(features) {
      if (!active) return;
      renderFeatures(features, mapRef.getZoom());
      setStatusPill(features.length + ' Gehwege', 'ok');
    }).catch(function(err) {
      if (err && err.name === 'AbortError') return;
      setStatusPill('WFS-Fehler', 'error');
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('GehwegOverlay fetch failed:', err);
      }
    });
  }

  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, DEBOUNCE_MS);
  }

  // ─── Status-Pill ──────────────────────────────────────────────

  var pillEl = null;
  function ensurePill() {
    if (pillEl) return pillEl;
    pillEl = document.createElement('div');
    pillEl.id = 'gehweg-overlay-pill';
    pillEl.style.cssText =
      'position:absolute;top:58px;right:10px;z-index:800;' +
      'padding:5px 10px;border-radius:14px;' +
      'font:600 11px "IBM Plex Mono",monospace;' +
      'background:rgba(26,24,20,.88);color:#fff;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25);' +
      'backdrop-filter:blur(6px);' +
      'display:none;pointer-events:none;white-space:nowrap';
    document.body.appendChild(pillEl);
    return pillEl;
  }
  function setStatusPill(text, kind) {
    var p = ensurePill();
    var bg = {
      ok: 'rgba(5,150,105,.9)', loading: 'rgba(37,99,235,.9)',
      error: 'rgba(220,38,38,.9)', hint: 'rgba(26,24,20,.88)'
    }[kind] || 'rgba(26,24,20,.88)';
    p.style.background = bg;
    p.textContent = text;
    p.style.display = active ? 'block' : 'none';
  }

  // ─── Oeffentliche API ─────────────────────────────────────────

  function init(map) { mapRef = map; }

  function enable() {
    if (!mapRef || active) return;
    active = true;
    if (!polygonLayer) polygonLayer = L.layerGroup().addTo(mapRef);
    else mapRef.addLayer(polygonLayer);
    if (!labelLayer) labelLayer = L.layerGroup().addTo(mapRef);
    else mapRef.addLayer(labelLayer);
    mapRef.on('moveend', scheduleRefresh);
    mapRef.on('zoomend', scheduleRefresh);
    ensurePill().style.display = 'block';
    refresh();
  }

  function disable() {
    if (!active) return;
    active = false;
    mapRef.off('moveend', scheduleRefresh);
    mapRef.off('zoomend', scheduleRefresh);
    if (polygonLayer) { mapRef.removeLayer(polygonLayer); polygonLayer.clearLayers(); }
    if (labelLayer)   { mapRef.removeLayer(labelLayer);   labelLayer.clearLayers(); }
    if (pillEl) pillEl.style.display = 'none';
    lastRequestKey = null;
    if (abortCtrl) { try { abortCtrl.abort(); } catch (e) {} abortCtrl = null; }
  }

  function toggle() {
    if (active) { disable(); return false; }
    enable(); return true;
  }

  function isActive() { return active; }

  return {
    init: init,
    enable: enable,
    disable: disable,
    toggle: toggle,
    isActive: isActive,
    estimateWidthMeters: estimateWidthMeters
  };
})();
