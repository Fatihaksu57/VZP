// ═══════════════════════════════════════════════════
// VZP Editor — Regelplan Engine (RSA 21)
// Based on official Regelpläne B II/1 – B II/5
// ═══════════════════════════════════════════════════

const RegelplanEngine = (() => {

  // ─── DISPLAY SIZE in real meters ───
  // Icons scale with the map. These define how big they appear
  // relative to the street at 1:500.
  const SZ = {
    vz: 1.8,          // round/triangle VZ signs
    schranke: 3.0,    // Absperrschrankengitter width
    bake: 1.8,        // Leitbake (shown square for simplicity)
    kegel: 0.8,       // Leitkegel
    lsa: 1.5,         // Lichtzeichenanlage
  };

  // ─── REGELPLAN DEFINITIONS ───
  // Positions: along = 'before'|'start'|'repeat'|'end'|'after'
  // lateral = meters perpendicular (positive = work side, negative = road/traffic side)
  // offsetM = meters from start/end for before/after
  // offsetAlongM = additional shift along the line from the anchor point
  // spacing = repeat interval in meters

  const PLANS = {

    // ═══ B II/1 — Radwegsperrung, geringe Einengung ═══
    // Querabsperrung: Schrankengitter + Leitbake + 3 Warnleuchten
    // Längsabsperr. Fahrbahn: doppelseitige Leitbaken max 9m + Schrankengitter Baufeld
    // Längsabsperr. Gehweg: Schrankengitter
    // Z 123 bei -50 bis -70m
    'BII1': {
      name: 'B II/1', title: 'Radwegsperrung, geringe Einengung',
      elements: [
        // Z 123 Baustelle -50 bis -70m (Mittelwert -60m)
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-4 },

        // Querabsperrung oben: Schrankengitter quer über Radweg + Leitbake
        { type:'schranke', vz:'600-30', along:'start', lateral:2.5 },
        { type:'bake', vz:'605-12', along:'start', lateral:0.5 },

        // Längsabsperrung zur Fahrbahn: Leitbaken max 9m
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-0.3 },

        // Schrankengitter am fahrbahnseitigen Baufeldrand
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:1.5 },

        // Längsabsperrung zum Gehweg: Schrankengitter
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4.5 },

        // Querabsperrung unten
        { type:'schranke', vz:'600-30', along:'end', lateral:2.5 },
        { type:'bake', vz:'605-12', along:'end', lateral:0.5 },
      ],
    },

    // ═══ B II/2 — Radwegsperrung mit Radverkehr-Umleitung ═══
    // Wie B II/1, zusätzlich Z 138, Z 241-30, Z 240 und Wegbegrenzungen
    'BII2': {
      name: 'B II/2', title: 'Radwegsperrung mit Umleitung',
      elements: [
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-4 },

        // Z 138 (Radverkehr kreuzt) + Z 241-30 oben am Radweg
        { type:'vz', vz:'138-20', along:'start', lateral:5, offsetAlongM:-6 },
        { type:'vz', vz:'241-31', along:'start', lateral:5, offsetAlongM:-3 },

        // Querabsperrung oben
        { type:'schranke', vz:'600-30', along:'start', lateral:2.5 },
        { type:'bake', vz:'605-12', along:'start', lateral:0.5 },

        // Längsabsperrung Fahrbahn: Leitbaken max 9m
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-0.3 },

        // Schrankengitter Baufeld
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:1.5 },

        // Schrankengitter Gehweg
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4.5 },

        // Querabsperrung unten
        { type:'schranke', vz:'600-30', along:'end', lateral:2.5 },
        { type:'bake', vz:'605-12', along:'end', lateral:0.5 },

        // Z 240 (Fuß-/Radweg gemeinsam) unten
        { type:'vz', vz:'240', along:'end', lateral:5, offsetAlongM:3 },
      ],
    },

    // ═══ B II/3 — Nicht benutzungspfl. Radweg ═══
    // Einfachere Absperrung: Schrankengitter + Absperrschranke Radweg
    // Z 123 in BEIDEN Richtungen, Z 239 für Fußgänger
    'BII3': {
      name: 'B II/3', title: 'Nicht benutzungspfl. Radweg',
      elements: [
        // Z 123 beide Fahrtrichtungen
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-4 },
        { type:'vz', vz:'125', along:'after', offsetM:60, lateral:-4 },

        // Querabsperrung Radweg oben: Absperrschranke + Leitbake
        { type:'schranke', vz:'600-30', along:'start', lateral:2 },
        { type:'bake', vz:'605-10', along:'start', lateral:0.8 },

        // Längsabsperrung Fahrbahn: Schrankengitter
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:-0.3 },

        // Längsabsperrung Gehweg: Schrankengitter
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4.5 },

        // Querabsperrung Radweg unten
        { type:'schranke', vz:'600-30', along:'end', lateral:2 },
        { type:'bake', vz:'605-20', along:'end', lateral:0.8 },

        // Z 239 Fußgänger
        { type:'vz', vz:'259', along:'end', lateral:3.5, offsetAlongM:3 },
      ],
    },

    // ═══ B II/4 — Gehwegsperrung, Notweg auf Fahrbahn ═══
    // Querabsperrung: mind. 3 doppelseitige Leitbaken diagonal (Abstand 1-2m längs, 0.6-1m quer)
    // + Schrankengitter zum Gehweg
    // Längsabsperr. Fahrbahn: doppelseitige Leitbaken max 9m
    // Z 123 bei -30 bis -50m
    'BII4': {
      name: 'B II/4', title: 'Gehwegsperrung, Notweg Fahrbahn',
      elements: [
        // Z 123 in beiden Richtungen -30 bis -50m
        { type:'vz', vz:'125', along:'before', offsetM:40, lateral:-4 },
        { type:'vz', vz:'125', along:'after', offsetM:40, lateral:-4 },

        // Querabsperrung oben zur Fahrbahn: 3 Leitbaken diagonal
        { type:'bake', vz:'605-12', along:'start', lateral:-1.5 },
        { type:'bake', vz:'605-12', along:'start', lateral:-2.3, offsetAlongM:1.5 },
        { type:'bake', vz:'605-12', along:'start', lateral:-3.1, offsetAlongM:3.0 },

        // Querabsperrung oben zum Gehweg
        { type:'schranke', vz:'600-30', along:'start', lateral:3 },

        // Längsabsperrung zum Gehweg
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:4 },

        // Längsabsperrung zur Fahrbahn: Leitbaken max 9m
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-1 },

        // Querabsperrung unten zur Fahrbahn: 3 Leitbaken diagonal (umgekehrt)
        { type:'bake', vz:'605-12', along:'end', lateral:-1.5 },
        { type:'bake', vz:'605-12', along:'end', lateral:-2.3, offsetAlongM:-1.5 },
        { type:'bake', vz:'605-12', along:'end', lateral:-3.1, offsetAlongM:-3.0 },

        // Querabsperrung unten zum Gehweg
        { type:'schranke', vz:'600-30', along:'end', lateral:3 },
      ],
    },

    // ═══ B II/5 — Halbseitig + Gehweg, mit LSA ═══
    // Querabsperrung: Leitbake + Schrankengitter mit 3 Warnleuchten
    // LSA 0-10m vor Baufeld (beide Seiten)
    // Z 123 bei -50 bis -70m (Gegenrichtung -70 bis -100m)
    'BII5': {
      name: 'B II/5', title: 'Halbseitig + Gehweg, LSA',
      elements: [
        // Z 123 Fahrtrichtung -50 bis -70m
        { type:'vz', vz:'125', along:'before', offsetM:60, lateral:-6 },
        // Z 123 Gegenrichtung -70 bis -100m
        { type:'vz', vz:'125', along:'after', offsetM:85, lateral:-6 },

        // LSA Fahrtrichtung, 0-10m vor Baufeld-Ende
        { type:'lsa', vz:'131', along:'end', lateral:-4, offsetAlongM:5 },
        // LSA Gegenrichtung, 0-10m vor Baufeld-Start (von dort gesehen)
        { type:'lsa', vz:'131', along:'start', lateral:-4, offsetAlongM:-5 },

        // Querabsperrung oben: Leitbake + Schrankengitter
        { type:'bake', vz:'605-12', along:'start', lateral:-0.5 },
        { type:'schranke', vz:'600-30', along:'start', lateral:1.5 },

        // Längsabsperrung Gehweg
        { type:'schranke', vz:'600-30', along:'repeat', spacing:9, lateral:5 },

        // Längsabsperrung Fahrbahn: Leitbaken max 9m
        { type:'bake', vz:'605-10', along:'repeat', spacing:9, lateral:-0.5 },

        // Querabsperrung unten
        { type:'bake', vz:'605-12', along:'end', lateral:-0.5 },
        { type:'schranke', vz:'600-30', along:'end', lateral:1.5 },
      ],
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
    UI.toast('Klicke Start- und Endpunkt der Baustelle');
  }

  function addLinePoint(latlng) {
    if (!isDrawingLine) return false;
    linePoints.push(latlng);
    const map = MapModule.getMap();
    if (linePreview) map.removeLayer(linePreview);
    linePreview = L.polyline(linePoints, { color:'#f97316', weight:4, dashArray:'10,6' }).addTo(map);
    if (linePoints.length >= 2) { finishLine(); return true; }
    return true;
  }

  function onMouseMoveWhileDrawing(latlng) {
    if (!isDrawingLine || !linePoints.length) return;
    const map = MapModule.getMap();
    if (linePreview) map.removeLayer(linePreview);
    linePreview = L.polyline([...linePoints, latlng], { color:'#f97316', weight:4, dashArray:'10,6', opacity:0.7 }).addTo(map);
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

  // ─── METERS → PIXELS ───
  function m2px(meters) {
    const map = MapModule.getMap();
    const mpp = 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    return Math.max(14, Math.round(meters / mpp));
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

        const sizeM = SZ[el.type] || SZ.vz;
        const sizePx = m2px(sizeM);
        const rot = el.type === 'schranke' ? bearing : 0;

        const icon = L.divIcon({
          html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="transform:rotate(${rot}deg);width:${sizePx}px;height:auto" draggable="false">`,
          iconSize: [sizePx, sizePx], iconAnchor: [sizePx/2, sizePx/2], className: 'vz-m',
        });
        const marker = L.marker(pos, { icon, draggable: false }).addTo(map);
        marker._vzGroupId = groupId;
        marker._vzId = el.vz;
        marker._vzSizeM = sizeM;
        marker._vzRotation = rot;
        markers.push(marker);
      });
    });

    const zoneLine = L.polyline(constructionLine, { color:'#f97316', weight:5, opacity:0.8, dashArray:'12,6' }).addTo(map);
    const group = { id: groupId, regelplan: planId, name: `${plan.name} — ${plan.title}`, markers, line: zoneLine, constructionLine:[...constructionLine], workSide, bearing };
    groups.push(group);
    enableGroupDrag(group);
    if (linePreview) { map.removeLayer(linePreview); linePreview = null; }
    document.getElementById('stObj').textContent = 'Objekte: ' + markers.length;
    UI.toast(`${plan.name} — ${markers.length} Elemente platziert`);
    showGroupProperties(group);

    map.off('zoomend.rpScale');
    map.on('zoomend.rpScale', rescaleAll);
  }

  function resolvePositions(el, p1, p2, totalLen, bearing) {
    const out = [], extra = el.offsetAlongM || 0;
    if (el.along === 'before') {
      let p = offsetPoint(p1, bearing+180, el.offsetM||50);
      if (extra) p = offsetPoint(p, bearing, extra);
      out.push(p);
    } else if (el.along === 'after') {
      let p = offsetPoint(p2, bearing, el.offsetM||50);
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
      for (let d = 0; d <= totalLen; d += sp) {
        let p = interpolate(p1, p2, d / totalLen);
        if (extra) p = offsetPoint(p, bearing, extra);
        out.push(p);
      }
      // End cap if needed
      const lastD = (out.length - 1) * sp;
      if (totalLen - lastD > sp * 0.3) {
        let p = L.latLng(p2.lat, p2.lng);
        if (extra) p = offsetPoint(p, bearing, extra);
        out.push(p);
      }
    }
    return out;
  }

  function rescaleAll() {
    groups.forEach(g => g.markers.forEach(m => {
      const entry = VZ_CATALOG.find(v => v.id === m._vzId);
      if (!entry) return;
      const px = m2px(m._vzSizeM || SZ.vz);
      const rot = m._vzRotation || 0;
      m.setIcon(L.divIcon({
        html: `<img class="vz-icon" src="assets/vz/${entry.file}" style="transform:rotate(${rot}deg);width:${px}px;height:auto" draggable="false">`,
        iconSize: [px,px], iconAnchor: [px/2,px/2], className: 'vz-m',
      }));
    }));
  }

  // ─── GROUP DRAG ───
  let dragState = null;
  function enableGroupDrag(g) {
    const start = e => { L.DomEvent.stopPropagation(e); beginDrag(g, e); };
    g.line.on('mousedown', start);
    g.markers.forEach(m => m.on('mousedown', start));
  }
  function beginDrag(g, e) {
    const map = MapModule.getMap(); map.dragging.disable();
    dragState = { g, s: e.latlng, ip: g.markers.map(m=>m.getLatLng()), il: g.constructionLine.map(l=>L.latLng(l.lat,l.lng)) };
    map.on('mousemove', onDrag); map.on('mouseup', endDrag);
  }
  function onDrag(e) {
    if (!dragState) return;
    const {g,s,ip,il} = dragState, dl=e.latlng.lat-s.lat, dn=e.latlng.lng-s.lng;
    g.markers.forEach((m,i) => m.setLatLng(L.latLng(ip[i].lat+dl, ip[i].lng+dn)));
    const nl = il.map(l=>L.latLng(l.lat+dl, l.lng+dn));
    g.line.setLatLngs(nl); g.constructionLine = nl;
  }
  function endDrag() {
    if (!dragState) return;
    MapModule.getMap().dragging.enable();
    MapModule.getMap().off('mousemove', onDrag);
    MapModule.getMap().off('mouseup', endDrag);
    dragState = null;
  }

  function showGroupProperties(g) {
    const el = document.getElementById('groupProps'); if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `<div class="pgrp-t">${g.name}</div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:8px">${g.markers.length} Elemente</div>
      <div class="pbtns"><button class="pbtn" onclick="RegelplanEngine.regenerate()">Neu generieren</button>
      <button class="pbtn dng" onclick="RegelplanEngine.removeGroup('${g.id}')">Löschen</button></div>`;
  }
  function removeGroup(id) {
    const map = MapModule.getMap(), i = groups.findIndex(g=>g.id===id);
    if (i===-1) return;
    groups[i].markers.forEach(m=>map.removeLayer(m));
    map.removeLayer(groups[i].line); groups.splice(i,1);
    document.getElementById('groupProps').style.display='none';
    UI.toast('Gelöscht');
    document.getElementById('stObj').textContent='Objekte: '+groups.reduce((n,g)=>n+g.markers.length,0);
  }
  function regenerate() {
    if (!activeRegelplan) return;
    if (groups.length) removeGroup(groups[groups.length-1].id);
    generate(activeRegelplan);
  }

  // ─── GEO ───
  function getBearing(a,b) {
    const dl=(b.lng-a.lng)*Math.PI/180, la=a.lat*Math.PI/180, lb=b.lat*Math.PI/180;
    return (Math.atan2(Math.sin(dl)*Math.cos(lb), Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl))*180/Math.PI+360)%360;
  }
  function offsetPoint(ll, deg, m) {
    const R=6378137, d=m/R, b=deg*Math.PI/180, la=ll.lat*Math.PI/180, lo=ll.lng*Math.PI/180;
    const la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
    const lo2=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
    return L.latLng(la2*180/Math.PI, lo2*180/Math.PI);
  }
  function interpolate(a,b,f) { return L.latLng(a.lat+(b.lat-a.lat)*f, a.lng+(b.lng-a.lng)*f); }

  function setScale500() { MapModule.getMap().setZoom(20); UI.toast('Maßstab ≈ 1:500'); }

  return { startDrawLine, addLinePoint, onMouseMoveWhileDrawing, cancelLine, isDrawing, setSide, generate, regenerate, removeGroup, setScale500, getGroups:()=>groups };
})();
