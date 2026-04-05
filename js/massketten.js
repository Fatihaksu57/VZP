// ═══════════════════════════════════════════════════════════════
// VZP Editor — Maßketten v2
// Zeigt 2 Maße direkt auf der Karte (SVG-Overlay):
//   1. Länge der Maßnahme (entlang der Linie)
//   2. Restgehwegbreite (quer, vom Baufeld-Rand)
// Stil: rote Maßlinie mit Pfeilen + schwarze Beschriftung auf weißem Hintergrund
// ═══════════════════════════════════════════════════════════════

const Massketten = (() => {

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let svgLayer = null;
  let mapRef = null;
  let currentData = null; // { lls, sf, bauBreite, bauLaenge, restBreite }

  // ─── SVG-Layer erstellen ──────────────────────────────────
  function init(map) {
    mapRef = map;
    map.on('zoomend moveend', render);
  }

  function remove() {
    if (svgLayer) { mapRef.removeLayer(svgLayer); svgLayer = null; }
    currentData = null;
  }

  // ─── Maßketten aktualisieren ─────────────────────────────
  function update(lls, sf, bauBreite, bauLaenge, restBreite) {
    currentData = { lls, sf, bauBreite, bauLaenge, restBreite };
    render();
  }

  function render() {
    if (!mapRef || !currentData) return;
    const { lls, sf, bauBreite, bauLaenge, restBreite } = currentData;
    if (!lls || lls.length < 2) return;

    // SVG-Overlay neu aufbauen
    if (svgLayer) { mapRef.removeLayer(svgLayer); svgLayer = null; }

    // Leaflet SVG-Layer über die gesamte Karte
    svgLayer = L.svg({ padding: 0.1 }).addTo(mapRef);
    const root = svgLayer._rootGroup || svgLayer._container.querySelector('g');
    if (!root) return;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'vzp-massketten');

    // ── 1. Längenmaß der Maßnahme ──
    drawLaenge(g, lls, bauLaenge);

    // ── 2. Restgehwegbreite ──
    if (restBreite !== null && restBreite !== undefined) {
      drawRestgehweg(g, lls, sf, bauBreite, restBreite);
    }

    root.appendChild(g);
  }

  // ─── Geo → Pixel ─────────────────────────────────────────
  function toP(latlng) {
    return mapRef.latLngToLayerPoint(L.latLng(latlng[0], latlng[1]));
  }

  function offsetLL(ll, bearDeg, meters) {
    const R = 6378137, rad = bearDeg * Math.PI / 180, d = meters / R;
    const la = ll[0] * Math.PI / 180, lo = ll[1] * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(rad));
    const lo2 = lo+Math.atan2(Math.sin(rad)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
    return [la2*180/Math.PI, lo2*180/Math.PI];
  }

  function bearing(a, b) {
    const la=a[0]*Math.PI/180, lb=b[0]*Math.PI/180, dl=(b[1]-a[1])*Math.PI/180;
    return Math.atan2(Math.sin(dl)*Math.cos(lb), Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl))*180/Math.PI;
  }

  // ─── SVG Hilfsfunktionen ─────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // Pfeilspitze als Marker-Definition
  function arrowMarker(svg, id, color) {
    let defs = svg.querySelector('defs');
    if (!defs) { defs = el('defs', {}); svg.insertBefore(defs, svg.firstChild); }
    const marker = el('marker', {
      id, markerWidth: 6, markerHeight: 6,
      refX: 5, refY: 3, orient: 'auto'
    });
    marker.appendChild(el('path', { d: 'M0,0 L6,3 L0,6 Z', fill: color }));
    defs.appendChild(marker);
  }

  // Maßlinie mit Pfeilen und Beschriftung zeichnen
  function drawDimLine(g, x1, y1, x2, y2, label, color, offsetPx, isWarn) {
    color = color || '#c62828';
    offsetPx = offsetPx || 0;

    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 10) return;

    const nx = -dy/len, ny = dx/len; // Normalvektor (senkrecht)

    // Versatz der Maßlinie
    const ox = nx * offsetPx, oy = ny * offsetPx;
    const ax = x1+ox, ay = y1+oy;
    const bx = x2+ox, by = y2+oy;

    const markerId = 'arr-' + Math.random().toString(36).slice(2,6);
    arrowMarker(g.ownerSVGElement || g, markerId, color);

    // Hilfslinien (Extension lines)
    const extLen = Math.min(Math.abs(offsetPx) + 6, 20);
    const extSign = offsetPx >= 0 ? 1 : -1;
    g.appendChild(el('line', {
      x1: x1 + nx*4*extSign, y1: y1 + ny*4*extSign,
      x2: x1 + nx*(extLen)*extSign, y2: y1 + ny*(extLen)*extSign,
      stroke: color, 'stroke-width': 0.8, opacity: 0.6
    }));
    g.appendChild(el('line', {
      x1: x2 + nx*4*extSign, y1: y2 + ny*4*extSign,
      x2: x2 + nx*(extLen)*extSign, y2: y2 + ny*(extLen)*extSign,
      stroke: color, 'stroke-width': 0.8, opacity: 0.6
    }));

    // Maßlinie
    g.appendChild(el('line', {
      x1: ax, y1: ay, x2: bx, y2: by,
      stroke: color, 'stroke-width': 1.5,
      'marker-start': `url(#${markerId})`,
      'marker-end': `url(#${markerId})`
    }));

    // Label-Hintergrund + Text
    const mx = (ax+bx)/2, my = (ay+by)/2;
    const angle = Math.atan2(by-ay, bx-ax) * 180/Math.PI;
    const labelColor = isWarn ? '#c62828' : '#1a1814';
    const bgColor = isWarn ? '#fff3f3' : '#ffffff';

    const grp = el('g', { transform: `translate(${mx},${my}) rotate(${angle})` });

    // Weißes Rechteck hinter Text
    const txtBg = el('rect', {
      x: -22, y: -9, width: 44, height: 13,
      fill: bgColor, stroke: color, 'stroke-width': 0.6,
      rx: 2, opacity: 0.92
    });
    grp.appendChild(txtBg);

    const txt = el('text', {
      x: 0, y: 1,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 9, 'font-family': "'IBM Plex Mono', monospace",
      'font-weight': '700', fill: labelColor
    });
    txt.textContent = label;
    grp.appendChild(txt);
    g.appendChild(grp);
  }

  // ─── 1. Längenmaß ────────────────────────────────────────
  function drawLaenge(g, lls, bauLaenge) {
    const start = lls[0];
    const end = lls[lls.length - 1];
    const bear = bearing(start, end);

    // Maßlinie etwas seitlich versetzt (12px über der Linie)
    const p1 = toP(start);
    const p2 = toP(end);
    const label = bauLaenge < 100
      ? bauLaenge.toFixed(1) + 'm'
      : Math.round(bauLaenge) + 'm';

    // Versatz: 18px senkrecht zur Linienrichtung (nach links = oben auf Karte)
    drawDimLine(g, p1.x, p1.y, p2.x, p2.y, label, '#1565C0', -22, false);
  }

  // ─── 2. Restgehwegbreite ─────────────────────────────────
  function drawRestgehweg(g, lls, sf, bauBreite, restBreite) {
    const p0 = lls[0], p1 = lls[lls.length-1];
    const midLL = [p0[0]+(p1[0]-p0[0])*0.65, p0[1]+(p1[1]-p0[1])*0.65];
    const bear = bearing(p0, p1);

    const bauRand = offsetLL(midLL, bear + 90*sf, bauBreite);
    // Pfeil zeigt vom Baufeld-Rand WEG — Richtung Häuser/Privat (= -sf)
    const gwEnde  = offsetLL(bauRand, bear - 90*sf, restBreite);

    const pA = toP(bauRand);
    const pB = toP(gwEnde);
    const isWarn = restBreite < 1.30;
    const color = isWarn ? '#c62828' : '#2e7d32';

    const markerId = 'arr-gw-' + Math.random().toString(36).slice(2,6);
    arrowMarker(g.ownerSVGElement || g, markerId, color);

    // Nur Linie mit Pfeil — kein Label
    g.appendChild(el('line', {
      x1: pA.x, y1: pA.y, x2: pB.x, y2: pB.y,
      stroke: color, 'stroke-width': 1.5,
      'marker-end': `url(#${markerId})`
    }));
  }

  return { init, update, remove, render };
})();
