// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine v5
// Image overlay: RSA 21 diagrams placed on map
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // ─── PLAN CONFIG ───
  const PLANS = {
    'BII1': {
      name: 'B II/1', title: 'Radwegsperrung, geringe Einengung',
      image: 'assets/rp_BII1.png',
      widthM: 5,
      aspectRatio: 121/800,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [],
    },
    'BII2': {
      name: 'B II/2', title: 'Radwegsperrung mit Umleitung',
      image: 'assets/rp_BII2.png',
      widthM: 5.5,
      aspectRatio: 121/850,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '240', offsetM: 3 }],
    },
    'BII3': {
      name: 'B II/3', title: 'Nicht benutzungspfl. Radweg',
      image: 'assets/rp_BII3.png',
      widthM: 5,
      aspectRatio: 121/750,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '125', offsetM: 60 }],
    },
    'BII4': {
      name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn',
      image: 'assets/rp_BII4.png',
      widthM: 6,
      aspectRatio: 107/900,
      vzBefore: [{ vz: '125', offsetM: 40 }],
      vzAfter: [{ vz: '125', offsetM: 40 }],
    },
    'BII5': {
      name: 'B II/5', title: 'Halbseitig + Gehweg, LSA',
      image: 'assets/rp_BII5.png',
      widthM: 6,
      aspectRatio: 121/900,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '125', offsetM: 85 }],
    },
  };

  // ─── STATE ───
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

  // ─── METERS TO PIXELS ───
  function mpp() {
    const map = MapModule.getMap();
    return 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
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

    // ── Image overlay for the barrier zone ──
    const widthM = plan.widthM;
    const metersPerPx = mpp();
    const lengthPx = Math.max(20, Math.round(lengthM / metersPerPx));
    const widthPx = Math.max(10, Math.round(widthM / metersPerPx));

    // Center of the image: midpoint of line, offset to work side
    const midLat = (p1.lat + p2.lat) / 2;
    const midLng = (p1.lng + p2.lng) / 2;
    const mid = L.latLng(midLat, midLng);
    const centerOffset = (widthM * 0.3) * sideMul;
    const center = offsetPoint(mid, bearing + 90, centerOffset);

    // The image is drawn vertically (top = start of construction, bottom = end).
    // On screen, "up" is north. CSS rotate(0) keeps the image vertical.
    // bearing = 0° means line goes north (image already correct).
    // bearing = 90° means line goes east → rotate image 90° clockwise.
    const cssDeg = bearing;

    // Flip image if work side is left
    const flipX = workSide === 'left' ? 'scaleX(-1)' : '';

    // Use a wrapper div to ensure proper sizing
    const overlayIcon = L.divIcon({
      html: `<div style="width:${widthPx}px;height:${lengthPx}px;transform:rotate(${cssDeg}deg) ${flipX};transform-origin:center center;">
        <img src="${plan.image}" style="width:100%;height:100%;display:block;object-fit:fill;" draggable="false" onerror="this.style.border='2px solid red';this.alt='Bild nicht gefunden: ${plan.image}'">
      </div>`,
      iconSize: [Math.max(widthPx, lengthPx), Math.max(widthPx, lengthPx)],
      iconAnchor: [Math.max(widthPx, lengthPx) / 2, Math.max(widthPx, lengthPx) / 2],
      className: 'rp-overlay-container',
    });

    const overlayMarker = L.marker(center, { icon: overlayIcon, draggable: true }).addTo(map);
    overlayMarker._rp = { groupId, planId, widthM, lengthM, bearing, center };
    layers.push(overlayMarker);

    // ── VZ signs before/after ──
    const perpAngle = bearing + 90;

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

    // Clean up preview
    if (linePreview) { map.removeLayer(linePreview); linePreview = null; }

    const group = {
      id: groupId, regelplan: planId, name: `${plan.name} — ${plan.title}`,
      layers, overlayMarker, constructionLine: [...constructionLine],
      workSide, bearing, widthM, lengthM,
    };
    groups.push(group);

    document.getElementById('stObj').textContent = 'Objekte: ' + layers.length;
    UI.toast(`${plan.name} platziert`);
    showGroupProperties(group);

    // Rescale on zoom
    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', rescaleAll);
  }

  function placeVZ(vzId, pos, map) {
    const entry = VZ_CATALOG.find(v => v.id === vzId);
    if (!entry) return null;
    const icon = L.divIcon({
      html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="width:18px;height:auto" draggable="false">`,
      iconSize: [18, 18], iconAnchor: [9, 9], className: 'vz-m',
    });
    return L.marker(pos, { icon, draggable: true }).addTo(map);
  }

  // ─── RESCALE ───
  function rescaleAll() {
    groups.forEach(g => {
      if (!g.overlayMarker?._rp) return;
      const rp = g.overlayMarker._rp;
      const plan = PLANS[rp.planId];
      if (!plan) return;

      const lengthPx = Math.max(20, Math.round(rp.lengthM / mpp()));
      const widthPx = Math.max(10, Math.round(rp.widthM / mpp()));
      const flipX = g.workSide === 'left' ? 'scaleX(-1)' : '';

      g.overlayMarker.setIcon(L.divIcon({
        html: `<div style="width:${widthPx}px;height:${lengthPx}px;transform:rotate(${rp.bearing}deg) ${flipX};transform-origin:center center;">
          <img src="${plan.image}" style="width:100%;height:100%;display:block;object-fit:fill;" draggable="false">
        </div>`,
        iconSize: [Math.max(widthPx, lengthPx), Math.max(widthPx, lengthPx)],
        iconAnchor: [Math.max(widthPx, lengthPx) / 2, Math.max(widthPx, lengthPx) / 2],
        className: 'rp-overlay-container',
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
        ${g.lengthM.toFixed(1)}m lang, ${g.widthM}m breit — verschiebbar per Drag
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
