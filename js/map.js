// ═══════════════════════════════════════════════════
// VZP Editor — Map Module
// ═══════════════════════════════════════════════════

const MapModule = (() => {
  let map, osmL, satL, alkL, strL;

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
    alkL = L.tileLayer.wms('https://gdi.berlin.de/services/wms/a_alkis_raster', {
      layers: '0', format: 'image/png', transparent: true, maxZoom: 20
    });
    strL = L.tileLayer.wms('https://gdi.berlin.de/services/wms/strassenbefahrung_2014', {
      layers: '0', format: 'image/png', transparent: true, maxZoom: 20
    });

    // Status bar updates
    map.on('mousemove', e => {
      document.getElementById('stCoord').textContent =
        `${e.latlng.lat.toFixed(5)}° N, ${e.latlng.lng.toFixed(5)}° E`;
      DrawTools.onMouseMove(e.latlng);
    });
    map.on('zoomend', () => {
      document.getElementById('stZoom').textContent = 'Zoom: ' + map.getZoom();
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

  function switchLayer(layerName) {
    [osmL, satL, alkL, strL].forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
    if (layerName === 'osm') osmL.addTo(map);
    else if (layerName === 'sat') satL.addTo(map);
    else if (layerName === 'alkis') { osmL.addTo(map); alkL.addTo(map); }
    else if (layerName === 'str') { osmL.addTo(map); strL.addTo(map); }
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

  return { init, switchLayer, searchAddress, getMap, getContainer };
})();
