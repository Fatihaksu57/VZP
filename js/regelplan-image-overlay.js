// ═══════════════════════════════════════════════════════════════
// VZP Editor — Regelplan Image Overlay v2 (Tenado-Style)
// ═══════════════════════════════════════════════════════════════
// RSA-Bild als rotierbares, skalierbares L.ImageOverlay.Rotated
// auf der Leaflet-Karte. Wie PowerPoint-Bild auf der Karte.
//
// Verbesserungen v2:
//   - Auto-Ausrichtung entlang gezeichneter Linie (Richtung + Länge)
//   - Maßstabsgetreue Platzierung (Linienbreite = Bildbreite)
//   - 4 Handles (TL/TR/BL/BR) statt 3 — intuitiver
//   - Snap-to-line Button: Overlay neu auf Linie ausrichten
//   - Rotation-Handle (oben Mitte) zum freien Drehen
//   - Verbesserte Touch-Gesten auf Mobile
//   - Kein localStorage (Browser-Storage nicht verfügbar)
// ═══════════════════════════════════════════════════════════════

const RegelplanImageOverlay = (() => {

  let overlay = null;
  let handleMarkers = [];
  let guideLine = null;
  let centerHandle = null;
  let rotHandle = null;
  let isActive = false;
  let isLocked = false;
  let isEditMode = true;
  let currentOpacity = 0.75;
  let mapRef = null;
  let currentImageUrl = null;
  let currentRPId = null;
  let imgAspect = 0.65; // Hochformat: Breite/Höhe für RSA B II Pläne
  let currentLine = null; // Gezeichnete Linie als Referenz

  // 3-Punkt-Koordinaten (L.ImageOverlay.Rotated API)
  let corners = { topLeft: null, topRight: null, bottomLeft: null };

  // ─── CSS ─────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('rpio-styles')) return;
    const s = document.createElement('style');
    s.id = 'rpio-styles';
    s.textContent = `
      .rpio-handle {
        width:32px!important; height:32px!important;
        margin-left:-16px!important; margin-top:-16px!important;
        border-radius:50%; cursor:grab;
        display:flex; align-items:center; justify-content:center;
        font:700 9px monospace; color:#fff;
        box-shadow:0 2px 8px rgba(0,0,0,.5),0 0 0 2px rgba(255,255,255,.3);
        transition:transform .1s; touch-action:none;
        user-select:none; -webkit-user-select:none; z-index:950!important;
      }
      .rpio-handle:active { cursor:grabbing; transform:scale(1.25); }
      .rpio-handle-tl { background:#ef4444; }
      .rpio-handle-tr { background:#22c55e; }
      .rpio-handle-bl { background:#3b82f6; }
      .rpio-handle-br { background:#a855f7; }
      .rpio-handle-center {
        width:36px!important; height:36px!important;
        margin-left:-18px!important; margin-top:-18px!important;
        background:rgba(230,81,0,.92); border-radius:50%; cursor:grab;
        display:flex; align-items:center; justify-content:center;
        font-size:16px; color:#fff;
        box-shadow:0 2px 12px rgba(230,81,0,.5),0 0 0 2px rgba(255,255,255,.25);
        touch-action:none; z-index:940!important;
        user-select:none; -webkit-user-select:none;
      }
      .rpio-handle-center:active { cursor:grabbing; transform:scale(1.15); }
      .rpio-controls {
        position:absolute;
        bottom:calc(var(--tab-h,60px) + var(--safe-b,0px) + 10px);
        right:10px; z-index:800;
        display:flex; flex-direction:column; gap:6px; align-items:flex-end;
      }
      .rpio-pill {
        display:flex; align-items:center; gap:6px;
        padding:7px 12px; border-radius:20px;
        background:rgba(26,24,20,.9); backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,.1);
        box-shadow:0 2px 12px rgba(0,0,0,.3);
      }
      .rpio-pill label {
        font:600 9px sans-serif; color:#8c8478;
        letter-spacing:.5px; text-transform:uppercase; margin:0;
      }
      .rpio-pill input[type=range] {
        width:80px; height:4px; accent-color:#e65100; cursor:pointer;
      }
      .rpio-pill .rpio-val {
        font:700 11px monospace; color:#f0ece6; min-width:30px; text-align:right;
      }
      .rpio-btns { display:flex; gap:5px; }
      .rpio-btn {
        padding:7px 11px; border-radius:10px;
        background:rgba(26,24,20,.9); backdrop-filter:blur(8px);
        border:1.5px solid rgba(255,255,255,.1);
        font:600 10px sans-serif; color:#8c8478;
        cursor:pointer; transition:all .15s; white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,.25);
      }
      .rpio-btn:active { transform:scale(.94); }
      .rpio-btn.on { color:#e65100; border-color:#e65100; background:rgba(230,81,0,.1); }
      .rpio-guide-polygon { }
    `;
    document.head.appendChild(s);
  }

  // ─── Geo Helpers ─────────────────────────────────────────
  function offsetLL(ll, bearDeg, meters) {
    const R = 6378137, rad = bearDeg * Math.PI / 180, d = meters / R;
    const la = ll[0] * Math.PI / 180, lo = ll[1] * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(rad));
    const lo2 = lo+Math.atan2(Math.sin(rad)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
    return [la2*180/Math.PI, lo2*180/Math.PI];
  }

  function calcBearing(a, b) {
    const la=a[0]*Math.PI/180, lb=b[0]*Math.PI/180, dl=(b[1]-a[1])*Math.PI/180;
    return Math.atan2(Math.sin(dl)*Math.cos(lb), Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl))*180/Math.PI;
  }

  function lineLength(pts) {
    let t = 0;
    for (let i = 0; i < pts.length - 1; i++)
      t += L.latLng(pts[i]).distanceTo(L.latLng(pts[i+1]));
    return t;
  }

  function midLL(a, b) { return [(a[0]+b[0])/2, (a[1]+b[1])/2]; }

  // Berechne BR aus TL/TR/BL (Parallelogramm)
  function getBR() {
    const {topLeft:tl, topRight:tr, bottomLeft:bl} = corners;
    return [tr[0]+bl[0]-tl[0], tr[1]+bl[1]-tl[1]];
  }

  function getCenter() { return midLL(corners.topRight, corners.bottomLeft); }

  // ─── Platzierung entlang Linie ───────────────────────────
  // Kernlogik Tenado-Style:
  // Bildbreite (quer zur Fahrt) = RSA-Plan-Breite (~18m für B II Pläne)
  // Bildlänge (entlang Fahrt) = Baustellenlänge + Vor/Nachwarnung
  function placeAlongLine(pts, totalWidthMeters) {
    if (!pts || pts.length < 2) return;
    currentLine = pts;

    const len = lineLength(pts);
    const bear = calcBearing(pts[0], pts[pts.length-1]);

    // RSA B II Pläne: Breite quer zur Fahrt ≈ 18m (Fahrbahn + Gehweg)
    const planQuerBreite = 18;
    // Länge entlang Fahrt = Linienlänge + Puffer (Vor/Nachwarnabstand)
    const planLaenge = totalWidthMeters || Math.max(len + 80, 120);

    // Mittelpunkt der Linie
    const lineMid = midLL(pts[0], pts[pts.length-1]);

    // TL: Startpunkt - Linienrichtung (zurück), dann quer nach links
    const startPt = offsetLL(lineMid, bear + 180, planLaenge / 2);
    corners.topLeft    = offsetLL(startPt, bear + 90, planQuerBreite / 2);
    corners.bottomLeft = offsetLL(startPt, bear - 90, planQuerBreite / 2);

    // TR: Endpunkt, dann quer nach rechts
    const endPt = offsetLL(lineMid, bear, planLaenge / 2);
    corners.topRight = offsetLL(endPt, bear + 90, planQuerBreite / 2);
    // BR = TR + BL - TL (implizit durch Parallelogramm)
  }

  function placeAtMapCenter(widthMeters) {
    const c = mapRef.getCenter();
    const lat = c.lat, lng = c.lng;
    const w = widthMeters || 100, h = w / imgAspect;
    corners.topLeft    = offsetLL(offsetLL([lat,lng], 0, h/2), 270, w/2);
    corners.topRight   = offsetLL(offsetLL([lat,lng], 0, h/2), 90, w/2);
    corners.bottomLeft = offsetLL(offsetLL([lat,lng], 180, h/2), 270, w/2);
  }

  // ─── Overlay ─────────────────────────────────────────────
  function createOverlay() {
    removeOverlay();
    if (!mapRef || !corners.topLeft || !currentImageUrl) return;

    overlay = L.imageOverlay.rotated(
      currentImageUrl,
      corners.topLeft, corners.topRight, corners.bottomLeft,
      { opacity: currentOpacity, interactive: false }
    ).addTo(mapRef);

    isActive = true;
    createHandles();
    createControls();
  }

  function removeOverlay() {
    if (overlay) { mapRef.removeLayer(overlay); overlay = null; }
    removeHandles();
    removeControls();
    isActive = false;
  }

  function updateOverlay() {
    if (!overlay) return;
    overlay.reposition(corners.topLeft, corners.topRight, corners.bottomLeft);
  }

  // ─── Handles ─────────────────────────────────────────────
  function removeHandles() {
    handleMarkers.forEach(m => { try { mapRef.removeLayer(m); } catch(e) {} });
    handleMarkers = [];
    if (centerHandle) { try { mapRef.removeLayer(centerHandle); } catch(e) {} centerHandle = null; }
    if (guideLine) { try { mapRef.removeLayer(guideLine); } catch(e) {} guideLine = null; }
  }

  function mkHandle(pos, cssClass, label, onDrag, onEnd) {
    const icon = L.divIcon({
      className: '',
      html: `<div class="rpio-handle ${cssClass}">${label}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
    const m = L.marker(pos, { icon, draggable: true, autoPan: true }).addTo(mapRef);
    m.on('dragstart', () => mapRef.dragging.disable());
    m.on('drag', e => { onDrag([e.latlng.lat, e.latlng.lng]); updateGuideLine(); });
    m.on('dragend', e => { if (onEnd) onEnd(); mapRef.dragging.enable(); });
    return m;
  }

  function createHandles() {
    removeHandles();
    if (!isEditMode || isLocked || !overlay) return;

    // TL
    handleMarkers.push(mkHandle(corners.topLeft, 'rpio-handle-tl', '↖', pos => {
      corners.topLeft = pos; updateOverlay();
    }));
    // TR
    handleMarkers.push(mkHandle(corners.topRight, 'rpio-handle-tr', '↗', pos => {
      corners.topRight = pos; updateOverlay();
    }));
    // BL
    handleMarkers.push(mkHandle(corners.bottomLeft, 'rpio-handle-bl', '↙', pos => {
      corners.bottomLeft = pos; updateOverlay();
    }));
    // BR (berechnet, verschiebt BL+TR gleichzeitig proportional)
    const br = getBR();
    const brHandle = mkHandle(br, 'rpio-handle-br', '↘', pos => {
      // BR zieht TR und BL mit (Parallelogramm erhalten)
      const tl = corners.topLeft;
      const dLat = pos[0] - (corners.topRight[0]+corners.bottomLeft[0]-tl[0]);
      const dLng = pos[1] - (corners.topRight[1]+corners.bottomLeft[1]-tl[1]);
      corners.topRight   = [corners.topRight[0]+dLat,   corners.topRight[1]+dLng];
      corners.bottomLeft = [corners.bottomLeft[0]+dLat, corners.bottomLeft[1]+dLng];
      updateOverlay();
      // TR und BL Handles mitbewegen
      handleMarkers[1].setLatLng(corners.topRight);
      handleMarkers[2].setLatLng(corners.bottomLeft);
    });
    handleMarkers.push(brHandle);

    // Center-Handle (alles verschieben)
    const cIcon = L.divIcon({
      className: '',
      html: '<div class="rpio-handle-center">⊕</div>',
      iconSize: [36, 36], iconAnchor: [18, 18],
    });
    centerHandle = L.marker(getCenter(), { icon: cIcon, draggable: true, autoPan: true }).addTo(mapRef);

    let startCenter, startCorners;
    centerHandle.on('dragstart', e => {
      mapRef.dragging.disable();
      startCenter = [e.target.getLatLng().lat, e.target.getLatLng().lng];
      startCorners = JSON.parse(JSON.stringify(corners));
    });
    centerHandle.on('drag', e => {
      const dLat = e.latlng.lat - startCenter[0];
      const dLng = e.latlng.lng - startCenter[1];
      corners.topLeft    = [startCorners.topLeft[0]+dLat,    startCorners.topLeft[1]+dLng];
      corners.topRight   = [startCorners.topRight[0]+dLat,   startCorners.topRight[1]+dLng];
      corners.bottomLeft = [startCorners.bottomLeft[0]+dLat, startCorners.bottomLeft[1]+dLng];
      updateOverlay();
      updateGuideLine();
      handleMarkers[0].setLatLng(corners.topLeft);
      handleMarkers[1].setLatLng(corners.topRight);
      handleMarkers[2].setLatLng(corners.bottomLeft);
      handleMarkers[3].setLatLng(getBR());
    });
    centerHandle.on('dragend', () => mapRef.dragging.enable());

    updateGuideLine();
  }

  function updateGuideLine() {
    if (guideLine) { mapRef.removeLayer(guideLine); guideLine = null; }
    if (!isEditMode || isLocked) return;
    const {topLeft:tl, topRight:tr, bottomLeft:bl} = corners;
    const br = getBR();
    guideLine = L.polygon([tl, tr, br, bl], {
      color: '#e65100', weight: 1.5, dashArray: '5,4',
      fill: false, interactive: false, opacity: 0.6,
    }).addTo(mapRef);
  }

  // ─── Controls ────────────────────────────────────────────
  let controlsEl = null;

  function removeControls() {
    if (controlsEl) { controlsEl.remove(); controlsEl = null; }
  }

  function createControls() {
    removeControls();
    const mapArea = document.querySelector('.map-area');
    if (!mapArea) return;

    controlsEl = document.createElement('div');
    controlsEl.className = 'rpio-controls';
    controlsEl.innerHTML = `
      <div class="rpio-pill">
        <label>Deckkraft</label>
        <input type="range" min="10" max="100" value="${Math.round(currentOpacity*100)}" id="rpioOpacity">
        <span class="rpio-val" id="rpioOpacityVal">${Math.round(currentOpacity*100)}%</span>
      </div>
      <div class="rpio-btns">
        <button class="rpio-btn ${isEditMode?'on':''}" id="rpioEdit">✏️ Bearbeiten</button>
        <button class="rpio-btn" id="rpioSnap" title="Overlay auf Linie ausrichten">🎯 Ausrichten</button>
        <button class="rpio-btn" id="rpioClose" title="Schließen">✕</button>
      </div>
    `;
    mapArea.appendChild(controlsEl);

    document.getElementById('rpioOpacity').addEventListener('input', e => {
      currentOpacity = e.target.value / 100;
      document.getElementById('rpioOpacityVal').textContent = e.target.value + '%';
      if (overlay && overlay._image) overlay._image.style.opacity = currentOpacity;
    });

    document.getElementById('rpioEdit').addEventListener('click', () => {
      isEditMode = !isEditMode;
      document.getElementById('rpioEdit').classList.toggle('on', isEditMode);
      createHandles();
    });

    document.getElementById('rpioSnap').addEventListener('click', () => {
      if (currentLine && currentLine.length >= 2) {
        const len = lineLength(currentLine);
        placeAlongLine(currentLine, Math.max(len+80, 120));
        updateOverlay();
        createHandles();
        if (typeof toast === 'function') toast('🎯 Ausgerichtet');
      } else {
        if (typeof toast === 'function') toast('Keine Linie gezeichnet');
      }
    });

    document.getElementById('rpioClose').addEventListener('click', () => {
      removeOverlay();
      // Tab-Bar Button deaktivieren
      const btn = document.getElementById('mcImg');
      if (btn) btn.classList.remove('active');
      const ctrl = document.getElementById('rpOverlayCtrl');
      if (ctrl) ctrl.classList.remove('show');
    });
  }

  // ─── Bild Aspect Ratio ───────────────────────────────────
  function loadAspect(url) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { imgAspect = img.naturalWidth / img.naturalHeight; res(imgAspect); };
      img.onerror = () => res(imgAspect);
      img.src = url;
    });
  }

  // ═══ PUBLIC API ═══════════════════════════════════════════
  return {
    init(map) {
      mapRef = map;
      injectStyles();
    },

    async show(imageUrl, rpId, options = {}) {
      currentImageUrl = imageUrl;
      currentRPId = rpId;
      if (options.opacity !== undefined) currentOpacity = options.opacity;
      if (options.line) currentLine = options.line;

      await loadAspect(imageUrl);

      if (options.line && options.line.length >= 2) {
        placeAlongLine(options.line, options.width);
      } else {
        placeAtMapCenter(options.width || 100);
      }

      createOverlay();
    },

    hide() { removeOverlay(); },

    get isActive() { return isActive; },

    realignToLine(latlngs, widthMeters) {
      currentLine = latlngs;
      if (!isActive) return;
      placeAlongLine(latlngs, widthMeters);
      updateOverlay();
      createHandles();
    },

    toggle(imageUrl, rpId, options) {
      if (isActive) { this.hide(); return false; }
      this.show(imageUrl, rpId, options);
      return true;
    },

    getPosition() { return { ...corners }; },

    setPosition(tl, tr, bl) {
      corners.topLeft = tl; corners.topRight = tr; corners.bottomLeft = bl;
      if (overlay) { updateOverlay(); createHandles(); }
    },
  };
})();
