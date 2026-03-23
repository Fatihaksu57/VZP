// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine (SVG Edition)
// Uses original SVG elements from PowerPoint
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // SVG element paths (from PPTX)
  const S = {
    bakeL:       'assets/svg/bake_links_leuchte.svg',
    bakeR:       'assets/svg/bake_rechts_leuchte.svg',
    bakeL_plain: 'assets/svg/bake_links.svg',
    bakeR_plain: 'assets/svg/bake_rechts.svg',
    schranke:    'assets/svg/schranke_leuchte_v2.svg',
    schrankeP:   'assets/svg/schranke.svg',
  };

  // Plan configs
  const PLANS = {
    'BII1': { name: 'B II/1', title: 'Radwegsperrung, geringe Einengung', widthM: 5,
      vzBefore: [{ vz: '125', offsetM: 60 }], vzAfter: [] },
    'BII2': { name: 'B II/2', title: 'Radwegsperrung mit Umleitung', widthM: 5.5,
      vzBefore: [{ vz: '125', offsetM: 60 }], vzAfter: [{ vz: '240', offsetM: 3 }] },
    'BII3': { name: 'B II/3', title: 'Nicht benutzungspfl. Radweg', widthM: 5,
      vzBefore: [{ vz: '125', offsetM: 60 }], vzAfter: [{ vz: '125', offsetM: 60 }] },
    'BII4': { name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn', widthM: 6, diagonal: true,
      vzBefore: [{ vz: '125', offsetM: 40 }], vzAfter: [{ vz: '125', offsetM: 40 }] },
    'BII5': { name: 'B II/5', title: 'Halbseitig + Gehweg, LSA', widthM: 6,
      vzBefore: [{ vz: '125', offsetM: 60 }], vzAfter: [{ vz: '125', offsetM: 85 }] },
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
    linePreview = L.polyline([...linePoints, latlng], { color: '#f97316', weight: 4, dashArray: '10,6', opacity: 0.7 }).addTo(map);
  }
  function finishLine() {
    isDrawingLine = false;
    constructionLine = [...linePoints];
    document.body.classList.remove('mode-draw');
    UI.toast(`${constructionLine[0].distanceTo(constructionLine[1]).toFixed(1)}m — Seite + Regelplan wählen`);
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

  function getMPP(map) {
    return 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  }

  // ─── BUILD ABSPERRBEREICH HTML ───
  // Returns HTML string with absolutely positioned SVG images
  // w = width in px, h = height in px
  function buildBarrierHTML(planId, w, h) {
    const plan = PLANS[planId];

    // Element sizes relative to width
    const bakeW = Math.round(w * 0.18);
    const bakeH = Math.round(bakeW * 2.7);
    const schrankeW = w;
    const schrankeH = Math.round(w * 0.08);
    const bfW = Math.round(w * 0.42);
    const svW = Math.round(w * 0.12);

    // Column positions
    const xBake = 0;
    const xSL = bakeW + 2;                    // Schrankengitter links
    const xBF = xSL + svW;                    // Baufeld
    const xSR = xBF + bfW;                    // Schrankengitter rechts
    const capH = Math.round(bakeH * 1.2);     // Height of top/bottom cap

    let html = '';

    // Baufeld (gray background)
    html += `<div style="position:absolute;left:${xBF}px;top:${capH}px;width:${bfW}px;height:${h - capH * 2}px;background:rgba(195,195,195,0.45);"></div>`;

    if (plan.diagonal) {
      // ── B II/4: Diagonal Querabsperrung ──

      // TOP: 3 diagonal bakes + schranke
      for (let i = 0; i < 3; i++) {
        const bx = xBake + i * (bakeW + 2);
        const by = 2 + i * Math.round(bakeH * 0.5);
        html += svgImg(S.bakeL, bx, by, bakeW, bakeH);
      }
      html += svgImg(S.schranke, xSR, 2, w - xSR, schrankeH);

      // MIDDLE: repeated segments
      const segH = Math.round(bakeH * 1.4);
      const startY = capH;
      const endY = h - capH;
      for (let y = startY; y < endY; y += segH) {
        html += svgImg(S.bakeL, xBake, y, bakeW, bakeH);
        const sH = Math.min(segH - 4, h - capH * 2);
        html += svgImg(S.schrankeP, xSR, y, svW, sH);
      }

      // BOTTOM: 3 diagonal bakes reversed + schranke
      for (let i = 0; i < 3; i++) {
        const bx = xBake + i * (bakeW + 2);
        const by = h - bakeH - 2 - i * Math.round(bakeH * 0.5);
        html += svgImg(S.bakeR, bx, by, bakeW, bakeH);
      }
      html += svgImg(S.schranke, xSR, h - schrankeH - 2, w - xSR, schrankeH);

    } else {
      // ── Standard B II/1,2,3,5 layout ──

      // TOP: Querabsperrung
      html += svgImg(S.schranke, xSL, 2, xSR - xSL + svW, schrankeH);
      html += svgImg(S.bakeL, xBake, 0, bakeW, bakeH);

      // MIDDLE: repeated segments
      const segH = Math.round(bakeH * 1.4);
      const startY = capH;
      const endY = h - capH;
      for (let y = startY; y < endY; y += segH) {
        html += svgImg(S.bakeL, xBake, y, bakeW, bakeH);
        const sH = Math.min(segH - 4, h);
        html += svgImg(S.schrankeP, xSL, y, svW, sH);
        html += svgImg(S.schrankeP, xSR, y, svW, sH);
      }

      // BOTTOM: Querabsperrung
      html += svgImg(S.schranke, xSL, h - schrankeH - 2, xSR - xSL + svW, schrankeH);
      html += svgImg(S.bakeL, xBake, h - bakeH, bakeW, bakeH);
    }

    return html;
  }

  function svgImg(src, x, y, w, h) {
    return `<img src="${src}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;" draggable="false">`;
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

    const metersPerPx = getMPP(map);
    const lengthPx = Math.max(40, Math.round(lengthM / metersPerPx));
    const widthPx = Math.max(20, Math.round(widthM / metersPerPx));

    // Build barrier HTML
    const barrierHTML = buildBarrierHTML(planId, widthPx, lengthPx);

    // Position on map
    const midLat = (p1.lat + p2.lat) / 2;
    const midLng = (p1.lng + p2.lng) / 2;
    const perpAngle = bearing + 90;
    const center = offsetPoint(L.latLng(midLat, midLng), perpAngle, (widthM * 0.3) * sideMul);

    const diagPx = Math.ceil(Math.sqrt(lengthPx * lengthPx + widthPx * widthPx));
    const flipStyle = workSide === 'left' ? 'scaleX(-1)' : '';

    const icon = L.divIcon({
      className: '',
      iconSize: [diagPx, diagPx],
      iconAnchor: [diagPx / 2, diagPx / 2],
      html: `<div style="
        position:absolute;
        left:${(diagPx - widthPx) / 2}px;
        top:${(diagPx - lengthPx) / 2}px;
        width:${widthPx}px;
        height:${lengthPx}px;
        transform:rotate(${bearing}deg) ${flipStyle};
        transform-origin:center center;
        pointer-events:auto;cursor:move;
      ">${barrierHTML}</div>`,
    });

    const overlayMarker = L.marker(center, { icon, draggable: true, zIndexOffset: -100 }).addTo(map);
    overlayMarker._rp = { groupId, planId, widthM, lengthM, bearing };
    layers.push(overlayMarker);

    // VZ signs
    plan.vzBefore.forEach(cfg => {
      const pos = offsetPoint(p1, bearing + 180, cfg.offsetM);
      const m = placeVZ(cfg.vz, offsetPoint(pos, perpAngle, -3 * sideMul), map);
      if (m) layers.push(m);
    });
    plan.vzAfter.forEach(cfg => {
      const pos = offsetPoint(p2, bearing, cfg.offsetM);
      const m = placeVZ(cfg.vz, offsetPoint(pos, perpAngle, -3 * sideMul), map);
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
    UI.toast(`${plan.name} platziert`);
    showGroupProperties(group);

    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', () => rescaleAll());
  }

  function placeVZ(vzId, pos, map) {
    const entry = VZ_CATALOG.find(v => v.id === vzId);
    if (!entry) return null;
    return L.marker(pos, {
      icon: L.divIcon({
        className: 'vz-m',
        html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="width:18px;height:auto" draggable="false">`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      }),
      draggable: true,
    }).addTo(map);
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

      const lengthPx = Math.max(40, Math.round(rp.lengthM / metersPerPx));
      const widthPx = Math.max(20, Math.round(g.widthM / metersPerPx));
      const barrierHTML = buildBarrierHTML(rp.planId, widthPx, lengthPx);
      const diagPx = Math.ceil(Math.sqrt(lengthPx * lengthPx + widthPx * widthPx));
      const flipStyle = g.workSide === 'left' ? 'scaleX(-1)' : '';

      g.overlayMarker.setIcon(L.divIcon({
        className: '',
        iconSize: [diagPx, diagPx],
        iconAnchor: [diagPx / 2, diagPx / 2],
        html: `<div style="
          position:absolute;
          left:${(diagPx - widthPx) / 2}px;
          top:${(diagPx - lengthPx) / 2}px;
          width:${widthPx}px;
          height:${lengthPx}px;
          transform:rotate(${rp.bearing}deg) ${flipStyle};
          transform-origin:center center;
          pointer-events:auto;cursor:move;
        ">${barrierHTML}</div>`,
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
      <div style="font-size:11px;color:var(--tx2);margin-bottom:8px">${g.lengthM.toFixed(1)}m × ${g.widthM}m</div>
      <div class="prow"><span class="plbl">Breite</span>
        <input class="pinp" type="range" min="3" max="12" step="0.5" value="${g.widthM}"
          oninput="RegelplanEngine.setWidth(this.value);document.getElementById('rpWV').textContent=this.value+'m'">
        <span class="pval" id="rpWV">${g.widthM}m</span></div>
      <div class="pbtns" style="margin-top:8px">
        <button class="pbtn" onclick="RegelplanEngine.regenerate()">Neu</button>
        <button class="pbtn dng" onclick="RegelplanEngine.removeGroup('${g.id}')">Löschen</button></div>`;
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
    document.getElementById('groupProps').style.display = 'none';
    UI.toast('Gelöscht');
    document.getElementById('stObj').textContent = 'Objekte: ' + groups.reduce((n, g) => n + g.layers.length, 0);
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
    return (Math.atan2(Math.sin(dl) * Math.cos(lb),
      Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl)
    ) * 180 / Math.PI + 360) % 360;
  }
  function offsetPoint(ll, deg, m) {
    const R = 6378137, d = m / R, b = deg * Math.PI / 180;
    const la = ll.lat * Math.PI / 180, lo = ll.lng * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return L.latLng(la2 * 180 / Math.PI, lo2 * 180 / Math.PI);
  }
  function setScale500() { MapModule.getMap().setZoom(20); UI.toast('Maßstab ≈ 1:500'); }

  return {
    startDrawLine, addLinePoint, onMouseMoveWhileDrawing, cancelLine, isDrawing,
    setSide, generate, regenerate, removeGroup, setWidth, setScale500,
    getGroups: () => groups,
  };
})();
