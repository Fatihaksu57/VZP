// ═══════════════════════════════════════════════════════════════
// VZP Editor — Regelplan Templates v35 (Delegations-Fassade)
// ═══════════════════════════════════════════════════════════════
// Diese Datei hielt bis v34 einen kompletten parallelen Monolithen
// mit eigener Geometrie, eigenem Katalog und eigenen place*-Funktionen
// fuer jeden Plan. Seit v35 delegiert sie komplett an die V2-Engine
// (Catalog + Layout + Renderer). BII1-BII5 werden einheitlich ueber
// den deklarativen Katalog gebaut.
//
// Oeffentliche API (unveraendert, damit index.html nicht angefasst
// werden muss):
//   - generateOverlay(map, lls, rpId, seite, opts)
//   - generatePolygonOverlay(map, polygon, opts)
//   - REGELPLÄNE, RSA_DISTANCES, getMapScale, pLen
// ═══════════════════════════════════════════════════════════════

var RegelplanTemplates = (function() {

  // Backwards-compat: alte Konsumenten lesen diese Konstanten.
  var RSA_DISTANCES = (typeof RegelplanCatalogV2 !== 'undefined')
    ? RegelplanCatalogV2.RSA_DISTANCES
    : { innerorts_50: { vorwarn: 50, sicher: 5, nachwarn: 30 },
        innerorts_30: { vorwarn: 30, sicher: 3, nachwarn: 20 } };

  function buildRegelplaeneFromCatalog() {
    var out = {};
    if (typeof RegelplanCatalogV2 === 'undefined') return out;
    var keys = Object.keys(RegelplanCatalogV2.PLANS);
    for (var i = 0; i < keys.length; i++) {
      var p = RegelplanCatalogV2.PLANS[keys[i]];
      out[p.id] = {
        id: p.id,
        name: p.name,
        titel: p.titel,
        beschreibung: p.beschreibung,
        arbeitsstelle: { start: 0, ende: 1 }
      };
    }
    return out;
  }
  var REGELPLÄNE = buildRegelplaeneFromCatalog();

  var activePolygonOverlay = null;

  // ─── Linien-Overlay: delegiert an V2 ─────────────────────────
  function generateOverlay(map, lls, rpId, seite, opts) {
    if (typeof RegelplanEngineV2 === 'undefined') return null;
    return RegelplanEngineV2.generateOverlay(map, lls, rpId, seite, opts || {});
  }

  // ─── Polygon-Overlay ─────────────────────────────────────────
  // Eigenlogik, da V2-Engine linien-basiert ist. Rendert schraffierte
  // Flaeche plus umlaufende rot/weisse Absperrung und Z123-Warnungen.

  function oLL(ll, b, d) {
    return RegelplanGeometryV2.offsetLatLng(ll, b, d);
  }
  function bear(a, b) {
    return RegelplanGeometryV2.bearing(a, b);
  }
  function pLen(l) {
    return RegelplanGeometryV2.polylineLength(l);
  }
  function edgeLen(a, b) { return L.latLng(a).distanceTo(L.latLng(b)); }
  function edgeMid(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function polygonPerimeter(poly) {
    var total = 0;
    for (var i = 0; i < poly.length - 1; i++) total += edgeLen(poly[i], poly[i + 1]);
    return total;
  }
  function ll2m(ll) {
    var x = ll[1] * 20037508.34 / 180;
    var r = ll[0] * Math.PI / 180;
    var y = Math.log(Math.tan(Math.PI / 4 + r / 2)) * 20037508.34 / Math.PI;
    return { x: x, y: y };
  }
  function polygonAreaSquareMeters(poly) {
    var area = 0;
    for (var i = 0; i < poly.length - 1; i++) {
      var a = ll2m(poly[i]), b = ll2m(poly[i + 1]);
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2;
  }
  function polygonCentroid(poly) {
    var sumLat = 0, sumLng = 0, count = Math.max(1, poly.length - 1);
    for (var i = 0; i < count; i++) { sumLat += poly[i][0]; sumLng += poly[i][1]; }
    return [sumLat / count, sumLng / count];
  }
  function outwardBearing(a, b, centroid) {
    var m = edgeMid(a, b, 0.5), br = bear(a, b);
    var p1 = oLL(m, br + 90, 1.5), p2 = oLL(m, br - 90, 1.5);
    var c = L.latLng(centroid);
    return L.latLng(p1).distanceTo(c) > L.latLng(p2).distanceTo(c) ? br + 90 : br - 90;
  }

  function ensureHatchPattern(map) {
    setTimeout(function() {
      var svg = map.getPanes().overlayPane.querySelector('svg');
      if (!svg || svg.querySelector('#vzp-workarea-hatch')) return;
      var defs = svg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      if (!defs.parentNode) svg.insertBefore(defs, svg.firstChild);
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
      p.setAttribute('id', 'vzp-workarea-hatch');
      p.setAttribute('patternUnits', 'userSpaceOnUse');
      p.setAttribute('width', '8'); p.setAttribute('height', '8');
      p.setAttribute('patternTransform', 'rotate(45)');
      var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '8'); bg.setAttribute('height', '8');
      bg.setAttribute('fill', '#e65100'); bg.setAttribute('fill-opacity', '0.07');
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
      line.setAttribute('x2', '0'); line.setAttribute('y2', '8');
      line.setAttribute('stroke', '#e02f00'); line.setAttribute('stroke-opacity', '0.52');
      line.setAttribute('stroke-width', '2');
      p.appendChild(bg); p.appendChild(line); defs.appendChild(p);
    }, 0);
  }

  function polygonBarrierLine(grp, poly, scene) {
    var line = poly.slice();
    if (line.length < 2) return;
    var base = L.polyline(line, { color: '#1f1b14', weight: 7, opacity: 0.45, lineCap: 'butt', lineJoin: 'miter', interactive: false });
    var white = L.polyline(line, { color: '#ffffff', weight: 5, opacity: 1, lineCap: 'butt', lineJoin: 'miter', interactive: false });
    var red = L.polyline(line, { color: '#d71920', weight: 5, opacity: 1, dashArray: '8 6', lineCap: 'butt', lineJoin: 'miter', interactive: false });
    grp.addLayer(base); grp.addLayer(white); grp.addLayer(red);
    if (scene) scene.items.push({
      kind: 'barrier', role: 'polygon_continuous_barrier',
      asset: 'continuous_red_white_line', polygon: line,
      lengthMeters: polygonPerimeter(line)
    });
  }

  function mkVZ(map, grp, point, nr, rot) {
    var fileName = {
      '123': 'vz_123.svg', '208': 'vz_208.svg', '259': 'vz_259.svg',
      '267': 'vz_267.svg', '283': 'vz_283.svg', '306': 'vz_306.svg', '308': 'vz_308.svg'
    }[nr];
    if (!fileName) return null;
    var c = map.getCenter();
    var p1 = map.latLngToContainerPoint(c);
    var p2 = map.latLngToContainerPoint(oLL([c.lat, c.lng], 90, 1));
    var s = Math.max(18, Math.round(Math.abs(p2.x - p1.x)));
    var m = L.marker(point, {
      draggable: true,
      icon: L.divIcon({
        html: '<img src="assets/svg/' + fileName + '" style="width:' + s + 'px;height:' + s + 'px;background:#fff;border-radius:2px;padding:1px;box-shadow:0 1px 3px rgba(0,0,0,.3);transform:rotate(' + (rot || 0) + 'deg)" draggable="false">',
        iconSize: [s, s], iconAnchor: [s / 2, s / 2], className: ''
      }),
      zIndexOffset: 700
    });
    grp.addLayer(m);
    return m;
  }

  function polygonWarningSigns(map, grp, poly, mk, scene) {
    var centroid = polygonCentroid(poly);
    var lengths = [], maxLen = 0;
    for (var i = 0; i < poly.length - 1; i++) {
      var len = edgeLen(poly[i], poly[i + 1]);
      lengths.push({ index: i, len: len });
      if (len > maxLen) maxLen = len;
    }
    lengths.forEach(function(entry) {
      if (entry.len < 8 || entry.len < maxLen * 0.98) return;
      var a = poly[entry.index], b = poly[entry.index + 1];
      var outBr = outwardBearing(a, b, centroid);
      var pStart = oLL(edgeMid(a, b, 0.15), outBr, 2.5);
      var pEnd   = oLL(edgeMid(a, b, 0.85), outBr, 2.5);
      var s1 = mkVZ(map, grp, pStart, '123', 0);
      var s2 = mkVZ(map, grp, pEnd,   '123', 180);
      if (s1) mk.push(s1);
      if (s2) mk.push(s2);
      if (scene) {
        scene.items.push({ kind: 'sign', role: 'polygon_warning_start', sign: '123', point: pStart, rotation: 0 });
        scene.items.push({ kind: 'sign', role: 'polygon_warning_end', sign: '123', point: pEnd, rotation: 180 });
      }
    });
  }

  function generatePolygonOverlay(map, polygon, opts) {
    if (!polygon || polygon.length < 4) return null;
    if (activePolygonOverlay) { activePolygonOverlay.remove(); activePolygonOverlay = null; }
    opts = opts || {};
    ensureHatchPattern(map);

    var grp = L.layerGroup().addTo(map);
    var markers = [];
    var perimeter = polygonPerimeter(polygon);
    var scene = {
      planId: 'CUSTOM_AREA',
      baustellenLaenge: perimeter,
      polygonPerimeter: perimeter,
      polygonArea: polygonAreaSquareMeters(polygon),
      workZonePolygon: polygon.slice(),
      items: [],
      dimensions: [{ kind: 'perimeter', value: perimeter }],
      validations: [{
        code: 'POLYGON_SIGNS_REVIEW', severity: 'warning',
        message: 'Verkehrszeichenlogik fuer Polygon-Arbeitsbereich pruefen'
      }]
    };

    function render() {
      grp.clearLayers();
      scene.items = [];
      ensureHatchPattern(map);
      var area = L.polygon(polygon, {
        fillColor: '#e65100', fillOpacity: 0.13,
        color: '#d32f00', weight: 2.5, dashArray: '4,4',
        interactive: false
      });
      grp.addLayer(area);
      scene.items.push({
        kind: 'workarea', role: 'polygon_work_area',
        areaSquareMeters: scene.polygonArea
      });
      setTimeout(function() {
        var el = area.getElement && area.getElement();
        if (el) el.setAttribute('fill', 'url(#vzp-workarea-hatch)');
      }, 0);
      markers = [];
      polygonBarrierLine(grp, polygon, scene);
      if (opts.enableWarnings !== false) {
        polygonWarningSigns(map, grp, polygon, markers, scene);
      }
    }

    render();
    var onZoom = function() { render(); };
    map.on('zoomend', onZoom);

    activePolygonOverlay = {
      overlay: grp, group: grp, scene: scene,
      markers: markers,
      baustellenLaenge: perimeter,
      validations: scene.validations,
      remove: function() {
        map.removeLayer(grp);
        map.off('zoomend', onZoom);
        activePolygonOverlay = null;
      }
    };
    return activePolygonOverlay;
  }

  // ─── Hilfen fuer andere Module ───────────────────────────────
  function getMapScale(map) {
    var c = map.getCenter();
    var p1 = map.latLngToLayerPoint(c);
    var p2 = map.latLngToLayerPoint(L.latLng(c.lat, c.lng + 0.00001));
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) / 0.00001 /
           (111320 * Math.cos(c.lat * Math.PI / 180));
  }

  // CSS-Patch fuer Leaflet-DivIcons (Hintergrund unsichtbar)
  (function() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('rp35css')) return;
    var s = document.createElement('style');
    s.id = 'rp35css';
    s.textContent = '.leaflet-div-icon{background:none!important;border:none!important}';
    document.head.appendChild(s);
  })();

  return {
    REGELPLÄNE: REGELPLÄNE,
    RSA_DISTANCES: RSA_DISTANCES,
    generateOverlay: generateOverlay,
    generatePolygonOverlay: generatePolygonOverlay,
    getMapScale: getMapScale,
    pLen: pLen
  };
})();
