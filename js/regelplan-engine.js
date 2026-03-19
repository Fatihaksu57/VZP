// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine
// Auto-placement of traffic signs per RSA 21
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // ─── RSA 21 PLACEMENT RULES (innerorts) ───
  // Abstände in Metern, gemessen von Arbeitsstelle
  const RSA21 = {
    // B I/1 — Arbeitsstelle im Seitenraum (Gehweg)
    'BI1': {
      name: 'B I/1 — Seitenraum',
      // Signs placed BEFORE the construction zone (approaching traffic)
      before: [
        { vz: '125', offset: -70, side: 'road', label: 'Baustelle' },       // 50-100m vor Arbeitsstelle
        { vz: '101', offset: -80, side: 'road', label: 'Gefahrstelle' },
      ],
      // Signs/devices along the construction zone
      along: [
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke Anfang', pos: 'start' },
        { vz: '610-41', spacing: 5, side: 'work', label: 'Leitkegel', repeat: true },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke Ende', pos: 'end' },
      ],
      after: [],
    },

    // B I/2 — Neben der Fahrbahn mit Einengung
    'BI2': {
      name: 'B I/2 — Neben Fahrbahn',
      before: [
        { vz: '101', offset: -100, side: 'road', label: 'Gefahrstelle' },
        { vz: '125', offset: -90, side: 'road', label: 'Baustelle' },
        { vz: '274-50', offset: -80, side: 'road', label: 'Tempo 30' },
      ],
      along: [
        { vz: '605-10', spacing: 0, side: 'work', label: 'Leitbake Anfang', pos: 'start' },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke Anfang', pos: 'start', offsetLateral: 0.5 },
        { vz: '610-41', spacing: 6, side: 'work', label: 'Leitkegel', repeat: true },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke Ende', pos: 'end', offsetLateral: 0.5 },
        { vz: '605-20', spacing: 0, side: 'work', label: 'Leitbake Ende', pos: 'end' },
      ],
      after: [
        { vz: '278-50', offset: 30, side: 'road', label: 'Ende Tempo 30' },
      ],
    },

    // B II/1 — Halbseitige Sperrung
    'BII1': {
      name: 'B II/1 — Halbseitig',
      before: [
        { vz: '101', offset: -120, side: 'road', label: 'Gefahrstelle' },
        { vz: '125', offset: -110, side: 'road', label: 'Baustelle' },
        { vz: '274-50', offset: -100, side: 'road', label: 'Tempo 30' },
        { vz: '120', offset: -70, side: 'road', label: 'Verengte Fahrbahn' },
        { vz: '308', offset: -50, side: 'road', label: 'Vorrang v. Gegenverkehr' },
        { vz: '625-10', offset: -10, side: 'work', label: 'Richtungstafel' },
      ],
      along: [
        { vz: '605-10', spacing: 0, side: 'work', label: 'Leitbake Anfang', pos: 'start' },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke', pos: 'start', offsetLateral: 1 },
        { vz: '610-41', spacing: 8, side: 'work', label: 'Leitkegel', repeat: true },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke', pos: 'end', offsetLateral: 1 },
        { vz: '605-20', spacing: 0, side: 'work', label: 'Leitbake Ende', pos: 'end' },
      ],
      after: [
        { vz: '278-50', offset: 30, side: 'road', label: 'Ende Tempo 30' },
        { vz: '280', offset: 40, side: 'road', label: 'Ende Überholverbot' },
      ],
    },

    // B II/2 — Halbseitige Sperrung mit LSA
    'BII2': {
      name: 'B II/2 — Halbseitig + LSA',
      before: [
        { vz: '101', offset: -120, side: 'road', label: 'Gefahrstelle' },
        { vz: '125', offset: -110, side: 'road', label: 'Baustelle' },
        { vz: '274-50', offset: -100, side: 'road', label: 'Tempo 30' },
        { vz: '131', offset: -60, side: 'road', label: 'Lichtzeichenanlage' },
        { vz: '625-10', offset: -10, side: 'work', label: 'Richtungstafel' },
      ],
      along: [
        { vz: '605-10', spacing: 0, side: 'work', label: 'Leitbake Anfang', pos: 'start' },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke', pos: 'start', offsetLateral: 1 },
        { vz: '610-41', spacing: 8, side: 'work', label: 'Leitkegel', repeat: true },
        { vz: '600-30', spacing: 0, side: 'work', label: 'Absperrschranke', pos: 'end', offsetLateral: 1 },
        { vz: '605-20', spacing: 0, side: 'work', label: 'Leitbake Ende', pos: 'end' },
      ],
      after: [
        { vz: '278-50', offset: 30, side: 'road', label: 'Ende Tempo 30' },
      ],
    },

    // B II/3 — Vollsperrung
    'BII3': {
      name: 'B II/3 — Vollsperrung',
      before: [
        { vz: '101', offset: -120, side: 'road', label: 'Gefahrstelle' },
        { vz: '125', offset: -110, side: 'road', label: 'Baustelle' },
        { vz: '250', offset: -50, side: 'road', label: 'Verbot für Fahrzeuge' },
        { vz: '1000-10', offset: -50, side: 'road', label: 'ZZ Pfeil rechts', offsetLateral: -1 },
      ],
      along: [
        { vz: '600-32', spacing: 0, side: 'center', label: 'Absperrschranke rot', pos: 'start' },
        { vz: '605-10', spacing: 0, side: 'left', label: 'Leitbake links', pos: 'start', offsetLateral: 3 },
        { vz: '605-20', spacing: 0, side: 'right', label: 'Leitbake rechts', pos: 'start', offsetLateral: 3 },
        { vz: '600-32', spacing: 0, side: 'center', label: 'Absperrschranke rot', pos: 'end' },
      ],
      after: [],
    },
  };

  // ─── STATE ───
  let constructionLine = null;   // Array of L.LatLng
  let workSide = 'right';        // 'left' or 'right' of line direction
  let activeRegelplan = null;    // 'BI1', 'BII1', etc.
  let placedGroup = null;        // { markers: [], line: L.Polyline, id }
  let groups = [];               // All placed regelplan groups
  let isDrawingLine = false;
  let linePreview = null;
  let linePoints = [];

  // ─── PUBLIC: Start drawing construction line ───
  function startDrawLine() {
    isDrawingLine = true;
    linePoints = [];
    if (linePreview) { MapModule.getMap().removeLayer(linePreview); linePreview = null; }
    document.body.classList.add('mode-draw');
    UI.toast('Klicke Start- und Endpunkt der Baustelle auf die Karte');
  }

  function addLinePoint(latlng) {
    if (!isDrawingLine) return false;
    linePoints.push(latlng);
    const map = MapModule.getMap();

    if (linePreview) map.removeLayer(linePreview);
    if (linePoints.length >= 1) {
      linePreview = L.polyline(linePoints, {
        color: '#f97316', weight: 4, dashArray: '10,6', opacity: 0.9
      }).addTo(map);
    }

    if (linePoints.length >= 2) {
      finishLine();
      return true;
    }
    return true;
  }

  function onMouseMoveWhileDrawing(latlng) {
    if (!isDrawingLine || linePoints.length === 0) return;
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

    const dist = constructionLine[0].distanceTo(constructionLine[1]);
    UI.toast(`Baustellenlinie: ${dist.toFixed(1)}m — Wähle Seite und Regelplan`);
    showSideSelector();
  }

  function cancelLine() {
    isDrawingLine = false;
    linePoints = [];
    if (linePreview) { MapModule.getMap().removeLayer(linePreview); linePreview = null; }
    document.body.classList.remove('mode-draw');
  }

  function isDrawing() { return isDrawingLine; }

  // ─── SIDE SELECTION ───
  function showSideSelector() {
    // Update UI to show side selector
    const el = document.getElementById('sideSelector');
    if (el) el.style.display = 'block';
  }

  function setSide(side) {
    workSide = side;
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('on'));
    document.querySelector(`.side-btn[data-side="${side}"]`)?.classList.add('on');
  }

  function getSide() { return workSide; }

  // ─── GENERATE REGELPLAN ───
  function generate(regelplanId) {
    if (!constructionLine || constructionLine.length < 2) {
      UI.toast('Erst Baustellenlinie zeichnen!');
      return;
    }

    const rules = RSA21[regelplanId];
    if (!rules) {
      UI.toast('Regelplan nicht gefunden');
      return;
    }

    activeRegelplan = regelplanId;
    const map = MapModule.getMap();

    // Calculate geometry
    const p1 = constructionLine[0];
    const p2 = constructionLine[1];
    const totalLength = p1.distanceTo(p2);
    const bearing = getBearing(p1, p2);

    // Side offset direction (perpendicular to line)
    const sideAngle = workSide === 'right' ? bearing + 90 : bearing - 90;
    const roadSideAngle = workSide === 'right' ? bearing - 90 : bearing + 90;

    const groupMarkers = [];
    const groupId = 'rp_' + Date.now();

    // Helper: place a single VZ
    function placeSign(vzId, latlng, rotation) {
      const entry = VZ_CATALOG.find(v => v.id === vzId);
      if (!entry) return null;

      const size = 45;
      const icon = L.divIcon({
        html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="transform:rotate(${rotation || 0}deg);width:${size}px;height:auto" draggable="false">`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className: 'vz-m',
      });

      const marker = L.marker(latlng, { icon, draggable: false }).addTo(map);
      marker._vzGroupId = groupId;
      marker._vzId = vzId;
      marker._vzSize = size;
      marker._vzRotation = rotation || 0;
      return marker;
    }

    // ── Place BEFORE signs (approaching traffic) ──
    rules.before.forEach(rule => {
      const dist = Math.abs(rule.offset);
      // Place along the line direction, before start point
      let pos = offsetPoint(p1, bearing + 180, dist); // Go backwards from start

      // Lateral offset: road side or work side
      const latOff = rule.offsetLateral || 0;
      if (rule.side === 'road') {
        pos = offsetPoint(pos, roadSideAngle, 3 + latOff); // 3m from line on road side
      } else if (rule.side === 'work') {
        pos = offsetPoint(pos, sideAngle, 3 + latOff);
      }

      const m = placeSign(rule.vz, pos, 0);
      if (m) {
        m._vzRule = rule;
        m._vzSection = 'before';
        groupMarkers.push(m);
      }
    });

    // ── Place ALONG signs (construction zone) ──
    rules.along.forEach(rule => {
      const positions = [];

      if (rule.pos === 'start') {
        positions.push(p1);
      } else if (rule.pos === 'end') {
        positions.push(p2);
      } else if (rule.repeat && rule.spacing > 0) {
        // Repeat along the line at given spacing
        const count = Math.max(1, Math.floor(totalLength / rule.spacing));
        for (let i = 1; i < count; i++) {
          const frac = (i * rule.spacing) / totalLength;
          if (frac >= 1) break;
          positions.push(interpolate(p1, p2, frac));
        }
      }

      positions.forEach(basePos => {
        let pos = basePos;
        const latOff = rule.offsetLateral || 0;

        if (rule.side === 'work') {
          pos = offsetPoint(pos, sideAngle, 2 + latOff);
        } else if (rule.side === 'road') {
          pos = offsetPoint(pos, roadSideAngle, 2 + latOff);
        } else if (rule.side === 'center') {
          // Center of road — no lateral offset
        } else if (rule.side === 'left') {
          pos = offsetPoint(pos, bearing - 90, latOff);
        } else if (rule.side === 'right') {
          pos = offsetPoint(pos, bearing + 90, latOff);
        }

        // Rotate barriers perpendicular to line
        let rotation = 0;
        if (rule.vz.startsWith('600')) {
          rotation = bearing; // Barriers perpendicular to traffic
        }

        const m = placeSign(rule.vz, pos, rotation);
        if (m) {
          m._vzRule = rule;
          m._vzSection = 'along';
          groupMarkers.push(m);
        }
      });
    });

    // ── Place AFTER signs (leaving traffic) ──
    rules.after.forEach(rule => {
      let pos = offsetPoint(p2, bearing, rule.offset);
      const latOff = rule.offsetLateral || 0;

      if (rule.side === 'road') {
        pos = offsetPoint(pos, roadSideAngle, 3 + latOff);
      } else if (rule.side === 'work') {
        pos = offsetPoint(pos, sideAngle, 3 + latOff);
      }

      const m = placeSign(rule.vz, pos, 0);
      if (m) {
        m._vzRule = rule;
        m._vzSection = 'after';
        groupMarkers.push(m);
      }
    });

    // ── Draw construction zone highlight ──
    const zoneLine = L.polyline(constructionLine, {
      color: '#f97316', weight: 5, opacity: 0.8, dashArray: '12,6'
    }).addTo(map);

    // ── Create group object ──
    const group = {
      id: groupId,
      regelplan: regelplanId,
      name: rules.name,
      markers: groupMarkers,
      line: zoneLine,
      constructionLine: [...constructionLine],
      workSide,
      bearing,
    };

    groups.push(group);
    placedGroup = group;

    // Enable group dragging
    enableGroupDrag(group);

    // Remove preview line
    if (linePreview) { map.removeLayer(linePreview); linePreview = null; }

    // Update object count
    document.getElementById('stObj').textContent = 'Objekte: ' + groupMarkers.length;

    UI.toast(`${rules.name} — ${groupMarkers.length} Zeichen platziert`);
    showGroupProperties(group);
  }

  // ─── GROUP DRAG BEHAVIOR ───
  function enableGroupDrag(group) {
    const map = MapModule.getMap();

    // Make the construction line draggable as handle
    group.line.on('mousedown', function (e) {
      L.DomEvent.stopPropagation(e);
      startGroupDrag(group, e);
    });

    // Also make each marker part of the group drag
    group.markers.forEach(m => {
      m.on('mousedown', function (e) {
        L.DomEvent.stopPropagation(e);
        startGroupDrag(group, e);
      });
    });
  }

  let dragState = null;

  function startGroupDrag(group, e) {
    const map = MapModule.getMap();
    map.dragging.disable();

    const startLatLng = e.latlng;
    // Store initial positions of all markers
    const initialPositions = group.markers.map(m => m.getLatLng());
    const initialLine = group.constructionLine.map(ll => L.latLng(ll.lat, ll.lng));

    dragState = { group, startLatLng, initialPositions, initialLine };

    map.on('mousemove', onGroupDragMove);
    map.on('mouseup', onGroupDragEnd);
  }

  function onGroupDragMove(e) {
    if (!dragState) return;
    const { group, startLatLng, initialPositions, initialLine } = dragState;

    const dlat = e.latlng.lat - startLatLng.lat;
    const dlng = e.latlng.lng - startLatLng.lng;

    // Move all markers
    group.markers.forEach((m, i) => {
      const orig = initialPositions[i];
      m.setLatLng(L.latLng(orig.lat + dlat, orig.lng + dlng));
    });

    // Move line
    const newLine = initialLine.map(ll => L.latLng(ll.lat + dlat, ll.lng + dlng));
    group.line.setLatLngs(newLine);
    group.constructionLine = newLine;
  }

  function onGroupDragEnd(e) {
    if (!dragState) return;
    const map = MapModule.getMap();
    map.dragging.enable();
    map.off('mousemove', onGroupDragMove);
    map.off('mouseup', onGroupDragEnd);
    dragState = null;
  }

  // ─── GROUP PROPERTIES ───
  function showGroupProperties(group) {
    const el = document.getElementById('groupProps');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="pgrp-t">${group.name}</div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:8px">${group.markers.length} Zeichen platziert</div>
      <div class="pbtns">
        <button class="pbtn" onclick="RegelplanEngine.regenerate()">Neu generieren</button>
        <button class="pbtn dng" onclick="RegelplanEngine.removeGroup('${group.id}')">Gruppe löschen</button>
      </div>
    `;
  }

  function removeGroup(groupId) {
    const map = MapModule.getMap();
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;

    const group = groups[idx];
    group.markers.forEach(m => map.removeLayer(m));
    map.removeLayer(group.line);
    groups.splice(idx, 1);

    if (placedGroup?.id === groupId) placedGroup = null;

    const el = document.getElementById('groupProps');
    if (el) el.style.display = 'none';

    UI.toast('Regelplan-Gruppe gelöscht');
    document.getElementById('stObj').textContent = 'Objekte: ' + groups.reduce((n, g) => n + g.markers.length, 0);
  }

  function regenerate() {
    if (!placedGroup || !activeRegelplan) return;
    removeGroup(placedGroup.id);
    generate(activeRegelplan);
  }

  // ─── GEO HELPERS ───
  function getBearing(p1, p2) {
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function offsetPoint(latlng, bearingDeg, distanceM) {
    const R = 6378137; // Earth radius in meters
    const d = distanceM / R;
    const brng = bearingDeg * Math.PI / 180;
    const lat1 = latlng.lat * Math.PI / 180;
    const lng1 = latlng.lng * Math.PI / 180;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

    return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
  }

  function interpolate(p1, p2, fraction) {
    return L.latLng(
      p1.lat + (p2.lat - p1.lat) * fraction,
      p1.lng + (p2.lng - p1.lng) * fraction
    );
  }

  // ─── SCALE SHORTCUT ───
  function setScale500() {
    const map = MapModule.getMap();
    // 1:500 at Berlin latitude ≈ zoom 19-20
    // mpp = 156543.03 * cos(52.52°) / 2^zoom
    // For 1:500: mpp ≈ 0.132mm * 500 = 0.066m → need mpp ≈ 0.132
    // zoom = log2(156543 * cos(52.52°) / 0.132) ≈ 19.8
    map.setZoom(20);
    UI.toast('Maßstab ≈ 1:500');
  }

  return {
    startDrawLine, addLinePoint, onMouseMoveWhileDrawing, cancelLine, isDrawing,
    setSide, getSide,
    generate, regenerate, removeGroup,
    setScale500,
    getGroups: () => groups,
  };
})();
