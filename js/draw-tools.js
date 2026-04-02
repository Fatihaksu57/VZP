// ═══════════════════════════════════════════════════
// VZP Editor — Drawing Tools Module
// ═══════════════════════════════════════════════════

const DrawTools = (() => {
  let mode = 'select'; // select | draw | measure | area
  let points = [];
  let layer = null;
  let tempLine = null;

  const STYLES = {
    draw:    { color: '#f97316', weight: 3, dashArray: '8,4' },
    measure: { color: '#2f81f7', weight: 2, dashArray: '6,4' },
    area:    { color: '#22c55e', weight: 2, fillColor: '#22c55e', fillOpacity: 0.15 },
  };

  function setMode(m) {
    cancel();
    mode = m;
    document.body.className = m !== 'select' ? `mode-${m}` : '';
    // Update toolbar buttons
    document.querySelectorAll('.htools .tbtn').forEach(b => b.classList.remove('on'));
    const ids = { select: 'tV', draw: 'tL', measure: 'tM', area: 'tA' };
    document.getElementById(ids[m])?.classList.add('on');
  }

  function getMode() { return mode; }
  function isActive() { return mode !== 'select'; }

  function addPoint(latlng) {
    if (mode === 'select') return;
    points.push(latlng);
    updatePreview();
  }

  function updatePreview() {
    const map = MapModule.getMap();
    if (layer) { map.removeLayer(layer); layer = null; }

    if (mode === 'draw' && points.length >= 2) {
      layer = L.polyline(points, STYLES.draw).addTo(map);
    } else if (mode === 'measure' && points.length >= 2) {
      layer = L.polyline(points, STYLES.measure).addTo(map);
      layer.bindTooltip(formatDist(calcDist(points)), {
        permanent: true, direction: 'center', className: 'mtip'
      });
    } else if (mode === 'area' && points.length >= 3) {
      layer = L.polygon(points, STYLES.area).addTo(map);
    }
  }

  function onMouseMove(latlng) {
    if (mode === 'select' || points.length === 0) return;
    const map = MapModule.getMap();
    if (tempLine) { map.removeLayer(tempLine); tempLine = null; }

    const pts = [...points, latlng];
    if (mode === 'area' && points.length >= 2) pts.push(points[0]);

    tempLine = L.polyline(pts, {
      color: STYLES[mode]?.color || '#fff',
      weight: 2, dashArray: '4,4', opacity: 0.6
    }).addTo(map);
  }

  function finalize() {
    const map = MapModule.getMap();
    clearTemp();

    if (mode === 'draw' && points.length >= 2) {
      const line = L.polyline([...points], STYLES.draw).addTo(map);
      ObjectManager.add({ type: 'line', layer: line, points: [...points] });
      UI.toast('Linie gezeichnet');
    } else if (mode === 'measure' && points.length >= 2) {
      const dist = calcDist(points);
      const line = L.polyline([...points], STYLES.measure).addTo(map);
      line.bindTooltip(formatDist(dist), { permanent: true, direction: 'center', className: 'mtip' });
      ObjectManager.add({ type: 'measure', layer: line, points: [...points], distance: dist });
      UI.toast('Gemessen: ' + formatDist(dist));
    } else if (mode === 'area' && points.length >= 3) {
      const poly = L.polygon([...points], STYLES.area).addTo(map);
      ObjectManager.add({ type: 'area', layer: poly, points: [...points] });
      UI.toast('Fläche erstellt');
    }

    points = [];
    layer = null;
  }

  function cancel() {
    clearTemp();
    points = [];
    if (layer) { MapModule.getMap().removeLayer(layer); layer = null; }
  }

  function clearTemp() {
    const map = MapModule.getMap();
    if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  }

  function calcDist(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += pts[i - 1].distanceTo(pts[i]);
    return d;
  }

  function formatDist(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(1) + ' m';
  }

  return { setMode, getMode, isActive, addPoint, onMouseMove, finalize, cancel };
})();
