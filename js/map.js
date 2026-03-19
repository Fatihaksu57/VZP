// ═══════════════════════════════════════════════════
// VZP Editor — Map Module
// ═══════════════════════════════════════════════════

const MapModule = (() => {
  let map, osmL, satL, alkL, strL, fachL;

  function init() {
    map = L.map('map', {
      center: [52.520, 13.405],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
      doubleClickZoom: false,
    });

    osmL = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    satL = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    alkL = L.tileLayer.wms('https://gdi.berlin.de/services/wms/alkis', {
      layers: 'a_alkis_raster', styles: '', format: 'image/png', transparent: true, maxZoom: 22
    });
    // Straßenbefahrung 2014 — Verkehrsflächen (Fahrbahn, Gehweg, Bordstein, Radweg)
    strL = L.tileLayer.wms('https://gdi.berlin.de/services/wms/strassenbefahrung', {
      layers: 'cm_fahrbahn,cl_gehweg,ch_radweg,bd_bordstein,ck_parkflaeche,ce_gruenflaeche,cf_trennstreifen',
      styles: '',
      format: 'image/png', transparent: true, maxZoom: 22,
    });
    // Fachkarte Straßenbefahrung 2014 — alles: Flächen + Markierungen + Objekte + VZ
    fachL = L.tileLayer.wms('https://gdi.berlin.de/services/wms/strassenbefahrung', {
      layers: [
        'cm_fahrbahn','cl_gehweg','ch_radweg','bd_bordstein',
        'ck_parkflaeche','ce_gruenflaeche','cf_trennstreifen',
        'be_fahrbahnmarkierunglinie','bp_fahrbahnmarkierung_flaeche',
        'an_fahrbahnmarkierung_piktogramm',
        'bg_leitplanke','bf_gelaender','bh_mauer',
        'bx_fahrbahnschwelle','by_gehwegueberfahrt',
        'bz_gleiskoerper_strab',
        'as_mast','at_mast_lsa',
        'aa_verkehrszeichen',
      ].join(','),
      styles: '',
      format: 'image/png', transparent: true, maxZoom: 22,
    });

    // Maßstabsleiste (metrisch, unten links)
    L.control.scale({
      metric: true,
      imperial: false,
      position: 'bottomleft',
      maxWidth: 200,
    }).addTo(map);

    // Status bar updates
    map.on('mousemove', e => {
      document.getElementById('stCoord').textContent =
        `${e.latlng.lat.toFixed(5)}° N, ${e.latlng.lng.toFixed(5)}° E`;
      DrawTools.onMouseMove(e.latlng);
    });
    map.on('zoomend', () => {
      updateScaleDisplay();
    });

    // Click handlers
    map.on('click', e => {
      if (DrawTools.isActive()) {
        DrawTools.addPoint(e.latlng);
      } else {
        ObjectManager.deselect();
      }
    });
    map.on('dblclick', e => {
      L.DomEvent.preventDefault(e);
      DrawTools.finalize();
    });
    map.on('contextmenu', e => {
      L.DomEvent.preventDefault(e);
      DrawTools.cancel();
    });

    return map;
  }

  // Called once after init from outside
  function postInit() {
    updateScaleDisplay();
  }

  function switchLayer(layerName) {
    [osmL, satL, alkL, strL, fachL].forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
    if (layerName === 'osm') osmL.addTo(map);
    else if (layerName === 'sat') satL.addTo(map);
    else if (layerName === 'alkis') { osmL.addTo(map); alkL.addTo(map); }
    else if (layerName === 'str') { osmL.addTo(map); strL.addTo(map); }
    else if (layerName === 'fach') { osmL.addTo(map); fachL.addTo(map); }
  }

  // Compute approximate map scale from zoom level + latitude
  function updateScaleDisplay() {
    const zoom = map.getZoom();
    const lat = map.getCenter().lat;
    // meters per pixel at given zoom & latitude
    const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    // Assume ~96 DPI screen → 1 inch = 96 px = 0.0254 m
    const scale = Math.round(mpp / 0.000264583); // 1px ≈ 0.264mm
    // Format scale nicely
    let scaleStr;
    if (scale >= 1000000) scaleStr = '1:' + (scale / 1000000).toFixed(1) + ' M';
    else if (scale >= 1000) scaleStr = '1:' + Math.round(scale / 1000) + 'K';
    else scaleStr = '1:' + scale;
    document.getElementById('stZoom').textContent = `${scaleStr} (Z${zoom})`;
  }

  async function searchAddress(query) {
    if (!query.trim()) return;
    const q = query.includes('Berlin') ? query : query + ', Berlin';
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=de`);
      const data = await res.json();
      if (data.length > 0) {
        map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 17);
        UI.toast('📍 ' + data[0].display_name.split(',')[0]);
      } else {
        UI.toast('Adresse nicht gefunden');
      }
    } catch (e) {
      UI.toast('Suche fehlgeschlagen');
    }
  }

  function getMap() { return map; }
  function getContainer() { return document.getElementById('map'); }

  return { init, postInit, switchLayer, searchAddress, getMap, getContainer };
})();
