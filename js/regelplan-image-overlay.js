// ═══════════════════════════════════════════════════════════════
// VZP Editor — Regelplan Image Overlay Module
// ═══════════════════════════════════════════════════════════════
// Regelplan-PNG als rotierbares, skalierbares Overlay auf der
// Leaflet-Karte via L.ImageOverlay.Rotated (3-Punkt-Positionierung).
//
// Features:
//   - 3 farbcodierte Drag-Handles (TL/TR/BL) — Touch-freundlich
//   - Gestrichelter Bounding-Rahmen als Orientierungshilfe
//   - Deckkraft-Slider
//   - Lock/Unlock der Position
//   - Ganzes Overlay verschieben (Center-Handle)
//   - Position-Export als JSON
//   - LocalStorage-Persistenz
//   - Auto-Platzierung entlang gezeichneter Linie
// ═══════════════════════════════════════════════════════════════

const RegelplanImageOverlay = (() => {

  // ─── State ────────────────────────────────────────────────
  let overlay = null;
  let handleMarkers = [];
  let guideLine = null;
  let centerHandle = null;
  let isActive = false;
  let isLocked = false;
  let isEditMode = true;
  let currentOpacity = 0.7;
  let mapRef = null;

  // 3-Punkt-Koordinaten (TL, TR, BL)
  let corners = {
    topLeft: null,
    topRight: null,
    bottomLeft: null,
  };

  // Welches RP-Bild gerade geladen ist
  let currentImageUrl = null;
  let currentRPId = null;

  // Bild-Seitenverhältnis (w/h) — wird aus dem Bild geladen
  let imgAspect = 1.6; // default

  // ─── Handle Styles ────────────────────────────────────────
  const HANDLE_CFG = {
    topLeft:    { css: 'rpio-handle-tl', label: 'TL', color: '#ef4444' },
    topRight:   { css: 'rpio-handle-tr', label: 'TR', color: '#22c55e' },
    bottomLeft: { css: 'rpio-handle-bl', label: 'BL', color: '#3b82f6' },
  };

  // ─── CSS Injection ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('rpio-styles')) return;
    const style = document.createElement('style');
    style.id = 'rpio-styles';
    style.textContent = `
      .rpio-handle {
        width:28px!important; height:28px!important;
        margin-left:-14px!important; margin-top:-14px!important;
        border-radius:50%; cursor:grab;
        display:flex; align-items:center; justify-content:center;
        font:700 9px 'DM Mono','DM Sans',monospace; color:#fff;
        box-shadow: 0 2px 8px rgba(0,0,0,.4), 0 0 0 2px rgba(255,255,255,.25);
        transition: transform .12s, box-shadow .12s;
        touch-action:none; z-index:950!important;
        user-select:none; -webkit-user-select:none;
      }
      .rpio-handle:active { cursor:grabbing; transform:scale(1.3); }
      .rpio-handle-tl { background:#ef4444; }
      .rpio-handle-tr { background:#22c55e; }
      .rpio-handle-bl { background:#3b82f6; }
      .rpio-handle-center {
        width:32px!important; height:32px!important;
        margin-left:-16px!important; margin-top:-16px!important;
        background:rgba(255,107,43,.9); border-radius:50%; cursor:grab;
        display:flex; align-items:center; justify-content:center;
        font:700 10px 'DM Sans',sans-serif; color:#fff;
        box-shadow: 0 2px 10px rgba(255,107,43,.4), 0 0 0 2px rgba(255,255,255,.2);
        touch-action:none; z-index:940!important;
        user-select:none; -webkit-user-select:none;
      }
      .rpio-handle-center:active { cursor:grabbing; transform:scale(1.2); }

      /* Overlay-Controls im Map-Tools Bereich */
      .rpio-controls {
        position:absolute; bottom:calc(var(--tab-h,56px) + var(--safe-b,0px) + 12px);
        right:12px; z-index:800;
        display:flex; flex-direction:column; gap:6px; align-items:flex-end;
      }
      .rpio-opacity-wrap {
        display:flex; align-items:center; gap:6px;
        padding:6px 10px; border-radius:10px;
        background:rgba(17,17,20,.88); backdrop-filter:blur(8px);
        border:1px solid var(--bd, rgba(255,255,255,.08));
      }
      .rpio-opacity-wrap label {
        font:600 9px 'DM Sans',sans-serif; color:var(--tx2, #8e8e96);
        letter-spacing:.5px; text-transform:uppercase; margin:0;
      }
      .rpio-opacity-wrap input[type=range] {
        width:80px; height:4px; accent-color:var(--ac, #ff6b2b);
      }
      .rpio-opacity-wrap .rpio-val {
        font:700 11px 'DM Mono',monospace; color:var(--tx, #f0f0f2); min-width:28px; text-align:right;
      }
      .rpio-btn-row {
        display:flex; gap:4px;
      }
      .rpio-btn {
        padding:6px 10px; border-radius:8px;
        background:rgba(17,17,20,.88); backdrop-filter:blur(8px);
        border:1px solid var(--bd, rgba(255,255,255,.08));
        font:600 10px 'DM Sans',sans-serif; color:var(--tx2, #8e8e96);
        cursor:pointer; transition:all .15s; white-space:nowrap;
        display:flex; align-items:center; gap:4px;
      }
      .rpio-btn:active { transform:scale(.95); }
      .rpio-btn.on { color:var(--ac, #ff6b2b); border-color:var(--ac, #ff6b2b); }
    `;
    document.head.appendChild(style);
  }

  // ─── Geo Helpers ──────────────────────────────────────────
  function offsetLatLng(ll, bearingDeg, meters) {
    const R = 6378137;
    const rad = bearingDeg * Math.PI / 180;
    const d = meters / R;
    const la = ll[0] * Math.PI / 180;
    const lo = ll[1] * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(rad));
    const lo2 = lo + Math.atan2(Math.sin(rad) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI];
  }

  function bearing(a, b) {
    const la = a[0] * Math.PI / 180, lb = b[0] * Math.PI / 180;
    const dl = (b[1] - a[1]) * Math.PI / 180;
    return Math.atan2(Math.sin(dl) * Math.cos(lb),
      Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl)) * 180 / Math.PI;
  }

  function midpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  // ─── Overlay erstellen ────────────────────────────────────
  function createOverlay() {
    if (!mapRef || !corners.topLeft || !currentImageUrl) return;

    removeOverlay();

    overlay = L.imageOverlay.rotated(
      currentImageUrl,
      corners.topLeft,
      corners.topRight,
      corners.bottomLeft,
      { opacity: currentOpacity, interactive: false, className: 'rpio-image' }
    ).addTo(mapRef);

    isActive = true;
    createHandles();
    createControls();
  }

  function removeOverlay() {
    if (overlay) { mapRef.removeLayer(overlay); overlay = null; }
    removeHandles();
    removeControls();
    removeGuideLine();
    isActive = false;
  }

  // ─── Handles ──────────────────────────────────────────────
  function removeHandles() {
    handleMarkers.forEach(m => mapRef.removeLayer(m));
    handleMarkers = [];
    if (centerHandle) { mapRef.removeLayer(centerHandle); centerHandle = null; }
    removeGuideLine();
  }

  function createHandles() {
    removeHandles();
    if (!isEditMode || isLocked || !overlay) return;

    // 3 Eck-Handles
    Object.keys(HANDLE_CFG).forEach(key => {
      const cfg = HANDLE_CFG[key];
      const icon = L.divIcon({
        className: '',
        html: `<div class="rpio-handle ${cfg.css}">${cfg.label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(corners[key], {
        icon, draggable: true, autoPan: true, autoPanPadding: [30, 30],
      }).addTo(mapRef);

      marker._rpioKey = key;

      marker.on('dragstart', () => { mapRef.dragging.disable(); });

      marker.on('drag', (e) => {
        corners[key] = [e.latlng.lat, e.latlng.lng];
        overlay.reposition(corners.topLeft, corners.topRight, corners.bottomLeft);
        updateGuideLine();
        updateCenterHandle();
      });

      marker.on('dragend', () => {
        mapRef.dragging.enable();
        savePosition();
      });

      handleMarkers.push(marker);
    });

    // Center-Handle (verschiebt alles)
    const center = computeCenter();
    const cIcon = L.divIcon({
      className: '',
      html: '<div class="rpio-handle-center">⊕</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    centerHandle = L.marker(center, {
      icon: cIcon, draggable: true, autoPan: true, autoPanPadding: [30, 30],
    }).addTo(mapRef);

    let dragStartCenter = null;
    let dragStartCorners = null;

    centerHandle.on('dragstart', (e) => {
      mapRef.dragging.disable();
      dragStartCenter = [e.target.getLatLng().lat, e.target.getLatLng().lng];
      dragStartCorners = {
        topLeft: [...corners.topLeft],
        topRight: [...corners.topRight],
        bottomLeft: [...corners.bottomLeft],
      };
    });

    centerHandle.on('drag', (e) => {
      const dLat = e.latlng.lat - dragStartCenter[0];
      const dLng = e.latlng.lng - dragStartCenter[1];

      corners.topLeft = [dragStartCorners.topLeft[0] + dLat, dragStartCorners.topLeft[1] + dLng];
      corners.topRight = [dragStartCorners.topRight[0] + dLat, dragStartCorners.topRight[1] + dLng];
      corners.bottomLeft = [dragStartCorners.bottomLeft[0] + dLat, dragStartCorners.bottomLeft[1] + dLng];

      overlay.reposition(corners.topLeft, corners.topRight, corners.bottomLeft);
      updateGuideLine();

      // Update corner handles
      handleMarkers.forEach(m => {
        m.setLatLng(corners[m._rpioKey]);
      });
    });

    centerHandle.on('dragend', () => {
      mapRef.dragging.enable();
      savePosition();
    });

    updateGuideLine();
  }

  function updateCenterHandle() {
    if (!centerHandle) return;
    centerHandle.setLatLng(computeCenter());
  }

  function computeCenter() {
    // Mittelpunkt des Parallelogramms: Schnitt der Diagonalen
    // BR = TR + BL - TL, Center = (TL + BR) / 2 = (TR + BL) / 2
    return midpoint(corners.topRight, corners.bottomLeft);
  }

  // ─── Guide Line (Bounding Box) ───────────────────────────
  function removeGuideLine() {
    if (guideLine) { mapRef.removeLayer(guideLine); guideLine = null; }
  }

  function updateGuideLine() {
    removeGuideLine();
    if (!isEditMode || isLocked) return;

    const tl = corners.topLeft, tr = corners.topRight, bl = corners.bottomLeft;
    // BR = TR + BL - TL (Parallelogramm)
    const br = [tr[0] + bl[0] - tl[0], tr[1] + bl[1] - tl[1]];

    guideLine = L.polygon([tl, tr, br, bl], {
      color: 'var(--ac, #ff6b2b)',
      weight: 1.5,
      dashArray: '6,4',
      fill: false,
      interactive: false,
      opacity: 0.5,
    }).addTo(mapRef);
  }

  // ─── Controls UI ──────────────────────────────────────────
  let controlsEl = null;

  function removeControls() {
    if (controlsEl) { controlsEl.remove(); controlsEl = null; }
  }

  function createControls() {
    removeControls();
    if (!isActive) return;

    controlsEl = document.createElement('div');
    controlsEl.className = 'rpio-controls';
    controlsEl.innerHTML = `
      <div class="rpio-opacity-wrap">
        <label>Bild</label>
        <input type="range" min="0" max="100" value="${Math.round(currentOpacity * 100)}" id="rpioOpacity">
        <span class="rpio-val" id="rpioOpacityVal">${Math.round(currentOpacity * 100)}%</span>
      </div>
      <div class="rpio-btn-row">
        <button class="rpio-btn ${isEditMode ? 'on' : ''}" id="rpioEdit" title="Handles anzeigen">✏️ Edit</button>
        <button class="rpio-btn ${isLocked ? 'on' : ''}" id="rpioLock" title="Position sperren">${isLocked ? '🔒' : '🔓'} Lock</button>
        <button class="rpio-btn" id="rpioExport" title="Position exportieren">📋 JSON</button>
      </div>
    `;

    document.querySelector('.map-area').appendChild(controlsEl);

    // Events
    document.getElementById('rpioOpacity').addEventListener('input', (e) => {
      currentOpacity = e.target.value / 100;
      document.getElementById('rpioOpacityVal').textContent = e.target.value + '%';
      if (overlay && overlay._image) overlay._image.style.opacity = currentOpacity;
    });

    document.getElementById('rpioEdit').addEventListener('click', () => {
      isEditMode = !isEditMode;
      document.getElementById('rpioEdit').classList.toggle('on', isEditMode);
      createHandles();
    });

    document.getElementById('rpioLock').addEventListener('click', () => {
      isLocked = !isLocked;
      const btn = document.getElementById('rpioLock');
      btn.classList.toggle('on', isLocked);
      btn.innerHTML = (isLocked ? '🔒' : '🔓') + ' Lock';
      createHandles();
    });

    document.getElementById('rpioExport').addEventListener('click', exportPosition);
  }

  // ─── Auto-Position entlang Linie ──────────────────────────
  // Platziert das Overlay zentriert auf die gezeichnete Linie,
  // mit der richtigen Ausrichtung und maßstabsgerechter Größe
  function placeAlongLine(latlngs, widthMeters, heightMeters) {
    if (!latlngs || latlngs.length < 2) return;

    // Mittelpunkt der Linie
    const mid = midpoint(latlngs[0], latlngs[latlngs.length - 1]);
    const bear = bearing(latlngs[0], latlngs[latlngs.length - 1]);

    // Bildmaße: Breite entlang Linie, Höhe senkrecht dazu
    const w = widthMeters || 80;
    const h = heightMeters || (w / imgAspect);

    // TopLeft: Vom Mittelpunkt nach links-oben (entlang -bearing, quer -90°)
    const halfW = w / 2;
    const halfH = h / 2;

    const topCenter = offsetLatLng(mid, bear - 90, halfH);
    corners.topLeft = offsetLatLng(topCenter, bear + 180, halfW);
    corners.topRight = offsetLatLng(topCenter, bear, halfW);

    const bottomCenter = offsetLatLng(mid, bear + 90, halfH);
    corners.bottomLeft = offsetLatLng(bottomCenter, bear + 180, halfW);
  }

  // ─── Place at center of current map view ──────────────────
  function placeAtMapCenter(widthMeters) {
    if (!mapRef) return;
    const center = mapRef.getCenter();
    const c = [center.lat, center.lng];
    const w = widthMeters || 60;
    const h = w / imgAspect;

    corners.topLeft = offsetLatLng(offsetLatLng(c, 0, h / 2), 270, w / 2);
    corners.topRight = offsetLatLng(offsetLatLng(c, 0, h / 2), 90, w / 2);
    corners.bottomLeft = offsetLatLng(offsetLatLng(c, 180, h / 2), 270, w / 2);
  }

  // ─── Persistence ──────────────────────────────────────────
  function savePosition() {
    if (!currentRPId) return;
    try {
      const data = { corners, rpId: currentRPId, opacity: currentOpacity };
      localStorage.setItem('vzp_rpio_' + currentRPId, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function loadPosition(rpId) {
    try {
      const raw = localStorage.getItem('vzp_rpio_' + rpId);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.corners && data.corners.topLeft) {
        corners = data.corners;
        if (data.opacity !== undefined) currentOpacity = data.opacity;
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function exportPosition() {
    const data = {
      regelplan: currentRPId,
      corners: { ...corners },
      opacity: currentOpacity,
    };
    const json = JSON.stringify(data, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => {
        showToast('📋 Position kopiert!');
      }).catch(() => {
        prompt('Position-JSON:', json);
      });
    } else {
      prompt('Position-JSON:', json);
    }
  }

  function showToast(msg) {
    // Versuche bestehenden Toast zu nutzen, sonst eigenen
    let el = document.getElementById('rpioToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rpioToast';
      el.style.cssText = `
        position:fixed; bottom:calc(var(--tab-h,56px) + var(--safe-b,0px) + 60px);
        left:50%; transform:translateX(-50%); z-index:2000;
        padding:6px 14px; border-radius:8px;
        background:rgba(17,17,20,.92); backdrop-filter:blur(8px);
        border:1px solid rgba(255,107,43,.3);
        color:#ff8f5e; font:500 12px 'DM Sans',sans-serif;
        pointer-events:none; opacity:0; transition:opacity .3s;
      `;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
  }

  // ─── Image Aspect Ratio ───────────────────────────────────
  function loadImageAspect(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        imgAspect = img.naturalWidth / img.naturalHeight;
        resolve(imgAspect);
      };
      img.onerror = () => resolve(imgAspect);
      img.src = url;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════
  return {
    /**
     * Initialisiert das Modul — einmal beim App-Start aufrufen.
     * @param {L.Map} map - Leaflet Map Instanz
     */
    init(map) {
      mapRef = map;
      injectStyles();
    },

    /**
     * Zeigt ein Regelplan-Bild als Overlay auf der Karte.
     * @param {string} imageUrl - URL zum Regelplan-PNG/SVG
     * @param {string} rpId - Regelplan-ID (z.B. 'BII1')
     * @param {Object} [options]
     * @param {Array} [options.line] - Gezeichnete Linie [[lat,lng], ...] für Auto-Placement
     * @param {number} [options.width] - Breite in Metern (default 80)
     * @param {number} [options.opacity] - Anfangsdeckkraft (0-1)
     */
    async show(imageUrl, rpId, options = {}) {
      currentImageUrl = imageUrl;
      currentRPId = rpId;
      if (options.opacity !== undefined) currentOpacity = options.opacity;

      // Aspect Ratio laden
      await loadImageAspect(imageUrl);

      // Position: gespeichert > entlang Linie > Kartenmitte
      if (!loadPosition(rpId)) {
        if (options.line && options.line.length >= 2) {
          placeAlongLine(options.line, options.width || 80);
        } else {
          placeAtMapCenter(options.width || 60);
        }
      }

      createOverlay();
      showToast('📐 Regelplan-Bild geladen — Handles ziehen zum Positionieren');
    },

    /**
     * Entfernt das Overlay von der Karte.
     */
    hide() {
      removeOverlay();
    },

    /**
     * Ob das Overlay aktuell sichtbar ist.
     */
    get isActive() { return isActive; },

    /**
     * Gibt die aktuelle Position zurück.
     */
    getPosition() {
      return { ...corners };
    },

    /**
     * Setzt die Position programmatisch.
     */
    setPosition(tl, tr, bl) {
      corners.topLeft = tl;
      corners.topRight = tr;
      corners.bottomLeft = bl;
      if (overlay) {
        overlay.reposition(tl, tr, bl);
        createHandles();
      }
    },

    /**
     * Repositioniert das Overlay entlang einer neuen Linie.
     */
    realignToLine(latlngs, widthMeters) {
      placeAlongLine(latlngs, widthMeters);
      if (overlay) {
        overlay.reposition(corners.topLeft, corners.topRight, corners.bottomLeft);
        createHandles();
        savePosition();
      }
    },

    /**
     * Toggle-Methode für den Map-Tools Button.
     */
    toggle(imageUrl, rpId, options) {
      if (isActive) {
        this.hide();
      } else {
        this.show(imageUrl, rpId, options);
      }
      return isActive;
    },
  };
})();
