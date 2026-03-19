// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine v3 (RSA 21)
// Fixed: icon sizes, rotation, individual drag
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // ─── ICON SIZES at reference zoom 20 (≈1:500) ───
  // These are base pixel sizes. They scale proportionally with zoom.
  const REF_ZOOM = 20;
  const BASE = {
    vz: 18,         // Verkehrszeichen (round/triangle)
    schranke: 30,   // Absperrschrankengitter
    bake: 16,       // Leitbake
    kegel: 12,      // Leitkegel
    lsa: 18,        // Lichtzeichenanlage
  };

  // ─── REGELPLAN DEFINITIONS (RSA 21 B II/1–5) ───
  // lateral: meters perpendicular to line (+ = work side, - = road side)
  // All positions are real-world meters

  const PLANS = {

    'BII1': {
      name: 'B II/1', title: 'Radwegsperrung, geringe Einengung',
      elements: [
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-4 },
        { type:'schranke', vz:'600-30', along:'start', lateral:2.5, orient:'perp' },
        { type:'bake', vz:'605-12', along:'start', lateral:0.5, orient:'along' },
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-0.3, orient:'along' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:1.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'end', lateral:2.5, orient:'perp' },
        { type:'bake', vz:'605-12', along:'end', lateral:0.5, orient:'along' },
      ],
    },

    'BII2': {
      name: 'B II/2', title: 'Radwegsperrung mit Umleitung',
      elements: [
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-4 },
        { type:'vz', vz:'138-20', along:'start', lateral:5, offsetAlongM:-6 },
        { type:'vz', vz:'241-31', along:'start', lateral:5, offsetAlongM:-3 },
        { type:'schranke', vz:'600-30', along:'start', lateral:2.5, orient:'perp' },
        { type:'bake', vz:'605-12', along:'start', lateral:0.5, orient:'along' },
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-0.3, orient:'along' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:1.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'end', lateral:2.5, orient:'perp' },
        { type:'bake', vz:'605-12', along:'end', lateral:0.5, orient:'along' },
        { type:'vz', vz:'240', along:'end', lateral:5, offsetAlongM:3 },
      ],
    },

    'BII3': {
      name: 'B II/3', title: 'Nicht benutzungspfl. Radweg',
      elements: [
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-4 },
        { type:'vz', vz:'125', along:'after', offsetM:60, lateral:-4 },
        { type:'schranke', vz:'600-30', along:'start', lateral:2, orient:'perp' },
        { type:'bake', vz:'605-10', along:'start', lateral:0.8, orient:'along' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:-0.3, orient:'along' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'end', lateral:2, orient:'perp' },
        { type:'bake', vz:'605-20', along:'end', lateral:0.8, orient:'along' },
        { type:'vz', vz:'259', along:'end', lateral:3.5, offsetAlongM:3 },
      ],
    },

    'BII4': {
      name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn',
      elements: [
        { type:'vz', vz:'125', along:'before', offsetM:40, lateral:-4 },
        { type:'vz', vz:'125', along:'after', offsetM:40, lateral:-4 },
        // Diagonal Querabsperrung oben: 3 Leitbaken
        { type:'bake', vz:'605-12', along:'start', lateral:-1.5, orient:'along' },
        { type:'bake', vz:'605-12', along:'start', lateral:-2.3, offsetAlongM:1.5, orient:'along' },
        { type:'bake', vz:'605-12', along:'start', lateral:-3.1, offsetAlongM:3.0, orient:'along' },
        { type:'schranke', vz:'600-30', along:'start', lateral:3, orient:'perp' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4, orient:'along' },
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-1, orient:'along' },
        // Diagonal Querabsperrung unten
        { type:'bake', vz:'605-12', along:'end', lateral:-1.5, orient:'along' },
        { type:'bake', vz:'605-12', along:'end', lateral:-2.3, offsetAlongM:-1.5, orient:'along' },
        { type:'bake', vz:'605-12', along:'end', lateral:-3.1, offsetAlongM:-3.0, orient:'along' },
        { type:'schranke', vz:'600-30', along:'end', lateral:3, orient:'perp' },
      ],
    },

    'BII5': {
      name: 'B II/5', title: 'Halbseitig + Gehweg, LSA',
      elements: [
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-6 },
        { type:'vz', vz:'125', along:'after', offsetM:85, lateral:-6 },
        { type:'lsa', vz:'131', along:'end', lateral:-4, offsetAlongM:5 },
        { type:'lsa', vz:'131', along:'start', lateral:-4, offsetAlongM:-5 },
        { type:'bake', vz:'605-12', along:'start', lateral:-0.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'start', lateral:1.5, orient:'perp' },
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:5, orient:'along' },
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-0.5, orient:'along' },
        { type:'bake', vz:'605-12', along:'end', lateral:-0.5, orient:'along' },
        { type:'schranke', vz:'600-30', along:'end', lateral:1.5, orient:'perp' },
      ],
    },
  };

  // ─── STATE ───
  let constructionLine = null, workSide = 'right', activeRegelplan = null;
  let groups = [], isDrawingLine = false, linePreview = null, linePoints = [];

  // ─── PIXEL SIZE for current zoom ───
  function iconPx(type) {
    const zoom = MapModule.getMap().getZoom();
    const scale = Math.pow(2, zoom - REF_ZOOM); // 1.0 at zoom 20
    const base = BASE[type] || BASE.vz;
    return Math.max(8, Math.round(base * scale));
  }

  // ─── CSS ROTATION from geo bearing ───
  // Leaflet markers: CSS rotate(0deg) = pointing right on screen
  // Geo bearing: 0° = North, 90° = East
  // On a web map at Berlin: North = up = -Y direction
  // CSS rotation needs: bearing in degrees clockwise from "up" on screen
  // Since screen Y is inverted: CSS rotate = bearing (already clockwise from north)
  function bearingToCSS(bearing) {
    return bearing; // degrees clockwise from north maps to CSS rotate
  }

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
    linePreview = L.polyline([...linePoints, latlng], { color: '#f97316', weight: 4, dashArray: '10,6', opacity: 0.7 }).addTo(map);
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
    if (!plan) { UI.toast('Regelplan nicht gefunden'); return; }
    activeRegelplan = planId;

    const map = MapModule.getMap();
    const p1 = constructionLine[0], p2 = constructionLine[1];
    const totalLen = p1.distanceTo(p2);
    const bearing = getBearing(p1, p2);
    const sideMul = workSide === 'right' ? 1 : -1;
    const groupId = 'rp_' + Date.now();
    const markers = [];

    plan.elements.forEach(el => {
      const positions = resolvePositions(el, p1, p2, totalLen, bearing);

      positions.forEach(basePos => {
        const latM = (el.lateral || 0) * sideMul;
        const pos = offsetPoint(basePos, bearing + 90, latM);
        const entry = VZ_CATALOG.find(v => v.id === el.vz);
        if (!entry) return;

        const px = iconPx(el.type);

        // Rotation: VZ signs don't rotate. Schranken/Baken rotate with the line.
        let cssDeg = 0;
        if (el.orient === 'perp') {
          // Perpendicular to line (Querabsperrung)
          cssDeg = bearingToCSS(bearing + 90);
        } else if (el.orient === 'along') {
          // Parallel to line (Längsabsperrung)
          cssDeg = bearingToCSS(bearing);
        }
        // VZ and LSA: no rotation (always face viewer)

        const icon = L.divIcon({
          html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="transform:rotate(${cssDeg}deg);width:${px}px;height:auto" draggable="false">`,
          iconSize: [px, px],
          iconAnchor: [px / 2, px / 2],
          className: 'vz-m',
        });

        // Each marker is individually draggable for manual correction
        const marker = L.marker(pos, { icon, draggable: true }).addTo(map);
        marker._rp = { groupId, vzId: el.vz, type: el.type, orient: el.orient || '', cssDeg };
        markers.push(marker);
      });
    });

    // Construction zone line (draggable as group handle)
    const zoneLine = L.polyline(constructionLine, {
      color: '#f97316', weight: 5, opacity: 0.8, dashArray: '12,6'
    }).addTo(map);

    const group = {
      id: groupId, regelplan: planId, name: `${plan.name} — ${plan.title}`,
      markers, line: zoneLine,
      constructionLine: [...constructionLine], workSide, bearing,
    };
    groups.push(group);

    // Group drag on the orange line
    enableGroupDrag(group);

    if (linePreview) { map.removeLayer(linePreview); linePreview = null; }
    document.getElementById('stObj').textContent = 'Objekte: ' + markers.length;
    UI.toast(`${plan.name} — ${markers.length} Elemente platziert`);
    showGroupProperties(group);

    // Rescale on zoom
    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', rescaleAll);
  }

  // ─── RESOLVE POSITIONS ───
  function resolvePositions(el, p1, p2, totalLen, bearing) {
    const out = [], extra = el.offsetAlongM || 0;

    if (el.along === 'before') {
      let p = offsetPoint(p1, bearing + 180, el.offsetM || 50);
      if (extra) p = offsetPoint(p, bearing, extra);
      out.push(p);
    } else if (el.along === 'after') {
      let p = offsetPoint(p2, bearing, el.offsetM || 50);
      if (extra) p = offsetPoint(p, bearing, extra);
      out.push(p);
    } else if (el.along === 'start') {
      let p = L.latLng(p1.lat, p1.lng);
      if (extra) p = offsetPoint(p, bearing, extra);
      out.push(p);
    } else if (el.along === 'end') {
      let p = L.latLng(p2.lat, p2.lng);
      if (extra) p = offsetPoint(p, bearing, extra);
      out.push(p);
    } else if (el.along === 'repeat') {
      const sp = el.spacing || 9;
      for (let d = 0; d <= totalLen + 0.01; d += sp) {
        const frac = Math.min(d / totalLen, 1);
        let p = interpolate(p1, p2, frac);
        if (extra) p = offsetPoint(p, bearing, extra);
        out.push(p);
      }
      // Add end point if not too close
      if (out.length > 0) {
        const lastP = out[out.length - 1];
        const endP = L.latLng(p2.lat, p2.lng);
        if (extra) { /* already handled */ }
        if (lastP.distanceTo(endP) > sp * 0.4) {
          out.push(endP);
        }
      }
    }
    return out;
  }

  // ─── RESCALE on zoom ───
  function rescaleAll() {
    groups.forEach(g => g.markers.forEach(m => {
      const rp = m._rp; if (!rp) return;
      const entry = VZ_CATALOG.find(v => v.id === rp.vzId);
      if (!entry) return;
      const px = iconPx(rp.type);
      m.setIcon(L.divIcon({
        html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="transform:rotate(${rp.cssDeg}deg);width:${px}px;height:auto" draggable="false">`,
        iconSize: [px, px], iconAnchor: [px / 2, px / 2], className: 'vz-m',
      }));
    }));
  }

  // ─── GROUP DRAG (via orange line) ───
  let dragState = null;

  function enableGroupDrag(group) {
    group.line.on('mousedown', e => {
      L.DomEvent.stopPropagation(e);
      beginGroupDrag(group, e);
    });
  }

  function beginGroupDrag(g, e) {
    const map = MapModule.getMap();
    map.dragging.disable();
    dragState = {
      g, s: e.latlng,
      ip: g.markers.map(m => m.getLatLng()),
      il: g.constructionLine.map(l => L.latLng(l.lat, l.lng)),
    };
    map.on('mousemove', onGroupDrag);
    map.on('mouseup', endGroupDrag);
  }

  function onGroupDrag(e) {
    if (!dragState) return;
    const { g, s, ip, il } = dragState;
    const dlat = e.latlng.lat - s.lat, dlng = e.latlng.lng - s.lng;
    g.markers.forEach((m, i) => m.setLatLng(L.latLng(ip[i].lat + dlat, ip[i].lng + dlng)));
    const nl = il.map(l => L.latLng(l.lat + dlat, l.lng + dlng));
    g.line.setLatLngs(nl);
    g.constructionLine = nl;
  }

  function endGroupDrag() {
    if (!dragState) return;
    const map = MapModule.getMap();
    map.dragging.enable();
    map.off('mousemove', onGroupDrag);
    map.off('mouseup', endGroupDrag);
    dragState = null;
  }

  // ─── GROUP PROPERTIES ───
  function showGroupProperties(g) {
    const el = document.getElementById('groupProps');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="pgrp-t">${g.name}</div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:8px">${g.markers.length} Elemente — einzeln verschiebbar, Gruppe über orange Linie</div>
      <div class="pbtns">
        <button class="pbtn" onclick="RegelplanEngine.regenerate()">Neu generieren</button>
        <button class="pbtn dng" onclick="RegelplanEngine.removeGroup('${g.id}')">Löschen</button>
      </div>`;
  }

  function removeGroup(id) {
    const map = MapModule.getMap();
    const i = groups.findIndex(g => g.id === id);
    if (i === -1) return;
    groups[i].markers.forEach(m => map.removeLayer(m));
    map.removeLayer(groups[i].line);
    groups.splice(i, 1);
    const el = document.getElementById('groupProps');
    if (el) el.style.display = 'none';
    UI.toast('Gelöscht');
    document.getElementById('stObj').textContent = 'Objekte: ' + groups.reduce((n, g) => n + g.markers.length, 0);
  }

  function regenerate() {
    if (!activeRegelplan) return;
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

  // ─── SCALE SHORTCUT ───
  function setScale500() {
    MapModule.getMap().setZoom(20);
    UI.toast('Maßstab ≈ 1:500');
  }

  return {
    startDrawLine, addLinePoint, onMouseMoveWhileDrawing, cancelLine, isDrawing,
    setSide, generate, regenerate, removeGroup, setScale500,
    getGroups: () => groups,
  };
})();
