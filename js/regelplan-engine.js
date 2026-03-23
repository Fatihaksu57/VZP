// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine
// Uses L.imageOverlay for barrier zone images
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  const PLANS = {
    'BII1': {
      name: 'B II/1', title: 'Radwegsperrung, geringe Einengung',
      image: 'assets/rp_BII1.png',
      widthM: 5,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [],
    },
    'BII2': {
      name: 'B II/2', title: 'Radwegsperrung mit Umleitung',
      image: 'assets/rp_BII2.png',
      widthM: 5.5,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '240', offsetM: 3 }],
    },
    'BII3': {
      name: 'B II/3', title: 'Nicht benutzungspfl. Radweg',
      image: 'assets/rp_BII3.png',
      widthM: 5,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '125', offsetM: 60 }],
    },
    'BII4': {
      name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn',
      image: 'assets/rp_BII4.png',
      widthM: 6,
      vzBefore: [{ vz: '125', offsetM: 40 }],
      vzAfter: [{ vz: '125', offsetM: 40 }],
    },
    'BII5': {
      name: 'B II/5', title: 'Halbseitig + Gehweg, LSA',
      image: 'assets/rp_BII5.png',
      widthM: 6,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '125', offsetM: 85 }],
    },
  };

  let constructionLine = null, workSide = 'right', activeRegelplan = null;
  let groups = [], isDrawingLine = false, linePreview = null, linePoints = [];

  // ─── DRAWING ───
  function startDrawLine() {
    isDrawingLine = true; linePoints = [];
    if (linePreview) { MapModule.getMap().removeLayer(linePreview); linePreview = null; }
    document.body.classList.add('mode-draw');
    UI.toast('Klicke Start + Ende der Baustelle');
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
    UI.toast(`${d.toFixed(1)}m — Seite + Regelplan wählen`);
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
    if (!plan) { UI.toast('Regelplan nicht gefunden'); return; }
    activeRegelplan = planId;

    const map = MapModule.getMap();
    const p1 = constructionLine[0], p2 = constructionLine[1];
    const lengthM = p1.distanceTo(p2);
    const bearing = getBearing(p1, p2);
    const sideMul = workSide === 'right' ? 1 : -1;
    const groupId = 'rp_' + Date.now();
    const layers = [];

    const widthM = plan.widthM;

    // Calculate the 4 corners of the image overlay
    // The image is vertical: top=start, bottom=end
    // Width extends to the work side
    const perpAngle = bearing + 90;

    // Offset from the construction line to the work side
    const offsetCenter = widthM * 0.5 * sideMul;

    // 4 corners: startLeft, startRight, endRight, endLeft
    // "Left" = road side (negative lateral), "Right" = work side (positive lateral)
    const startRoad = offsetPoint(p1, perpAngle, offsetCenter - widthM * sideMul);
    const startWork = offsetPoint(p1, perpAngle, offsetCenter);
    const endRoad = offsetPoint(p2, perpAngle, offsetCenter - widthM * sideMul);
    const endWork = offsetPoint(p2, perpAngle, offsetCenter);

    // L.imageOverlay needs axis-aligned bounds, but our image may be rotated.
    // For non-north-aligned lines, we need a different approach.
    // 
    // Solution: Use a Leaflet custom pane with a positioned+rotated <img> element.
    // We place a regular marker at the center, but use a HUGE iconSize and overflow:visible.

    const midLat = (p1.lat + p2.lat) / 2;
    const midLng = (p1.lng + p2.lng) / 2;
    const center = offsetPoint(L.latLng(midLat, midLng), perpAngle, offsetCenter * 0.5);

    // Convert real-world meters to screen pixels
    const metersPerPx = getMPP(map);
    const lengthPx = Math.round(lengthM / metersPerPx);
    const widthPx = Math.round(widthM / metersPerPx);

    // The trick: make iconSize very large (diagonal of the rotated rect)
    // so Leaflet doesn't clip the rotated image
    const diagPx = Math.ceil(Math.sqrt(lengthPx * lengthPx + widthPx * widthPx));

    const flipStyle = workSide === 'left' ? 'scaleX(-1)' : '';

    const icon = L.divIcon({
      className: '',  // No default leaflet styles
      iconSize: [diagPx, diagPx],
      iconAnchor: [diagPx / 2, diagPx / 2],
      html: `<div style="
        position: absolute;
        left: ${(diagPx - widthPx) / 2}px;
        top: ${(diagPx - lengthPx) / 2}px;
        width: ${widthPx}px;
        height: ${lengthPx}px;
        transform: rotate(${bearing}deg) ${flipStyle};
        transform-origin: center center;
        pointer-events: auto;
        cursor: move;
      "><img src="${plan.image}" style="
        width: 100%;
        height: 100%;
        display: block;
      " draggable="false"></div>`,
    });

    const overlayMarker = L.marker(center, { icon, draggable: true, zIndexOffset: -100 }).addTo(map);
    overlayMarker._rp = { groupId, planId, widthM, lengthM, bearing, center };
    layers.push(overlayMarker);

    // ── VZ signs before/after as individual markers ──
    plan.vzBefore.forEach(cfg => {
      const pos = offsetPoint(p1, bearing + 180, cfg.offsetM);
      const posL = offsetPoint(pos, perpAngle, -3 * sideMul);
      const m = placeVZ(cfg.vz, posL, map);
      if (m) layers.push(m);
    });

    plan.vzAfter.forEach(cfg => {
      const pos = offsetPoint(p2, bearing, cfg.offsetM);
      const posL = offsetPoint(pos, perpAngle, -3 * sideMul);
      const m = placeVZ(cfg.vz, posL, map);
      if (m) layers.push(m);
    });

    if (linePreview) { map.removeLayer(linePreview); linePreview = null; }

    const group = {
      id: groupId, regelplan: planId, name: `${plan.name} — ${plan.title}`,
      layers, overlayMarker, constructionLine: [...constructionLine],
      workSide, bearing, widthM, lengthM,
    };
    groups.push(group);

    document.getElementById('stObj').textContent = 'Objekte: ' + layers.length;
    UI.toast(`${plan.name} platziert — verschiebbar per Drag`);
    showGroupProperties(group);

    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', rescaleAll);
  }

  function placeVZ(vzId, pos, map) {
    const entry = VZ_CATALOG.find(v => v.id === vzId);
    if (!entry) return null;
    const icon = L.divIcon({
      className: 'vz-m',
      html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="width:18px;height:auto" draggable="false">`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    return L.marker(pos, { icon, draggable: true }).addTo(map);
  }

  function getMPP(map) {
    return 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  }

  // ─── RESCALE ───
  function rescaleAll() {
    const map = MapModule.getMap();
    const metersPerPx = getMPP(map);

    groups.forEach(g => {
      if (!g.overlayMarker?._rp) return;
      const rp = g.overlayMarker._rp;
      const plan = PLANS[rp.planId];
      if (!plan) return;

      const lengthPx = Math.round(rp.lengthM / metersPerPx);
      const widthPx = Math.round(rp.widthM / metersPerPx);
      const diagPx = Math.ceil(Math.sqrt(lengthPx * lengthPx + widthPx * widthPx));
      const flipStyle = g.workSide === 'left' ? 'scaleX(-1)' : '';

      g.overlayMarker.setIcon(L.divIcon({
        className: '',
        iconSize: [diagPx, diagPx],
        iconAnchor: [diagPx / 2, diagPx / 2],
        html: `<div style="
          position: absolute;
          left: ${(diagPx - widthPx) / 2}px;
          top: ${(diagPx - lengthPx) / 2}px;
          width: ${widthPx}px;
          height: ${lengthPx}px;
          transform: rotate(${rp.bearing}deg) ${flipStyle};
          transform-origin: center center;
          pointer-events: auto;
          cursor: move;
        "><img src="${plan.image}" style="
          width: 100%;
          height: 100%;
          display: block;
        " draggable="false"></div>`,
      }));
    });
  }

  // ─── GROUP MANAGEMENT ───
  function showGroupProperties(g) {
    const el = document.getElementById('groupProps');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="pgrp-t">${g.name}</div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:8px">
        ${g.lengthM.toFixed(1)}m × ${g.widthM}m — verschiebbar
      </div>
      <div class="prow">
        <span class="plbl">Breite</span>
        <input class="pinp" type="range" min="3" max="12" step="0.5" value="${g.widthM}"
          oninput="RegelplanEngine.setWidth(this.value);document.getElementById('rpWV').textContent=this.value+'m'">
        <span class="pval" id="rpWV">${g.widthM}m</span>
      </div>
      <div class="pbtns" style="margin-top:8px">
        <button class="pbtn" onclick="RegelplanEngine.regenerate()">Neu</button>
        <button class="pbtn dng" onclick="RegelplanEngine.removeGroup('${g.id}')">Löschen</button>
      </div>`;
  }

  function setWidth(w) {
    w = parseFloat(w);
    if (!groups.length) return;
    const g = groups[groups.length - 1];
    g.widthM = w;
    g.overlayMarker._rp.widthM = w;
    rescaleAll();
  }

  function removeGroup(id) {
    const map = MapModule.getMap();
    const i = groups.findIndex(g => g.id === id);
    if (i === -1) return;
    groups[i].layers.forEach(l => map.removeLayer(l));
    groups.splice(i, 1);
    const el = document.getElementById('groupProps');
    if (el) el.style.display = 'none';
    UI.toast('Gelöscht');
    document.getElementById('stObj').textContent = 'Objekte: ' +
      groups.reduce((n, g) => n + g.layers.length, 0);
  }

  function regenerate() {
    if (!activeRegelplan || !constructionLine) return;
    if (groups.length) removeGroup(groups[groups.length - 1].id);
    generate(activeRegelplan);
  }

  // ─── GEO ───
  function getBearing(a, b) {
    const dl = (b.lng - a.lng) * Math.PI / 180;
    const la = a.lat * Math.PI / 180, lb = b.lat * Math.PI / 180;
    return (Math.atan2(
      Math.sin(dl) * Math.cos(lb),
      Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl)
    ) * 180 / Math.PI + 360) % 360;
  }

  function offsetPoint(ll, deg, m) {
    const R = 6378137, d = m / R, b = deg * Math.PI / 180;
    const la = ll.lat * Math.PI / 180, lo = ll.lng * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la),
      Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return L.latLng(la2 * 180 / Math.PI, lo2 * 180 / Math.PI);
  }

  function setScale500() { MapModule.getMap().setZoom(20); UI.toast('Maßstab ≈ 1:500'); }

  return {
    startDrawLine, addLinePoint, onMouseMoveWhileDrawing, cancelLine, isDrawing,
    setSide, generate, regenerate, removeGroup, setWidth, setScale500,
    getGroups: () => groups,
  };
})();
