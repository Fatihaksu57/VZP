// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine (Final)
// 3-part image: top cap + repeating middle + bottom cap
// Symbols never distort when resizing
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // Each plan image has 3 zones:
  //   - Top cap (Querabsperrung oben): fixed height, not stretched
  //   - Middle (Längsabsperrung): repeating tile, stretched vertically
  //   - Bottom cap (Querabsperrung unten): fixed height, not stretched
  //
  // The engine composites these on a canvas at render time.
  // This means length changes = more/fewer middle tiles (no symbol distortion).

  const PLANS = {
    'BII1': {
      name: 'B II/1', title: 'Radwegsperrung, geringe Einengung',
      widthM: 5,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [],
    },
    'BII2': {
      name: 'B II/2', title: 'Radwegsperrung mit Umleitung',
      widthM: 5.5,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '240', offsetM: 3 }],
    },
    'BII3': {
      name: 'B II/3', title: 'Nicht benutzungspfl. Radweg',
      widthM: 5,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '125', offsetM: 60 }],
    },
    'BII4': {
      name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn',
      widthM: 6,
      vzBefore: [{ vz: '125', offsetM: 40 }],
      vzAfter: [{ vz: '125', offsetM: 40 }],
    },
    'BII5': {
      name: 'B II/5', title: 'Halbseitig + Gehweg, LSA',
      widthM: 6,
      vzBefore: [{ vz: '125', offsetM: 60 }],
      vzAfter: [{ vz: '125', offsetM: 85 }],
    },
  };

  // Pre-loaded image parts (loaded on first use)
  let imageParts = {}; // planId -> { top: Image, mid: Image, bot: Image }
  let imagesLoaded = false;

  // Load the 3-part images for each plan
  function loadImages() {
    return new Promise(resolve => {
      const plans = Object.keys(PLANS);
      let remaining = plans.length * 3;
      const done = () => { remaining--; if (remaining <= 0) { imagesLoaded = true; resolve(); } };

      plans.forEach(id => {
        imageParts[id] = { top: new Image(), mid: new Image(), bot: new Image() };
        imageParts[id].top.onload = done; imageParts[id].top.onerror = done;
        imageParts[id].mid.onload = done; imageParts[id].mid.onerror = done;
        imageParts[id].bot.onload = done; imageParts[id].bot.onerror = done;
        imageParts[id].top.src = `assets/rp_${id}_top.png`;
        imageParts[id].mid.src = `assets/rp_${id}_mid.png`;
        imageParts[id].bot.src = `assets/rp_${id}_bot.png`;
      });
    });
  }

  // Render a plan to a canvas data URL
  function renderPlan(planId, targetHeight) {
    const parts = imageParts[planId];
    if (!parts || !parts.top.naturalWidth) return null;

    const topH = parts.top.naturalHeight;
    const midH = parts.mid.naturalHeight;
    const botH = parts.bot.naturalHeight;
    const w = parts.top.naturalWidth; // All parts same width

    // Calculate how many mid tiles we need
    const availableH = Math.max(0, targetHeight - topH - botH);
    const numTiles = Math.max(1, Math.ceil(availableH / midH));
    const totalH = topH + numTiles * midH + botH;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    // Draw top cap
    ctx.drawImage(parts.top, 0, 0);

    // Draw repeated middle tiles
    for (let i = 0; i < numTiles; i++) {
      ctx.drawImage(parts.mid, 0, topH + i * midH);
    }

    // Draw bottom cap
    ctx.drawImage(parts.bot, 0, topH + numTiles * midH);

    return { dataUrl: canvas.toDataURL('image/png'), width: w, height: totalH };
  }

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

  function getMPP(map) {
    return 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  }

  // ─── GENERATE ───
  async function generate(planId) {
    if (!constructionLine || constructionLine.length < 2) {
      UI.toast('Erst Baustellenlinie zeichnen!'); return;
    }
    const plan = PLANS[planId];
    if (!plan) { UI.toast('Regelplan nicht gefunden'); return; }

    // Load images if not yet loaded
    if (!imagesLoaded) {
      UI.toast('Lade Regelplan-Bilder…');
      await loadImages();
    }

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
    const lengthPx = Math.max(30, Math.round(lengthM / metersPerPx));
    const widthPx = Math.max(15, Math.round(widthM / metersPerPx));

    // Render the composite image
    const rendered = renderPlan(planId, lengthPx);
    const imgSrc = rendered ? rendered.dataUrl : `assets/rp_${planId}.png`;
    const imgW = rendered ? rendered.width : 100;
    const imgH = rendered ? rendered.height : 400;

    // Scale rendered image to match the pixel dimensions we need
    // Width of rendered image should map to widthPx on screen
    const scaleX = widthPx / imgW;
    const displayW = widthPx;
    const displayH = Math.round(imgH * scaleX);

    // Position: center of line, offset to work side
    const midLat = (p1.lat + p2.lat) / 2;
    const midLng = (p1.lng + p2.lng) / 2;
    const perpAngle = bearing + 90;
    const center = offsetPoint(L.latLng(midLat, midLng), perpAngle, (widthM * 0.3) * sideMul);

    const diagPx = Math.ceil(Math.sqrt(displayW * displayW + displayH * displayH));
    const flipStyle = workSide === 'left' ? 'scaleX(-1)' : '';

    const icon = L.divIcon({
      className: '',
      iconSize: [diagPx, diagPx],
      iconAnchor: [diagPx / 2, diagPx / 2],
      html: `<div style="
        position:absolute;
        left:${(diagPx - displayW) / 2}px;
        top:${(diagPx - displayH) / 2}px;
        width:${displayW}px;
        height:${displayH}px;
        transform:rotate(${bearing}deg) ${flipStyle};
        transform-origin:center center;
        pointer-events:auto; cursor:move;
      "><img src="${imgSrc}" style="width:100%;height:100%;display:block;" draggable="false"></div>`,
    });

    const overlayMarker = L.marker(center, { icon, draggable: true, zIndexOffset: -100 }).addTo(map);
    overlayMarker._rp = { groupId, planId, widthM, lengthM, bearing };
    layers.push(overlayMarker);

    // VZ signs
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
    UI.toast(`${plan.name} platziert`);
    showGroupProperties(group);

    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', () => rescaleAll());
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

  // ─── RESCALE ───
  function rescaleAll() {
    const map = MapModule.getMap();
    const metersPerPx = getMPP(map);

    groups.forEach(g => {
      if (!g.overlayMarker?._rp) return;
      const rp = g.overlayMarker._rp;
      const plan = PLANS[rp.planId];
      if (!plan) return;

      const lengthPx = Math.max(30, Math.round(rp.lengthM / metersPerPx));
      const widthPx = Math.max(15, Math.round(g.widthM / metersPerPx));

      const rendered = renderPlan(rp.planId, lengthPx);
      const imgSrc = rendered ? rendered.dataUrl : `assets/rp_${rp.planId}.png`;
      const imgW = rendered ? rendered.width : 100;
      const imgH = rendered ? rendered.height : 400;

      const scaleX = widthPx / imgW;
      const displayW = widthPx;
      const displayH = Math.round(imgH * scaleX);
      const diagPx = Math.ceil(Math.sqrt(displayW * displayW + displayH * displayH));
      const flipStyle = g.workSide === 'left' ? 'scaleX(-1)' : '';

      g.overlayMarker.setIcon(L.divIcon({
        className: '',
        iconSize: [diagPx, diagPx],
        iconAnchor: [diagPx / 2, diagPx / 2],
        html: `<div style="
          position:absolute;
          left:${(diagPx - displayW) / 2}px;
          top:${(diagPx - displayH) / 2}px;
          width:${displayW}px;
          height:${displayH}px;
          transform:rotate(${rp.bearing}deg) ${flipStyle};
          transform-origin:center center;
          pointer-events:auto; cursor:move;
        "><img src="${imgSrc}" style="width:100%;height:100%;display:block;" draggable="false"></div>`,
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
        ${g.lengthM.toFixed(1)}m × ${g.widthM}m
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
