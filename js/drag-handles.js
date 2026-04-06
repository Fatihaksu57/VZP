// ═══════════════════════════════════════════════════════════════
// VZP Editor — Drag Handles Module
// ═══════════════════════════════════════════════════════════════
// Interaktive Handles zum:
//   - Verlängern/Verkürzen von Regelplan-Linien (Start/End)
//   - Verschieben des ganzen Regelplans (Mitte)
//   - Resize von Baugruben (4 Ecken)
// Live-Update während des Ziehens
// ═══════════════════════════════════════════════════════════════

const DragHandles = (() => {

  const HANDLE_STYLES = {
    endpoint: {
      radius: 7,
      color: '#FF6D00',
      fillColor: '#FFF',
      fillOpacity: 1,
      weight: 2.5,
      className: 'drag-handle drag-handle-endpoint',
    },
    center: {
      radius: 8,
      color: '#1565C0',
      fillColor: '#E3F2FD',
      fillOpacity: 0.9,
      weight: 2.5,
      className: 'drag-handle drag-handle-center',
    },
    corner: {
      radius: 6,
      color: '#FF6D00',
      fillColor: '#FFF3E0',
      fillOpacity: 1,
      weight: 2,
      className: 'drag-handle drag-handle-corner',
    },
  };

  // ─── Regelplan-Handles ────────────────────────────────────
  // Erstellt 3 Handles: Start, Mitte, Ende
  // onUpdate(newLatLngs) wird bei jeder Bewegung aufgerufen

  function createLineHandles(map, latlngs, onUpdate) {
    const handles = [];
    let isDragging = false;
    let dragType = null; // 'start', 'end', 'center'
    let dragStartLatLng = null;
    let originalLatlngs = null;

    // Start-Handle
    const startHandle = L.circleMarker(L.latLng(latlngs[0]), {
      ...HANDLE_STYLES.endpoint,
      draggable: true,
    }).addTo(map);
    startHandle._handleType = 'start';

    // End-Handle
    const endIdx = latlngs.length - 1;
    const endHandle = L.circleMarker(L.latLng(latlngs[endIdx]), {
      ...HANDLE_STYLES.endpoint,
      draggable: true,
    }).addTo(map);
    endHandle._handleType = 'end';

    // Center-Handle
    const centerLatLng = getCenterOfLine(latlngs);
    const centerHandle = L.circleMarker(centerLatLng, {
      ...HANDLE_STYLES.center,
      draggable: true,
    }).addTo(map);
    centerHandle._handleType = 'center';

    handles.push(startHandle, endHandle, centerHandle);

    // ── Drag Logic ──
    function getEventLatLng(e) {
      if (e.latlng) return e.latlng;
      if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches[0]) {
        return map.mouseEventToLatLng(e.originalEvent.touches[0]);
      }
      return null;
    }

    function enableDrag(handle) {
      const onStart = (e) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        const startLatLng = getEventLatLng(e);
        if (!startLatLng) return;
        isDragging = true;
        dragType = handle._handleType;
        dragStartLatLng = startLatLng;
        originalLatlngs = latlngs.map(ll => [ll[0], ll[1]]);
        map.dragging.disable();
        map.getContainer().style.cursor = dragType === 'center' ? 'grab' : 'col-resize';

        map.on('mousemove', onDragMove);
        map.on('mouseup', onDragEnd);
        map.on('touchmove', onDragMove);
        map.on('touchend', onDragEnd);
      };
      handle.on('mousedown', onStart);
      handle.on('touchstart', onStart);
    }

    function onDragMove(e) {
      if (!isDragging) return;
      const moveLatLng = getEventLatLng(e);
      if (!moveLatLng) return;

      const newLatlngs = originalLatlngs.map(ll => [...ll]);

      if (dragType === 'start') {
        newLatlngs[0] = [moveLatLng.lat, moveLatLng.lng];
        startHandle.setLatLng(moveLatLng);
      } else if (dragType === 'end') {
        newLatlngs[newLatlngs.length - 1] = [moveLatLng.lat, moveLatLng.lng];
        endHandle.setLatLng(moveLatLng);
      } else if (dragType === 'center') {
        // Gesamte Linie verschieben
        const dLat = moveLatLng.lat - dragStartLatLng.lat;
        const dLng = moveLatLng.lng - dragStartLatLng.lng;

        for (let i = 0; i < newLatlngs.length; i++) {
          newLatlngs[i][0] = originalLatlngs[i][0] + dLat;
          newLatlngs[i][1] = originalLatlngs[i][1] + dLng;
        }

        // Handles aktualisieren
        startHandle.setLatLng(L.latLng(newLatlngs[0]));
        endHandle.setLatLng(L.latLng(newLatlngs[newLatlngs.length - 1]));
        centerHandle.setLatLng(getCenterOfLine(newLatlngs));

        map.getContainer().style.cursor = 'grabbing';
      }

      // Center-Handle aktualisieren (außer bei center-drag)
      if (dragType !== 'center') {
        centerHandle.setLatLng(getCenterOfLine(newLatlngs));
      }

      // Kopie der aktuellen Latlngs speichern
      for (let i = 0; i < latlngs.length; i++) {
        latlngs[i] = newLatlngs[i];
      }
      // Falls Länge sich geändert hat
      while (latlngs.length > newLatlngs.length) latlngs.pop();
      while (latlngs.length < newLatlngs.length) latlngs.push(newLatlngs[latlngs.length]);
      for (let i = 0; i < newLatlngs.length; i++) latlngs[i] = newLatlngs[i];

      // Callback — Live-Update
      if (onUpdate) onUpdate(newLatlngs);
    }

    function onDragEnd() {
      isDragging = false;
      dragType = null;
      map.dragging.enable();
      map.getContainer().style.cursor = '';
      map.off('mousemove', onDragMove);
      map.off('mouseup', onDragEnd);
      map.off('touchmove', onDragMove);
      map.off('touchend', onDragEnd);
    }

    // Hover-Effekte
    handles.forEach(h => {
      enableDrag(h);

      h.on('mouseover', () => {
        if (!isDragging) {
          h.setStyle({ fillColor: '#FFE0B2', radius: h._handleType === 'center' ? 10 : 9 });
          const cursor = h._handleType === 'center' ? 'grab' : 'col-resize';
          map.getContainer().style.cursor = cursor;
        }
      });
      h.on('mouseout', () => {
        if (!isDragging) {
          const style = HANDLE_STYLES[h._handleType === 'center' ? 'center' : 'endpoint'];
          h.setStyle({ fillColor: style.fillColor, radius: style.radius });
          map.getContainer().style.cursor = '';
        }
      });
    });

    return {
      handles,
      updatePositions: (newLatlngs) => {
        startHandle.setLatLng(L.latLng(newLatlngs[0]));
        endHandle.setLatLng(L.latLng(newLatlngs[newLatlngs.length - 1]));
        centerHandle.setLatLng(getCenterOfLine(newLatlngs));
      },
      remove: () => {
        handles.forEach(h => map.removeLayer(h));
        map.off('mousemove', onDragMove);
        map.off('mouseup', onDragEnd);
        map.off('touchmove', onDragMove);
        map.off('touchend', onDragEnd);
      },
    };
  }


  // ─── Baugrube-Handles ─────────────────────────────────────
  // Erstellt 4 Ecken-Handles für Resize + 1 Center für Move
  // onUpdate(newBounds) wird bei jeder Bewegung aufgerufen

  function createBaugrubeHandles(map, bounds, onUpdate) {
    const handles = [];
    let isDragging = false;
    let dragCorner = null;
    let dragStartLatLng = null;
    let originalBounds = null;

    const b = L.latLngBounds(bounds);

    // 4 Ecken: NW, NE, SE, SW
    const corners = [
      { id: 'nw', latlng: b.getNorthWest(), cursor: 'nw-resize' },
      { id: 'ne', latlng: b.getNorthEast(), cursor: 'ne-resize' },
      { id: 'se', latlng: b.getSouthEast(), cursor: 'se-resize' },
      { id: 'sw', latlng: b.getSouthWest(), cursor: 'sw-resize' },
    ];

    const cornerHandles = {};
    corners.forEach(c => {
      const h = L.circleMarker(c.latlng, {
        ...HANDLE_STYLES.corner,
      }).addTo(map);
      h._cornerId = c.id;
      h._cursorStyle = c.cursor;
      cornerHandles[c.id] = h;
      handles.push(h);
    });

    // Center handle
    const centerHandle = L.circleMarker(b.getCenter(), {
      ...HANDLE_STYLES.center,
    }).addTo(map);
    centerHandle._cornerId = 'center';
    handles.push(centerHandle);

    // ── Drag Logic ──
    function enableCornerDrag(handle) {
      handle.on('mousedown', (e) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        isDragging = true;
        dragCorner = handle._cornerId;
        dragStartLatLng = e.latlng;
        originalBounds = L.latLngBounds(
          [b.getSouthWest().lat, b.getSouthWest().lng],
          [b.getNorthEast().lat, b.getNorthEast().lng]
        );
        map.dragging.disable();

        map.on('mousemove', onCornerDragMove);
        map.on('mouseup', onCornerDragEnd);
      });
    }

    function onCornerDragMove(e) {
      if (!isDragging) return;

      let newSW, newNE;
      const ob = originalBounds;

      if (dragCorner === 'center') {
        const dLat = e.latlng.lat - dragStartLatLng.lat;
        const dLng = e.latlng.lng - dragStartLatLng.lng;
        newSW = [ob.getSouthWest().lat + dLat, ob.getSouthWest().lng + dLng];
        newNE = [ob.getNorthEast().lat + dLat, ob.getNorthEast().lng + dLng];
        map.getContainer().style.cursor = 'grabbing';
      } else {
        // Ecke verschieben
        const swLat = ob.getSouthWest().lat;
        const swLng = ob.getSouthWest().lng;
        const neLat = ob.getNorthEast().lat;
        const neLng = ob.getNorthEast().lng;

        switch (dragCorner) {
          case 'nw':
            newSW = [swLat, e.latlng.lng];
            newNE = [e.latlng.lat, neLng];
            break;
          case 'ne':
            newSW = [swLat, swLng];
            newNE = [e.latlng.lat, e.latlng.lng];
            break;
          case 'se':
            newSW = [e.latlng.lat, swLng];
            newNE = [neLat, e.latlng.lng];
            break;
          case 'sw':
            newSW = [e.latlng.lat, e.latlng.lng];
            newNE = [neLat, neLng];
            break;
        }
        map.getContainer().style.cursor = cornerHandles[dragCorner]._cursorStyle;
      }

      // Mindestgröße sicherstellen
      if (Math.abs(newNE[0] - newSW[0]) < 0.00002) return;
      if (Math.abs(newNE[1] - newSW[1]) < 0.00002) return;

      // Bounds normalisieren (SW muss südwestlich von NE sein)
      const normSW = [Math.min(newSW[0], newNE[0]), Math.min(newSW[1], newNE[1])];
      const normNE = [Math.max(newSW[0], newNE[0]), Math.max(newSW[1], newNE[1])];

      // Bounds aktualisieren
      b._southWest = L.latLng(normSW);
      b._northEast = L.latLng(normNE);

      // Handles aktualisieren
      cornerHandles.nw.setLatLng(b.getNorthWest());
      cornerHandles.ne.setLatLng(b.getNorthEast());
      cornerHandles.se.setLatLng(b.getSouthEast());
      cornerHandles.sw.setLatLng(b.getSouthWest());
      centerHandle.setLatLng(b.getCenter());

      // Callback
      if (onUpdate) onUpdate([normSW, normNE]);
    }

    function onCornerDragEnd() {
      isDragging = false;
      dragCorner = null;
      map.dragging.enable();
      map.getContainer().style.cursor = '';
      map.off('mousemove', onCornerDragMove);
      map.off('mouseup', onCornerDragEnd);
    }

    // Events
    handles.forEach(h => {
      enableCornerDrag(h);

      h.on('mouseover', () => {
        if (!isDragging) {
          h.setStyle({ fillColor: '#FFE0B2', radius: 8 });
          map.getContainer().style.cursor = h._cornerId === 'center' ? 'grab' : (h._cursorStyle || 'grab');
        }
      });
      h.on('mouseout', () => {
        if (!isDragging) {
          const style = h._cornerId === 'center' ? HANDLE_STYLES.center : HANDLE_STYLES.corner;
          h.setStyle({ fillColor: style.fillColor, radius: style.radius });
          map.getContainer().style.cursor = '';
        }
      });
    });

    return {
      handles,
      updatePositions: (newBounds) => {
        const nb = L.latLngBounds(newBounds);
        cornerHandles.nw.setLatLng(nb.getNorthWest());
        cornerHandles.ne.setLatLng(nb.getNorthEast());
        cornerHandles.se.setLatLng(nb.getSouthEast());
        cornerHandles.sw.setLatLng(nb.getSouthWest());
        centerHandle.setLatLng(nb.getCenter());
      },
      remove: () => {
        handles.forEach(h => map.removeLayer(h));
        map.off('mousemove', onCornerDragMove);
        map.off('mouseup', onCornerDragEnd);
      },
    };
  }


  // ─── Hilfsfunktionen ──────────────────────────────────────

  function getCenterOfLine(latlngs) {
    if (latlngs.length === 0) return L.latLng(0, 0);
    if (latlngs.length === 1) return L.latLng(latlngs[0]);

    // Mittelpunkt entlang der Linie (nicht geometrischer Mittelpunkt)
    let totalDist = 0;
    const dists = [];
    for (let i = 0; i < latlngs.length - 1; i++) {
      const d = L.latLng(latlngs[i]).distanceTo(L.latLng(latlngs[i + 1]));
      dists.push(d);
      totalDist += d;
    }

    let target = totalDist / 2;
    let acc = 0;
    for (let i = 0; i < dists.length; i++) {
      if (acc + dists[i] >= target) {
        const t = (target - acc) / dists[i];
        return L.latLng(
          latlngs[i][0] + (latlngs[i + 1][0] - latlngs[i][0]) * t,
          latlngs[i][1] + (latlngs[i + 1][1] - latlngs[i][1]) * t,
        );
      }
      acc += dists[i];
    }
    return L.latLng(latlngs[latlngs.length - 1]);
  }


  // ─── CSS ──────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('drag-handle-styles')) return;
    const style = document.createElement('style');
    style.id = 'drag-handle-styles';
    style.textContent = `
      .drag-handle {
        z-index: 900 !important;
        transition: fill-opacity 0.15s, r 0.15s;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      .drag-handle:hover {
        filter: drop-shadow(0 2px 8px rgba(255,109,0,0.4));
      }
      .drag-handle-center {
        filter: drop-shadow(0 2px 6px rgba(21,101,192,0.4));
      }
      .leaflet-container.dragging-active {
        cursor: grabbing !important;
      }
    `;
    document.head.appendChild(style);
  }


  // ─── Public API ───────────────────────────────────────────
  return {
    createLineHandles,
    createBaugrubeHandles,
    injectStyles,
  };
})();
