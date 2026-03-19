// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine v4
// SVG Overlay approach: Absperrbereich as one image
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // ─── SVG DRAWING PRIMITIVES ───
  // These generate SVG fragments for each element type
  // Coordinate system: x = across the road (width), y = along the road (length)

  const SVG = {
    // Absperrschrankengitter (red-white horizontal barrier)
    schranke(x, y, w, h) {
      const stripes = Math.ceil(w / h);
      let s = `<g transform="translate(${x},${y})">`;
      s += `<rect width="${w}" height="${h}" rx="1" fill="#fff" stroke="#333" stroke-width="0.3"/>`;
      for (let i = 0; i < stripes; i += 2) {
        const sx = i * (w / stripes);
        s += `<rect x="${sx}" width="${w/stripes}" height="${h}" fill="#e30613"/>`;
      }
      s += `</g>`;
      return s;
    },

    // Leitbake (tall narrow, diagonal red-white stripes)
    bakeLinks(x, y, w, h) {
      let s = `<g transform="translate(${x},${y})">`;
      s += `<rect width="${w}" height="${h}" rx="1" fill="#e30613" stroke="#333" stroke-width="0.3"/>`;
      // Diagonal white stripes (left-pointing: ↙)
      for (let i = -1; i < Math.ceil(h / w) + 1; i++) {
        const sy = i * w * 1.5;
        s += `<line x1="0" y1="${sy+w}" x2="${w}" y2="${sy}" stroke="#fff" stroke-width="${w*0.35}"/>`;
      }
      s += `<rect width="${w}" height="${h}" rx="1" fill="none" stroke="#333" stroke-width="0.3"/>`;
      s += `</g>`;
      return s;
    },

    bakeRechts(x, y, w, h) {
      let s = `<g transform="translate(${x},${y})">`;
      s += `<rect width="${w}" height="${h}" rx="1" fill="#e30613" stroke="#333" stroke-width="0.3"/>`;
      for (let i = -1; i < Math.ceil(h / w) + 1; i++) {
        const sy = i * w * 1.5;
        s += `<line x1="0" y1="${sy}" x2="${w}" y2="${sy+w}" stroke="#fff" stroke-width="${w*0.35}"/>`;
      }
      s += `<rect width="${w}" height="${h}" rx="1" fill="none" stroke="#333" stroke-width="0.3"/>`;
      s += `</g>`;
      return s;
    },

    // Warnleuchte (yellow circle)
    leuchte(cx, cy, r) {
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f59e0b" stroke="#333" stroke-width="0.2"/>` +
             `<circle cx="${cx}" cy="${cy}" r="${r*0.4}" fill="#fbbf24"/>`;
    },

    // Arbeitsbereich (gray fill)
    arbeitsbereich(x, y, w, h) {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d1d5db" opacity="0.5" stroke="#9ca3af" stroke-width="0.3" stroke-dasharray="2,1"/>`;
    },
  };

  // ─── REGELPLAN SVG GENERATORS ───
  // Each returns an SVG string for a given width (across road) and length (along road)
  // Units are in "plan units" where 1 unit ≈ 1 meter

  function generateBII1_SVG(width, length) {
    // B II/1: Radwegsperrung, geringe Einengung
    // Layout (cross section, work side on right):
    //   Fahrbahn | Leitbaken | Schrankengitter | Baufeld | Schrankengitter | Gehweg
    const W = width;   // total width of the Absperrbereich
    const L = length;  // total length

    const bakeW = W * 0.06;      // Leitbake width
    const schrankeH = W * 0.04;  // Schrankengitter height (thickness)
    const leuchteR = W * 0.025;  // Warnleuchte radius
    const bakeH = bakeW * 3;     // Leitbake height

    // Column positions (from left = road side to right = gehweg side)
    const colBake = W * 0.05;          // Leitbaken column
    const colSchrankeL = W * 0.20;     // Left Schrankengitter (Baufeld fahrbahnseitig)
    const colBaufeld = W * 0.35;       // Baufeld center
    const colSchrankeR = W * 0.70;     // Right Schrankengitter (zum Gehweg)
    const baufeldW = colSchrankeR - colSchrankeL;

    let svg = '';

    // Arbeitsbereich (gray zone)
    svg += SVG.arbeitsbereich(colSchrankeL, 0, baufeldW, L);

    // ── Querabsperrung OBEN ──
    // Schrankengitter quer
    svg += SVG.schranke(colSchrankeL - bakeW, 0, colSchrankeR - colSchrankeL + bakeW * 2, schrankeH * 2);
    // Leitbake oben links
    svg += SVG.bakeLinks(colBake, -bakeH * 0.3, bakeW, bakeH);
    // Warnleuchten auf Querabsperrung
    svg += SVG.leuchte(colSchrankeL + baufeldW * 0.25, schrankeH, leuchteR);
    svg += SVG.leuchte(colSchrankeL + baufeldW * 0.5, schrankeH, leuchteR);
    svg += SVG.leuchte(colSchrankeL + baufeldW * 0.75, schrankeH, leuchteR);

    // ── Längsabsperrung ──
    const spacing = Math.min(9, L * 0.8 / Math.max(1, Math.floor(L / 9)));
    const segments = Math.max(1, Math.floor(L / spacing));

    for (let i = 0; i <= segments; i++) {
      const y = i * spacing;
      if (y > L) break;

      // Leitbaken links (zur Fahrbahn)
      svg += SVG.bakeLinks(colBake, y + spacing * 0.2, bakeW, bakeH);

      // Schrankengitter links (Baufeld fahrbahnseitig)
      svg += SVG.schranke(colSchrankeL, y, baufeldW * 0.15, schrankeH);

      // Schrankengitter rechts (zum Gehweg)
      svg += SVG.schranke(colSchrankeR, y, W - colSchrankeR - W * 0.05, schrankeH);

      // Warnleuchte in der Mitte
      if (i % 2 === 0) {
        svg += SVG.leuchte(colBaufeld + baufeldW * 0.2, y + spacing * 0.5, leuchteR);
      }
    }

    // ── Querabsperrung UNTEN ──
    svg += SVG.schranke(colSchrankeL - bakeW, L - schrankeH * 2, colSchrankeR - colSchrankeL + bakeW * 2, schrankeH * 2);
    svg += SVG.bakeLinks(colBake, L - bakeH * 0.7, bakeW, bakeH);
    svg += SVG.leuchte(colSchrankeL + baufeldW * 0.25, L - schrankeH, leuchteR);
    svg += SVG.leuchte(colSchrankeL + baufeldW * 0.5, L - schrankeH, leuchteR);
    svg += SVG.leuchte(colSchrankeL + baufeldW * 0.75, L - schrankeH, leuchteR);

    return wrapSVG(svg, W, L);
  }

  function generateBII4_SVG(width, length) {
    // B II/4: Gehwegsperrung, Notweg auf Fahrbahn
    // Layout: Fahrbahn | Leitbaken diagonal | Schrankengitter | Baufeld (Gehweg) | Schrankengitter
    const W = width, L = length;
    const bakeW = W * 0.06;
    const schrankeH = W * 0.04;
    const leuchteR = W * 0.025;
    const bakeH = bakeW * 3;

    const colBake = W * 0.05;
    const colSchrankeL = W * 0.25;
    const colSchrankeR = W * 0.80;
    const baufeldW = colSchrankeR - colSchrankeL;

    let svg = '';
    svg += SVG.arbeitsbereich(colSchrankeL, 0, baufeldW, L);

    // ── Diagonal Querabsperrung OBEN (3 Leitbaken schräg) ──
    for (let i = 0; i < 3; i++) {
      const bx = colBake + i * bakeW * 1.8;
      const by = i * bakeH * 0.6;
      svg += SVG.bakeLinks(bx, by, bakeW, bakeH);
      svg += SVG.leuchte(bx + bakeW / 2, by + bakeH / 2, leuchteR);
    }
    // Schrankengitter zum Gehweg oben
    svg += SVG.schranke(colSchrankeR, 0, W - colSchrankeR - W * 0.03, schrankeH * 2);

    // ── Längsabsperrung ──
    const spacing = Math.min(9, L * 0.8 / Math.max(1, Math.floor(L / 9)));
    const segments = Math.max(1, Math.floor(L / spacing));

    for (let i = 0; i <= segments; i++) {
      const y = i * spacing;
      if (y > L) break;
      svg += SVG.bakeLinks(colBake, y + spacing * 0.2, bakeW, bakeH);
      svg += SVG.schranke(colSchrankeR, y, W - colSchrankeR - W * 0.03, schrankeH);
      if (i % 2 === 0) {
        svg += SVG.leuchte(colSchrankeL + baufeldW * 0.5, y + spacing * 0.5, leuchteR);
      }
    }

    // ── Diagonal Querabsperrung UNTEN (3 Leitbaken schräg, reversed) ──
    for (let i = 0; i < 3; i++) {
      const bx = colBake + i * bakeW * 1.8;
      const by = L - bakeH - i * bakeH * 0.6;
      svg += SVG.bakeRechts(bx, by, bakeW, bakeH);
      svg += SVG.leuchte(bx + bakeW / 2, by + bakeH / 2, leuchteR);
    }
    svg += SVG.schranke(colSchrankeR, L - schrankeH * 2, W - colSchrankeR - W * 0.03, schrankeH * 2);

    return wrapSVG(svg, W, L);
  }

  // Generic generator for B II/2, 3, 5 (similar structure to B II/1)
  function generateGenericBII_SVG(width, length) {
    return generateBII1_SVG(width, length); // Same base layout, VZ differ
  }

  function wrapSVG(content, w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${content}</svg>`;
  }

  // Map plan ID to SVG generator
  const SVG_GENERATORS = {
    'BII1': generateBII1_SVG,
    'BII2': generateGenericBII_SVG,
    'BII3': generateGenericBII_SVG,
    'BII4': generateBII4_SVG,
    'BII5': generateBII1_SVG, // Similar layout, different VZ
  };

  // ─── VZ SIGNS (individual markers before/after) ───
  const VZ_BEFORE_AFTER = {
    'BII1': { before: [{ vz: '125', offsetM: 60 }], after: [] },
    'BII2': { before: [{ vz: '125', offsetM: 60 }], after: [{ vz: '240', offsetM: 3 }] },
    'BII3': { before: [{ vz: '125', offsetM: 60 }], after: [{ vz: '125', offsetM: 60 }] },
    'BII4': { before: [{ vz: '125', offsetM: 40 }], after: [{ vz: '125', offsetM: 40 }] },
    'BII5': { before: [{ vz: '125', offsetM: 60 }], after: [{ vz: '125', offsetM: 85 }] },
  };

  // ─── PLAN METADATA ───
  const PLANS = {
    'BII1': { name: 'B II/1', title: 'Radwegsperrung, geringe Einengung', defaultWidth: 6 },
    'BII2': { name: 'B II/2', title: 'Radwegsperrung mit Umleitung', defaultWidth: 6 },
    'BII3': { name: 'B II/3', title: 'Nicht benutzungspfl. Radweg', defaultWidth: 5 },
    'BII4': { name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn', defaultWidth: 6 },
    'BII5': { name: 'B II/5', title: 'Halbseitig + Gehweg, LSA', defaultWidth: 8 },
  };

  // ─── STATE ───
  let constructionLine = null, workSide = 'right', activeRegelplan = null;
  let groups = [], isDrawingLine = false, linePreview = null, linePoints = [];

  // ─── DRAWING ───
  function startDrawLine() {
    isDrawingLine = true; linePoints = [];
    if (linePreview) { MapModule.getMap().removeLayer(linePreview); linePreview = null; }
    document.body.classList.add('mode-draw');
    UI.toast('Klicke Start + Ende der Baustelle auf der Karte');
  }

  function addLinePoint(latlng) {
    if (!isDrawingLine) return false;
    linePoints.push(latlng);
    const map = MapModule.getMap();
    if (linePreview) map.removeLayer(linePreview);
    linePreview = L.polyline(linePoints, { color: '#f97316', weight: 4, dashArray: '10,6' }).addTo(map);
    if (linePoints.length >= 2) { finishLine(); return true; }
    return true;
  }

  function onMouseMoveWhileDrawing(latlng) {
    if (!isDrawingLine || !linePoints.length) return;
    const map = MapModule.getMap();
    if (linePreview) map.removeLayer(linePreview);
    linePreview = L.polyline([...linePoints, latlng], {
      color: '#f97316', weight: 4, dashArray: '10,6', opacity: 0.7
    }).addTo(map);
  }

  function finishLine() {
    isDrawingLine = false;
    constructionLine = [...linePoints];
    document.body.classList.remove('mode-draw');
    const d = constructionLine[0].distanceTo(constructionLine[1]);
    UI.toast(`Baustellenlinie: ${d.toFixed(1)}m — Seite + Regelplan wählen`);
    const el = document.getElementById('sideSelector');
    if (el) el.style.display = 'block';
  }

  function cancelLine() {
    isDrawingLine = false; linePoints = [];
    if (linePreview) { MapModule.getMap().removeLayer(linePreview); linePreview = null; }
    document.body.classList.remove('mode-draw');
  }

  function isDrawing() { return isDrawingLine; }

  function setSide(side) {
    workSide = side;
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('on'));
    document.querySelector(`.side-btn[data-side="${side}"]`)?.classList.add('on');
  }

  // ─── GENERATE ───
  function generate(planId) {
    if (!constructionLine || constructionLine.length < 2) {
      UI.toast('Erst Baustellenlinie zeichnen!'); return;
    }
    const plan = PLANS[planId];
    const svgGen = SVG_GENERATORS[planId];
    if (!plan || !svgGen) { UI.toast('Regelplan nicht gefunden'); return; }
    activeRegelplan = planId;

    const map = MapModule.getMap();
    const p1 = constructionLine[0], p2 = constructionLine[1];
    const totalLen = p1.distanceTo(p2);
    const bearing = getBearing(p1, p2);
    const sideMul = workSide === 'right' ? 1 : -1;
    const groupId = 'rp_' + Date.now();
    const markers = [];

    // ── Generate SVG for the Absperrbereich ──
    const widthM = plan.defaultWidth;
    const svgContent = svgGen(widthM, totalLen);

    // Calculate the 4 corners of the SVG overlay on the map
    // The SVG is oriented along the bearing of the line
    // Width extends to the work side from the construction line
    const perpAngle = bearing + 90;
    const halfW = widthM / 2;

    // Offset the SVG center to the work side
    const centerOffsetM = (widthM * 0.3) * sideMul; // Shift towards work side
    const c1 = offsetPoint(p1, perpAngle, centerOffsetM - halfW * sideMul);
    const c2 = offsetPoint(p1, perpAngle, centerOffsetM + halfW * sideMul);
    const c3 = offsetPoint(p2, perpAngle, centerOffsetM + halfW * sideMul);
    const c4 = offsetPoint(p2, perpAngle, centerOffsetM - halfW * sideMul);

    // Use Leaflet's SVG overlay
    // We need a rotated image overlay — Leaflet doesn't natively support this,
    // so we use an L.svgOverlay with the bounds aligned to the line

    // Create bounds from the line (simplified: use the line as a bounding box)
    // For non-north-aligned lines, we need a different approach:
    // Use a Leaflet custom SVG overlay with CSS transform

    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Calculate bounding box
    const bounds = L.latLngBounds([c1, c2, c3, c4]);

    // For proper rotation, use a marker with a large icon
    // containing the SVG, positioned at the center, rotated to bearing
    const centerLat = (p1.lat + p2.lat) / 2;
    const centerLng = (p1.lng + p2.lng) / 2;
    const center = L.latLng(centerLat, centerLng);

    // Convert dimensions to pixels for the icon
    const lengthPx = map.distance(p1, p2) / getMetersPerPixel(map);
    const widthPx = widthM / getMetersPerPixel(map);

    const svgIcon = L.divIcon({
      html: `<div class="rp-overlay" style="
        width:${widthPx}px; height:${lengthPx}px;
        transform: rotate(${bearing - 90}deg);
        transform-origin: center center;
        pointer-events: auto;
        cursor: move;
      ">${svgContent}</div>`,
      iconSize: [widthPx, lengthPx],
      iconAnchor: [widthPx / 2, lengthPx / 2],
      className: 'rp-overlay-container',
    });

    // Place as a draggable marker at center
    const overlayMarker = L.marker(center, { icon: svgIcon, draggable: true }).addTo(map);
    overlayMarker._rp = {
      groupId, planId, widthM, lengthM: totalLen, bearing,
      p1: L.latLng(p1.lat, p1.lng), p2: L.latLng(p2.lat, p2.lng),
    };
    markers.push(overlayMarker);

    // ── Place VZ signs before/after ──
    const vzConfig = VZ_BEFORE_AFTER[planId] || { before: [], after: [] };

    vzConfig.before.forEach(cfg => {
      const pos = offsetPoint(p1, bearing + 180, cfg.offsetM);
      const posLateral = offsetPoint(pos, perpAngle, -3 * sideMul); // Road side
      const m = placeVZMarker(cfg.vz, posLateral, groupId, map);
      if (m) markers.push(m);
    });

    vzConfig.after.forEach(cfg => {
      const pos = offsetPoint(p2, bearing, cfg.offsetM);
      const posLateral = offsetPoint(pos, perpAngle, -3 * sideMul);
      const m = placeVZMarker(cfg.vz, posLateral, groupId, map);
      if (m) markers.push(m);
    });

    // Remove preview line
    if (linePreview) { map.removeLayer(linePreview); linePreview = null; }

    const group = {
      id: groupId, regelplan: planId,
      name: `${plan.name} — ${plan.title}`,
      markers, overlayMarker,
      constructionLine: [...constructionLine], workSide, bearing,
      widthM, lengthM: totalLen,
    };
    groups.push(group);

    document.getElementById('stObj').textContent = 'Objekte: ' + markers.length;
    UI.toast(`${plan.name} platziert — verschiebbar per Drag`);
    showGroupProperties(group);

    // Rescale on zoom
    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', () => rescaleOverlays());
  }

  function placeVZMarker(vzId, pos, groupId, map) {
    const entry = VZ_CATALOG.find(v => v.id === vzId);
    if (!entry) return null;
    const px = 18; // Fixed size for VZ at any zoom
    const icon = L.divIcon({
      html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="width:${px}px;height:auto" draggable="false">`,
      iconSize: [px, px], iconAnchor: [px / 2, px / 2], className: 'vz-m',
    });
    const marker = L.marker(pos, { icon, draggable: true }).addTo(map);
    marker._rp = { groupId, vzId, isVZ: true };
    return marker;
  }

  function getMetersPerPixel(map) {
    const lat = map.getCenter().lat;
    return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  }

  // ─── RESCALE SVG overlays on zoom ───
  function rescaleOverlays() {
    const map = MapModule.getMap();
    groups.forEach(g => {
      if (!g.overlayMarker || !g.overlayMarker._rp) return;
      const rp = g.overlayMarker._rp;
      const mpp = getMetersPerPixel(map);
      const lengthPx = rp.lengthM / mpp;
      const widthPx = rp.widthM / mpp;

      const svgGen = SVG_GENERATORS[rp.planId];
      if (!svgGen) return;
      const svgContent = svgGen(rp.widthM, rp.lengthM);

      const newIcon = L.divIcon({
        html: `<div class="rp-overlay" style="
          width:${widthPx}px; height:${lengthPx}px;
          transform: rotate(${rp.bearing - 90}deg);
          transform-origin: center center;
          pointer-events: auto; cursor: move;
        ">${svgContent}</div>`,
        iconSize: [widthPx, lengthPx],
        iconAnchor: [widthPx / 2, lengthPx / 2],
        className: 'rp-overlay-container',
      });
      g.overlayMarker.setIcon(newIcon);
    });
  }

  // ─── GROUP MANAGEMENT ───
  function showGroupProperties(g) {
    const el = document.getElementById('groupProps');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="pgrp-t">${g.name}</div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Breite: ${g.widthM}m | Länge: ${g.lengthM.toFixed(1)}m</div>
      <div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Absperrbereich + ${g.markers.length - 1} VZ — alles einzeln verschiebbar</div>
      <div class="prow">
        <span class="plbl">Breite</span>
        <input class="pinp" type="range" min="3" max="12" step="0.5" value="${g.widthM}" id="rpWidth"
          oninput="RegelplanEngine.setWidth(this.value)">
        <span class="pval" id="rpWidthV">${g.widthM}m</span>
      </div>
      <div class="pbtns" style="margin-top:8px">
        <button class="pbtn" onclick="RegelplanEngine.regenerate()">Neu generieren</button>
        <button class="pbtn dng" onclick="RegelplanEngine.removeGroup('${g.id}')">Löschen</button>
      </div>`;
  }

  function setWidth(w) {
    w = parseFloat(w);
    if (!groups.length) return;
    const g = groups[groups.length - 1];
    g.widthM = w;
    document.getElementById('rpWidthV').textContent = w + 'm';
    // Re-render the overlay
    const map = MapModule.getMap();
    const rp = g.overlayMarker._rp;
    rp.widthM = w;
    rescaleOverlays();
  }

  function removeGroup(id) {
    const map = MapModule.getMap();
    const i = groups.findIndex(g => g.id === id);
    if (i === -1) return;
    groups[i].markers.forEach(m => map.removeLayer(m));
    groups.splice(i, 1);
    const el = document.getElementById('groupProps');
    if (el) el.style.display = 'none';
    UI.toast('Gelöscht');
    document.getElementById('stObj').textContent = 'Objekte: ' + groups.reduce((n, g) => n + g.markers.length, 0);
  }

  function regenerate() {
    if (!activeRegelplan || !constructionLine) return;
    if (groups.length) removeGroup(groups[groups.length - 1].id);
    generate(activeRegelplan);
  }

  // ─── GEO HELPERS ───
  function getBearing(a, b) {
    const dl = (b.lng - a.lng) * Math.PI / 180;
    const la = a.lat * Math.PI / 180, lb = b.lat * Math.PI / 180;
    const y = Math.sin(dl) * Math.cos(lb);
    const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function offsetPoint(ll, deg, m) {
    const R = 6378137, d = m / R, b = deg * Math.PI / 180;
    const la = ll.lat * Math.PI / 180, lo = ll.lng * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return L.latLng(la2 * 180 / Math.PI, lo2 * 180 / Math.PI);
  }

  function interpolate(a, b, f) {
    return L.latLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f);
  }

  function setScale500() { MapModule.getMap().setZoom(20); UI.toast('Maßstab ≈ 1:500'); }

  return {
    startDrawLine, addLinePoint, onMouseMoveWhileDrawing, cancelLine, isDrawing,
    setSide, generate, regenerate, removeGroup, setWidth, setScale500,
    getGroups: () => groups,
  };
})();
