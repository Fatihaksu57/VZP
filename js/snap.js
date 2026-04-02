// ═══════════════════════════════════════════════════════════════
// VZP Editor — Snap-System (IntelliSnap)
// ═══════════════════════════════════════════════════════════════
// Intelligentes Einrasten beim Zeichnen:
//   - Winkel-Snap (0°, 45°, 90°, 135°, 180° etc.)
//   - Hilfslinien-Anzeige
//   - Snap an vorhandene Punkte (VZ, Handles)
//   - Snap an Straßenverlauf (Overpass API)
// ═══════════════════════════════════════════════════════════════

const SnapSystem = (() => {

  const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]; // Grad
  const SNAP_THRESHOLD_PX = 12; // Pixel-Distanz für Snap
  const ANGLE_TOLERANCE = 8;     // Grad-Toleranz für Winkel-Snap

  let enabled = true;
  let guideLines = [];
  let snapIndicator = null;

  // ─── Winkel-Snap ──────────────────────────────────────────
  // Gegeben: letzter Punkt + aktuelle Maus → snappt auf nächsten SNAP_ANGLE
  function snapAngle(lastLatLng, currentLatLng, map) {
    if (!enabled || !lastLatLng) return currentLatLng;

    const lastPx = map.latLngToContainerPoint(L.latLng(lastLatLng));
    const curPx = map.latLngToContainerPoint(L.latLng(currentLatLng));

    const dx = curPx.x - lastPx.x;
    const dy = curPx.y - lastPx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return currentLatLng;

    const angle = Math.atan2(-dy, dx) * 180 / Math.PI; // Kartesisch
    const normalizedAngle = ((angle % 360) + 360) % 360;

    // Finde nächsten Snap-Winkel
    let bestSnapAngle = null;
    let bestDiff = Infinity;

    for (const sa of SNAP_ANGLES) {
      const diff = Math.abs(normalizedAngle - sa);
      const diffWrap = Math.min(diff, 360 - diff);
      if (diffWrap < ANGLE_TOLERANCE && diffWrap < bestDiff) {
        bestDiff = diffWrap;
        bestSnapAngle = sa;
      }
    }

    if (bestSnapAngle !== null) {
      // Snapped Punkt berechnen
      const radians = bestSnapAngle * Math.PI / 180;
      const snappedPx = L.point(
        lastPx.x + Math.cos(radians) * dist,
        lastPx.y - Math.sin(radians) * dist
      );
      return [
        map.containerPointToLatLng(snappedPx).lat,
        map.containerPointToLatLng(snappedPx).lng
      ];
    }

    return currentLatLng;
  }

  // ─── Punkt-Snap ───────────────────────────────────────────
  // Snappt an existierende Punkte (andere VZ, Linienpunkte etc.)
  function snapToPoints(currentLatLng, existingPoints, map) {
    if (!enabled || !existingPoints?.length) return { snapped: false, latlng: currentLatLng };

    const curPx = map.latLngToContainerPoint(L.latLng(currentLatLng));
    let bestDist = SNAP_THRESHOLD_PX;
    let bestPoint = null;

    existingPoints.forEach(pt => {
      const ptPx = map.latLngToContainerPoint(L.latLng(pt));
      const d = curPx.distanceTo(ptPx);
      if (d < bestDist) {
        bestDist = d;
        bestPoint = pt;
      }
    });

    if (bestPoint) {
      return { snapped: true, latlng: bestPoint };
    }
    return { snapped: false, latlng: currentLatLng };
  }

  // ─── Hilfslinien ──────────────────────────────────────────
  function showGuideLine(map, fromLatLng, angle) {
    clearGuideLines(map);

    const from = L.latLng(fromLatLng);
    const radians = angle * Math.PI / 180;
    
    // Verlängere die Linie über den sichtbaren Bereich hinaus
    const bounds = map.getBounds();
    const maxDist = from.distanceTo(bounds.getNorthEast()) * 2;

    // Berechne Endpunkt in Meter
    const mPerLat = 111320;
    const mPerLng = 111320 * Math.cos(from.lat * Math.PI / 180);
    
    const dxM = Math.cos(radians) * maxDist;
    const dyM = Math.sin(radians) * maxDist;
    
    const endLat = from.lat + dyM / mPerLat;
    const endLng = from.lng + dxM / mPerLng;

    const line = L.polyline([from, [endLat, endLng]], {
      color: '#1565C0',
      weight: 0.8,
      dashArray: '4,4',
      opacity: 0.4,
      interactive: false,
    }).addTo(map);

    guideLines.push(line);
  }

  function showSnapIndicator(map, latlng) {
    clearSnapIndicator(map);
    snapIndicator = L.circleMarker(L.latLng(latlng), {
      radius: 6,
      color: '#1565C0',
      fillColor: '#E3F2FD',
      fillOpacity: 0.8,
      weight: 2,
      interactive: false,
    }).addTo(map);
  }

  function clearGuideLines(map) {
    guideLines.forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
    guideLines = [];
  }

  function clearSnapIndicator(map) {
    if (snapIndicator && map.hasLayer(snapIndicator)) {
      map.removeLayer(snapIndicator);
    }
    snapIndicator = null;
  }

  function clearAll(map) {
    clearGuideLines(map);
    clearSnapIndicator(map);
  }

  // ─── Straßen-Snap via Overpass ────────────────────────────
  // Lädt Straßengeometrie in der Umgebung und snappt darauf
  let cachedRoads = null;
  let cacheCenter = null;

  async function loadNearbyRoads(map) {
    const center = map.getCenter();
    
    // Cache prüfen (nur neu laden wenn > 200m bewegt)
    if (cacheCenter && center.distanceTo(cacheCenter) < 200 && cachedRoads) {
      return cachedRoads;
    }

    const bounds = map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    
    const query = `[out:json][timeout:5];way["highway"](${bbox});out geom;`;
    
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });
      const data = await res.json();
      
      cachedRoads = data.elements
        .filter(e => e.geometry)
        .map(e => ({
          id: e.id,
          name: e.tags?.name || '',
          type: e.tags?.highway,
          geometry: e.geometry.map(g => [g.lat, g.lon]),
        }));
      
      cacheCenter = center;
      return cachedRoads;
    } catch (e) {
      console.warn('Overpass API Fehler:', e);
      return [];
    }
  }

  // Snappt auf nächsten Punkt einer Straße
  function snapToRoad(currentLatLng, roads, map) {
    if (!enabled || !roads?.length) return { snapped: false, latlng: currentLatLng };

    const curPx = map.latLngToContainerPoint(L.latLng(currentLatLng));
    let bestDist = SNAP_THRESHOLD_PX * 2; // Etwas größerer Radius für Straßen
    let bestPoint = null;
    let bestRoad = null;

    for (const road of roads) {
      for (let i = 0; i < road.geometry.length - 1; i++) {
        // Nächster Punkt auf dem Segment
        const a = map.latLngToContainerPoint(L.latLng(road.geometry[i]));
        const b = map.latLngToContainerPoint(L.latLng(road.geometry[i + 1]));
        const nearest = nearestPointOnSegment(curPx, a, b);
        const d = curPx.distanceTo(nearest);
        
        if (d < bestDist) {
          bestDist = d;
          bestPoint = map.containerPointToLatLng(nearest);
          bestRoad = road;
        }
      }
    }

    if (bestPoint) {
      return { 
        snapped: true, 
        latlng: [bestPoint.lat, bestPoint.lng],
        road: bestRoad,
      };
    }
    return { snapped: false, latlng: currentLatLng };
  }

  // Hilfsfunktion: Nächster Punkt auf Liniensegment
  function nearestPointOnSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return a;

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return L.point(a.x + t * dx, a.y + t * dy);
  }

  // ─── Toggle ───────────────────────────────────────────────
  function setEnabled(val) { enabled = val; }
  function isEnabled() { return enabled; }

  // ─── CSS ──────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('snap-styles')) return;
    const style = document.createElement('style');
    style.id = 'snap-styles';
    style.textContent = `
      .snap-indicator {
        pointer-events: none;
        z-index: 1000 !important;
      }
    `;
    document.head.appendChild(style);
  }

  return {
    snapAngle,
    snapToPoints,
    snapToRoad,
    showGuideLine,
    showSnapIndicator,
    clearAll,
    loadNearbyRoads,
    setEnabled,
    isEnabled,
    injectStyles,
  };
})();
