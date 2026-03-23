// ═══════════════════════════════════════════════════════════════
// VZP Editor — Maßketten-System (Dimension Chain Overlay)
// ═══════════════════════════════════════════════════════════════
// Zeichnet automatische Bemaßungen entlang der Regelplan-Elemente:
//   - Vorwarnabstand (VZ 123 → Arbeitsstelle)
//   - Sicherheitsabstand
//   - Länge Arbeitsstelle
//   - Nachwarnabstand
//   - Seitliche Abstände (Fahrbahnbreite, Gehwegbreite)
// ═══════════════════════════════════════════════════════════════

const Massketten = (() => {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ─── Stil-Konstanten ──────────────────────────────────────
  const STYLE = {
    lineColor: '#1565C0',       // Blau für Maßlinien
    lineColorWarn: '#E65100',   // Orange für Mindestmaße
    lineColorOk: '#2E7D32',    // Grün für OK-Maße
    lineWidth: 0.8,
    fontSize: 7,
    fontFamily: 'monospace',
    arrowSize: 3,
    extensionLength: 6,        // Hilfslinien-Verlängerung
    labelOffset: 3,            // Abstand Text zur Linie
    padding: 4,
  };

  // ─── RSA 21 Abstände für Validierung ──────────────────────
  const SOLL_ABSTÄNDE = {
    innerorts_50: {
      vorwarnAbstand: { min: 50, soll: 50, label: 'Vorwarnung' },
      sicherheitsAbstand: { min: 5, soll: 5, label: 'Sicherheitsabstand' },
      nachwarnAbstand: { min: 30, soll: 30, label: 'Nachwarnung' },
      restfahrbahnBreite: { min: 3.0, soll: 3.5, label: 'Restfahrbahn' },
      restgehwegBreite: { min: 1.30, soll: 1.50, label: 'Restgehweg' },
      leitbakenAbstand: { min: 5, soll: 6, label: 'Leitbaken' },
    },
    innerorts_30: {
      vorwarnAbstand: { min: 30, soll: 30, label: 'Vorwarnung' },
      sicherheitsAbstand: { min: 3, soll: 3, label: 'Sicherheitsabstand' },
      nachwarnAbstand: { min: 20, soll: 20, label: 'Nachwarnung' },
      restfahrbahnBreite: { min: 2.75, soll: 3.0, label: 'Restfahrbahn' },
      restgehwegBreite: { min: 1.30, soll: 1.30, label: 'Restgehweg' },
      leitbakenAbstand: { min: 3, soll: 4, label: 'Leitbaken' },
    },
  };

  function createSVG(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // ─── Horizontale Maßkette ─────────────────────────────────
  // Zeichnet eine Maßlinie von (x1,y1) nach (x2,y2) mit Pfeilen und Beschriftung
  function masskette(x1, y1, x2, y2, label, meter, options = {}) {
    const g = createSVG('g', { class: 'masskette' });
    const {
      color = STYLE.lineColor,
      validate = null,       // { min, soll } für Farbkodierung
      seite = 'oben',       // oben/unten — wohin die Hilfslinien zeigen
      extensionDir = -1,     // -1 = nach oben, +1 = nach unten
    } = options;

    // Farbkodierung bei Validierung
    let lineColor = color;
    let isWarning = false;
    if (validate) {
      if (meter < validate.min) {
        lineColor = STYLE.lineColorWarn;
        isWarning = true;
      } else if (meter >= validate.soll) {
        lineColor = STYLE.lineColorOk;
      }
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return g; // Zu kurz

    const angle = Math.atan2(dy, dx);
    const nx = -Math.sin(angle) * extensionDir;
    const ny = Math.cos(angle) * extensionDir;

    // Hilfslinien (Extension Lines)
    const ext = STYLE.extensionLength;
    g.appendChild(createSVG('line', {
      x1: x1 + nx * 2, y1: y1 + ny * 2,
      x2: x1 + nx * (ext + 2), y2: y1 + ny * (ext + 2),
      stroke: lineColor, 'stroke-width': 0.5, opacity: 0.6
    }));
    g.appendChild(createSVG('line', {
      x1: x2 + nx * 2, y1: y2 + ny * 2,
      x2: x2 + nx * (ext + 2), y2: y2 + ny * (ext + 2),
      stroke: lineColor, 'stroke-width': 0.5, opacity: 0.6
    }));

    // Maßlinie (auf Höhe der Hilfslinien-Enden)
    const mLineY = ext;
    const mx1 = x1 + nx * mLineY;
    const my1 = y1 + ny * mLineY;
    const mx2 = x2 + nx * mLineY;
    const my2 = y2 + ny * mLineY;

    g.appendChild(createSVG('line', {
      x1: mx1, y1: my1, x2: mx2, y2: my2,
      stroke: lineColor, 'stroke-width': STYLE.lineWidth,
      'marker-start': 'url(#arrow-start)',
      'marker-end': 'url(#arrow-end)',
    }));

    // Beschriftung
    const midX = (mx1 + mx2) / 2;
    const midY = (my1 + my2) / 2;
    const labelOffsetX = nx * STYLE.labelOffset;
    const labelOffsetY = ny * STYLE.labelOffset;

    // Hintergrund für Text
    const textLen = Math.max(label.length, String(meter).length + 1) * 4;
    g.appendChild(createSVG('rect', {
      x: midX + labelOffsetX - textLen / 2 - 2,
      y: midY + labelOffsetY - 10,
      width: textLen + 4,
      height: 14,
      fill: '#fff', opacity: 0.9, rx: 1.5
    }));

    // Maß-Text (z.B. "50,0 m")
    const meterText = createSVG('text', {
      x: midX + labelOffsetX,
      y: midY + labelOffsetY - 1,
      'text-anchor': 'middle',
      'font-size': STYLE.fontSize,
      'font-family': STYLE.fontFamily,
      'font-weight': 'bold',
      fill: lineColor,
    });
    meterText.textContent = formatMeter(meter);
    g.appendChild(meterText);

    // Label-Text (z.B. "Vorwarnung")
    if (label) {
      const labelText = createSVG('text', {
        x: midX + labelOffsetX,
        y: midY + labelOffsetY + 8,
        'text-anchor': 'middle',
        'font-size': STYLE.fontSize - 1.5,
        'font-family': STYLE.fontFamily,
        fill: lineColor,
        opacity: 0.8,
      });
      labelText.textContent = label;
      g.appendChild(labelText);
    }

    // Warnsymbol bei Unterschreitung
    if (isWarning) {
      const warnG = createSVG('g', { class: 'warn-icon' });
      warnG.appendChild(createSVG('polygon', {
        points: `${midX + labelOffsetX + textLen / 2 + 6},${midY + labelOffsetY - 8} ${midX + labelOffsetX + textLen / 2 + 12},${midY + labelOffsetY + 2} ${midX + labelOffsetX + textLen / 2},${midY + labelOffsetY + 2}`,
        fill: '#FFD700', stroke: '#E65100', 'stroke-width': 0.5
      }));
      warnG.appendChild(createSVG('text', {
        x: midX + labelOffsetX + textLen / 2 + 6,
        y: midY + labelOffsetY,
        'text-anchor': 'middle',
        'font-size': 6, 'font-weight': 'bold', fill: '#E65100'
      })).textContent = '!';
      g.appendChild(warnG);
    }

    return g;
  }

  // ─── Seitliche Maßkette (quer zur Straße) ─────────────────
  function seitlicheMasskette(x, y, breite, label, pixelPerMeter, options = {}) {
    const {
      color = STYLE.lineColor,
      validate = null,
      richtung = 'vertikal',  // vertikal oder horizontal
    } = options;

    const pixelBreite = breite * pixelPerMeter;

    if (richtung === 'vertikal') {
      return masskette(x, y, x, y + pixelBreite, label, breite, {
        color, validate, extensionDir: 1
      });
    } else {
      return masskette(x, y, x + pixelBreite, y, label, breite, {
        color, validate, extensionDir: -1
      });
    }
  }


  // ─── Komplettes Maßketten-Overlay für einen Regelplan ─────
  // Generiert alle relevanten Bemaßungen basierend auf dem
  // aktiven Regelplan und den tatsächlichen Abständen

  function generateMassketten(map, polylineLatLngs, regelplanId, seite, userParams = {}) {
    const speed = userParams.speed || 50;
    const sollAbstände = speed <= 30 ? SOLL_ABSTÄNDE.innerorts_30 : SOLL_ABSTÄNDE.innerorts_50;
    const fahrbahnBreite = userParams.fahrbahnBreite || 6.5;
    const gehwegBreite = userParams.gehwegBreite || 2.5;
    const arbeitsstelleBreite = userParams.arbeitsstelleBreite || 2.0;
    const pixelPerMeter = RegelplanTemplates.getMapScale(map);
    const seiteFaktor = seite === 'links' ? -1 : 1;

    // Polyline in Pixel
    const pixelPoints = polylineLatLngs.map(ll => map.latLngToLayerPoint(L.latLng(ll)));
    const gesamtLänge = polylineLengthMeters(polylineLatLngs);

    // SVG-Overlay erstellen
    const svgOverlay = L.svg({ interactive: false });
    svgOverlay.addTo(map);
    const svgRoot = svgOverlay._rootGroup || svgOverlay._container.querySelector('g');

    // Arrow-Marker Definitionen
    const defs = ensureArrowDefs(svgRoot);

    const mainGroup = createSVG('g', {
      class: 'massketten-overlay',
      'data-regelplan': regelplanId
    });

    // Startpunkt & Endpunkt der Arbeitsstelle
    const plan = RegelplanTemplates.REGELPLÄNE[regelplanId];
    if (!plan) return null;

    const as = plan.arbeitsstelle || { start: 0.2, ende: 0.8 };
    const asStartPt = interpolatePixelPoint(pixelPoints, as.start);
    const asEndPt = interpolatePixelPoint(pixelPoints, as.ende);
    const lineStartPt = pixelPoints[0];
    const lineEndPt = pixelPoints[pixelPoints.length - 1];

    // Offset für Maßketten (unterhalb/oberhalb der Fahrbahn)
    const masskettenOffset = seiteFaktor * (fahrbahnBreite / 2 + 8) * pixelPerMeter;

    // ── Maßkette 1: Vorwarnabstand ──
    const vorwarnMeter = sollAbstände.vorwarnAbstand.soll;
    const vorwarnPt = extendPoint(lineStartPt, asStartPt, -vorwarnMeter * pixelPerMeter);
    mainGroup.appendChild(masskette(
      vorwarnPt.x, vorwarnPt.y + masskettenOffset,
      lineStartPt.x, lineStartPt.y + masskettenOffset,
      'Vorwarnung', vorwarnMeter,
      { validate: sollAbstände.vorwarnAbstand, extensionDir: seiteFaktor }
    ));

    // ── Maßkette 2: Sicherheitsabstand ──
    const sichMeter = sollAbstände.sicherheitsAbstand.soll;
    mainGroup.appendChild(masskette(
      lineStartPt.x, lineStartPt.y + masskettenOffset,
      asStartPt.x, asStartPt.y + masskettenOffset,
      'Sicherheit', sichMeter,
      { validate: sollAbstände.sicherheitsAbstand, extensionDir: seiteFaktor }
    ));

    // ── Maßkette 3: Arbeitsstelle ──
    const asLänge = gesamtLänge * (as.ende - as.start);
    mainGroup.appendChild(masskette(
      asStartPt.x, asStartPt.y + masskettenOffset,
      asEndPt.x, asEndPt.y + masskettenOffset,
      'Arbeitsstelle', parseFloat(asLänge.toFixed(1)),
      { color: '#E65100', extensionDir: seiteFaktor }
    ));

    // ── Maßkette 4: Nachwarnabstand ──
    const nachwarnMeter = sollAbstände.nachwarnAbstand.soll;
    const nachwarnPt = extendPoint(lineEndPt, asEndPt, nachwarnMeter * pixelPerMeter);
    mainGroup.appendChild(masskette(
      lineEndPt.x, lineEndPt.y + masskettenOffset,
      nachwarnPt.x, nachwarnPt.y + masskettenOffset,
      'Nachwarnung', nachwarnMeter,
      { validate: sollAbstände.nachwarnAbstand, extensionDir: seiteFaktor }
    ));

    // ── Maßkette 5: Gesamtlänge ──
    const gesamtOffset = masskettenOffset + 18 * seiteFaktor;
    mainGroup.appendChild(masskette(
      vorwarnPt.x, vorwarnPt.y + gesamtOffset,
      nachwarnPt.x, nachwarnPt.y + gesamtOffset,
      'Gesamtlänge', parseFloat((vorwarnMeter + sichMeter + asLänge + sichMeter + nachwarnMeter).toFixed(1)),
      { color: '#555', extensionDir: seiteFaktor }
    ));

    // ── Seitliche Maßketten (quer) ──
    const querX = asStartPt.x + (asEndPt.x - asStartPt.x) * 0.5;
    const querY = asStartPt.y + (asEndPt.y - asStartPt.y) * 0.5;

    // Restfahrbahnbreite
    const restFB = fahrbahnBreite - arbeitsstelleBreite;
    const querOffset = -seiteFaktor * (fahrbahnBreite / 2) * pixelPerMeter;
    mainGroup.appendChild(seitlicheMasskette(
      querX - 15, querY + querOffset,
      restFB, 'Restfahrbahn', pixelPerMeter,
      { validate: sollAbstände.restfahrbahnBreite, richtung: 'vertikal' }
    ));

    // Arbeitsstellenbreite
    const asQuerOffset = seiteFaktor * (fahrbahnBreite / 2 - arbeitsstelleBreite) * pixelPerMeter;
    mainGroup.appendChild(seitlicheMasskette(
      querX + 15, querY + asQuerOffset,
      arbeitsstelleBreite, 'Arbeitsstelle', pixelPerMeter,
      { color: '#E65100', richtung: 'vertikal' }
    ));

    svgRoot.appendChild(mainGroup);

    // ── Validierungsbericht ──
    const validierung = validateAbstände(regelplanId, {
      vorwarnAbstand: vorwarnMeter,
      sicherheitsAbstand: sichMeter,
      arbeitsstelleLänge: asLänge,
      nachwarnAbstand: nachwarnMeter,
      restfahrbahnBreite: restFB,
      gehwegBreite,
    }, speed);

    return {
      overlay: svgOverlay,
      group: mainGroup,
      validierung,
      remove: () => map.removeLayer(svgOverlay),
    };
  }


  // ─── Validierung ──────────────────────────────────────────

  function validateAbstände(regelplanId, istWerte, speed) {
    const soll = speed <= 30 ? SOLL_ABSTÄNDE.innerorts_30 : SOLL_ABSTÄNDE.innerorts_50;
    const ergebnis = [];

    const checks = [
      { key: 'vorwarnAbstand', ist: istWerte.vorwarnAbstand },
      { key: 'sicherheitsAbstand', ist: istWerte.sicherheitsAbstand },
      { key: 'nachwarnAbstand', ist: istWerte.nachwarnAbstand },
      { key: 'restfahrbahnBreite', ist: istWerte.restfahrbahnBreite },
    ];

    // Gehwegprüfung nur bei B_II Plänen
    if (regelplanId.startsWith('BII')) {
      checks.push({ key: 'restgehwegBreite', ist: istWerte.gehwegBreite });
    }

    checks.forEach(({ key, ist }) => {
      const s = soll[key];
      if (!s) return;
      const status = ist < s.min ? 'FEHLER' : ist < s.soll ? 'WARNUNG' : 'OK';
      ergebnis.push({
        label: s.label,
        soll: s.soll,
        min: s.min,
        ist: ist,
        status,
        einheit: key.includes('Breite') || key.includes('breite') ? 'm' : 'm',
      });
    });

    return ergebnis;
  }


  // ─── Validierungspanel HTML ───────────────────────────────

  function renderValidierungsPanel(validierung) {
    const container = document.createElement('div');
    container.className = 'massketten-panel';
    container.innerHTML = `
      <div class="mk-header">
        <span class="mk-icon">📏</span>
        <span class="mk-title">RSA 21 Maßprüfung</span>
      </div>
      <div class="mk-body">
        ${validierung.map(v => `
          <div class="mk-row mk-${v.status.toLowerCase()}">
            <span class="mk-label">${v.label}</span>
            <span class="mk-value">${formatMeter(v.ist)}</span>
            <span class="mk-soll">(Soll: ≥${formatMeter(v.min)})</span>
            <span class="mk-status mk-badge-${v.status.toLowerCase()}">${v.status === 'OK' ? '✓' : v.status === 'WARNUNG' ? '⚠' : '✗'}</span>
          </div>
        `).join('')}
      </div>
    `;
    return container;
  }


  // ─── Arrow Marker Definitionen ────────────────────────────

  function ensureArrowDefs(svgRoot) {
    let defs = svgRoot.querySelector('defs.massketten-defs');
    if (defs) return defs;

    defs = createSVG('defs', { class: 'massketten-defs' });

    // Pfeil-Start
    const markerStart = createSVG('marker', {
      id: 'arrow-start', viewBox: '0 0 6 6',
      refX: 1, refY: 3, markerWidth: STYLE.arrowSize, markerHeight: STYLE.arrowSize,
      orient: 'auto-start-reverse'
    });
    markerStart.appendChild(createSVG('path', {
      d: 'M6,0 L0,3 L6,6', fill: 'none', stroke: STYLE.lineColor, 'stroke-width': 1
    }));
    defs.appendChild(markerStart);

    // Pfeil-Ende
    const markerEnd = createSVG('marker', {
      id: 'arrow-end', viewBox: '0 0 6 6',
      refX: 5, refY: 3, markerWidth: STYLE.arrowSize, markerHeight: STYLE.arrowSize,
      orient: 'auto'
    });
    markerEnd.appendChild(createSVG('path', {
      d: 'M0,0 L6,3 L0,6', fill: 'none', stroke: STYLE.lineColor, 'stroke-width': 1
    }));
    defs.appendChild(markerEnd);

    svgRoot.insertBefore(defs, svgRoot.firstChild);
    return defs;
  }


  // ─── Hilfsfunktionen ─────────────────────────────────────

  function formatMeter(m) {
    if (m === undefined || m === null) return '–';
    if (m < 10) return m.toFixed(2) + ' m';
    return m.toFixed(1) + ' m';
  }

  function interpolatePixelPoint(points, t) {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    t = Math.max(0, Math.min(1, t));
    let totalLen = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalLen += dist(points[i], points[i + 1]);
    }
    let target = t * totalLen;
    let acc = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const segLen = dist(points[i], points[i + 1]);
      if (acc + segLen >= target) {
        const segT = (target - acc) / segLen;
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * segT,
          y: points[i].y + (points[i + 1].y - points[i].y) * segT,
        };
      }
      acc += segLen;
    }
    return points[points.length - 1];
  }

  function dist(a, b) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  function extendPoint(from, towards, pixelDistance) {
    const dx = from.x - towards.x;
    const dy = from.y - towards.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: from.x + pixelDistance, y: from.y };
    return {
      x: from.x + (dx / len) * pixelDistance,
      y: from.y + (dy / len) * pixelDistance,
    };
  }

  function polylineLengthMeters(latlngs) {
    let total = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = L.latLng(latlngs[i]);
      const b = L.latLng(latlngs[i + 1]);
      total += a.distanceTo(b);
    }
    return total;
  }


  // ─── CSS für das Validierungspanel ─────────────────────────

  function injectStyles() {
    if (document.getElementById('massketten-styles')) return;
    const style = document.createElement('style');
    style.id = 'massketten-styles';
    style.textContent = `
      .massketten-panel {
        position: absolute;
        bottom: 20px;
        left: 20px;
        z-index: 800;
        background: rgba(15,15,20,0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        min-width: 280px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        overflow: hidden;
      }
      .mk-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(21,101,192,0.15);
        border-bottom: 1px solid rgba(21,101,192,0.3);
      }
      .mk-icon { font-size: 16px; }
      .mk-title {
        font-size: 12px;
        font-weight: 700;
        color: #90CAF9;
        letter-spacing: 0.5px;
      }
      .mk-body { padding: 8px 12px; }
      .mk-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 11px;
      }
      .mk-row:last-child { border-bottom: none; }
      .mk-label { flex: 1; color: #B0BEC5; }
      .mk-value { font-weight: 700; color: #E0E0E0; min-width: 60px; text-align: right; }
      .mk-soll { color: #78909C; font-size: 9px; min-width: 85px; }
      .mk-status { font-size: 13px; min-width: 20px; text-align: center; }
      .mk-badge-ok { color: #4CAF50; }
      .mk-badge-warnung { color: #FF9800; }
      .mk-badge-fehler { color: #F44336; }
      .mk-row.mk-fehler { background: rgba(244,67,54,0.08); }
      .mk-row.mk-warnung { background: rgba(255,152,0,0.06); }

      /* SVG Styles */
      .massketten-overlay text { pointer-events: none; user-select: none; }
      .massketten-overlay .warn-icon { animation: mk-pulse 1.5s ease-in-out infinite; }
      @keyframes mk-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* Toggle Button */
      .mk-toggle {
        position: absolute;
        bottom: 20px;
        left: 20px;
        z-index: 801;
        background: rgba(15,15,20,0.9);
        border: 1px solid rgba(21,101,192,0.3);
        color: #90CAF9;
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 11px;
        font-family: 'JetBrains Mono', monospace;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .mk-toggle:hover { background: rgba(21,101,192,0.2); }
    `;
    document.head.appendChild(style);
  }


  // ─── Public API ───────────────────────────────────────────
  return {
    generateMassketten,
    validateAbstände,
    renderValidierungsPanel,
    injectStyles,
    SOLL_ABSTÄNDE,
    // Einzelne Maßketten-Elemente für Custom-Use
    masskette,
    seitlicheMasskette,
  };
})();
