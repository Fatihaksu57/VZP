// ═══════════════════════════════════════════════════════════════
// VZP Editor — Baugrube Module
// ═══════════════════════════════════════════════════════════════
// Rechteckige Baugrube mit:
//   - 4 Absperrschranken (rot-weiß) als Umrandung
//   - 4 Warnleuchten an den Ecken
//   - VZ 123 an den Zufahrtsseiten
//   - Optional VZ 208/308 wenn Fahrbahn betroffen
//   - Platzierung: Klick + Maße ODER Rechteck aufziehen
//   - Resize per Ecken-Drag
// ═══════════════════════════════════════════════════════════════

const Baugrube = (() => {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createSVG(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // ─── Baugrube-Daten ───────────────────────────────────────
  // Gespeichert als LatLng-Bounds (NW + SE Ecke)
  // Intern wird alles in Pixeln gerendert

  function createBaugrube(map, bounds, options = {}) {
    const {
      fahrbahnBetroffen = false,
      speed = 50,
      label = 'Baugrube',
    } = options;

    const state = {
      bounds: L.latLngBounds(bounds),
      fahrbahnBetroffen,
      speed,
      label,
    };

    // Layers-Gruppe
    const layerGroup = L.layerGroup().addTo(map);
    let svgOverlay = null;

    function render() {
      // Clear previous
      layerGroup.clearLayers();
      if (svgOverlay) { map.removeLayer(svgOverlay); svgOverlay = null; }

      const b = state.bounds;
      const nw = map.latLngToLayerPoint(b.getNorthWest());
      const ne = map.latLngToLayerPoint(b.getNorthEast());
      const se = map.latLngToLayerPoint(b.getSouthEast());
      const sw = map.latLngToLayerPoint(b.getSouthWest());

      const w = ne.x - nw.x; // Pixel-Breite
      const h = sw.y - nw.y; // Pixel-Höhe

      if (w < 5 || h < 5) return;

      // Reale Maße in Metern
      const widthM = b.getNorthWest().distanceTo(b.getNorthEast());
      const heightM = b.getNorthWest().distanceTo(b.getSouthWest());

      // SVG Overlay
      svgOverlay = L.svg({ interactive: true });
      svgOverlay.addTo(map);
      const svgRoot = svgOverlay._rootGroup || svgOverlay._container.querySelector('g');

      const g = createSVG('g', { class: 'baugrube-overlay' });

      // ── 1. Arbeitsstelle (schraffierte Fläche) ──
      const patternId = 'bg-hatch-' + Math.random().toString(36).slice(2, 8);
      const defs = createSVG('defs', {});
      const pattern = createSVG('pattern', {
        id: patternId, width: 6, height: 6,
        patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
      });
      pattern.appendChild(createSVG('line', {
        x1: 0, y1: 0, x2: 0, y2: 6,
        stroke: '#BF360C', 'stroke-width': 1.5, opacity: 0.35
      }));
      defs.appendChild(pattern);
      g.appendChild(defs);

      // Fläche
      g.appendChild(createSVG('rect', {
        x: nw.x, y: nw.y, width: w, height: h,
        fill: `url(#${patternId})`, stroke: '#BF360C', 'stroke-width': 1,
        'stroke-dasharray': '6,3', rx: 2, opacity: 0.7
      }));

      // Label
      g.appendChild(createSVG('text', {
        x: nw.x + w / 2, y: nw.y + h / 2 - 4,
        'text-anchor': 'middle', 'font-size': 8,
        fill: '#BF360C', 'font-family': 'sans-serif', 'font-weight': 'bold', opacity: 0.5
      })).textContent = state.label;

      // Maße
      g.appendChild(createSVG('text', {
        x: nw.x + w / 2, y: nw.y + h / 2 + 6,
        'text-anchor': 'middle', 'font-size': 7,
        fill: '#BF360C', 'font-family': 'monospace', opacity: 0.5
      })).textContent = `${widthM.toFixed(1)}m × ${heightM.toFixed(1)}m`;

      // ── 2. Absperrschranken (4 Seiten) ──
      const schrankeH = 6;
      const margin = 4; // Pixel Abstand zur Grube

      // Oben (Nord)
      renderSchranke(g, nw.x - margin, nw.y - margin - schrankeH, w + margin * 2, schrankeH, 0);
      // Unten (Süd)
      renderSchranke(g, sw.x - margin, sw.y + margin, w + margin * 2, schrankeH, 0);
      // Links (West) — vertikal
      renderSchranke(g, nw.x - margin - schrankeH, nw.y - margin, schrankeH, h + margin * 2, 90);
      // Rechts (Ost) — vertikal
      renderSchranke(g, ne.x + margin, ne.y - margin, schrankeH, h + margin * 2, 90);

      // ── 3. Warnleuchten an den 4 Ecken ──
      const wlSize = 7;
      const wlOffset = margin + 2;
      [
        [nw.x - wlOffset, nw.y - wlOffset],
        [ne.x + wlOffset, ne.y - wlOffset],
        [se.x + wlOffset, se.y + wlOffset],
        [sw.x - wlOffset, sw.y + wlOffset],
      ].forEach(([cx, cy]) => {
        // Äußerer Glow
        g.appendChild(createSVG('circle', {
          cx, cy, r: wlSize / 2 + 2,
          fill: 'rgba(255,215,0,0.15)', stroke: 'none'
        }));
        // Leuchte
        g.appendChild(createSVG('circle', {
          cx, cy, r: wlSize / 2,
          fill: '#FFD700', stroke: '#CC9900', 'stroke-width': 0.6,
        }));
        g.appendChild(createSVG('circle', {
          cx, cy, r: 2,
          fill: '#FFF8DC', opacity: 0.8
        }));
      });

      // ── 4. Verkehrszeichen ──
      const vzSize = 18;
      const vzOffset = margin + schrankeH + 16;

      // VZ 123 an den 4 Zufahrtsseiten
      const vzPositions = [
        { x: nw.x + w / 2, y: nw.y - vzOffset, seite: 'nord' },       // Oben
        { x: nw.x + w / 2, y: sw.y + vzOffset, seite: 'sued' },       // Unten
        { x: nw.x - vzOffset, y: nw.y + h / 2, seite: 'west' },       // Links
        { x: ne.x + vzOffset, y: ne.y + h / 2, seite: 'ost' },        // Rechts
      ];

      vzPositions.forEach(pos => {
        // VZ 123 Dreieck
        const vzG = createSVG('g', { class: 'baugrube-vz' });
        const s = vzSize;
        vzG.appendChild(createSVG('polygon', {
          points: `${pos.x},${pos.y - s / 2} ${pos.x + s / 2},${pos.y + s / 2 - 2} ${pos.x - s / 2},${pos.y + s / 2 - 2}`,
          fill: '#FFF', stroke: '#CC0000', 'stroke-width': 1.5
        }));
        // Schaufelmann Symbol (vereinfacht)
        vzG.appendChild(createSVG('circle', {
          cx: pos.x, cy: pos.y - 1, r: 2,
          fill: '#111'
        }));
        vzG.appendChild(createSVG('line', {
          x1: pos.x, y1: pos.y + 1, x2: pos.x, y2: pos.y + 5,
          stroke: '#111', 'stroke-width': 1.2, 'stroke-linecap': 'round'
        }));
        // Label
        vzG.appendChild(createSVG('text', {
          x: pos.x, y: pos.y + s / 2 + 8,
          'text-anchor': 'middle', 'font-size': 6,
          fill: '#555', 'font-family': 'monospace', 'font-weight': 'bold'
        })).textContent = 'VZ 123';

        g.appendChild(vzG);
      });

      // VZ 208/308 wenn Fahrbahn betroffen
      if (state.fahrbahnBetroffen) {
        // VZ 208 (Vorrang Gegenverkehr) - oben links
        renderVZRund(g, nw.x - vzOffset - 20, nw.y - vzOffset, '208', '#CC0000', '#FFF');
        // VZ 308 (Vorrang) - unten rechts
        renderVZRund(g, ne.x + vzOffset + 20, sw.y + vzOffset, '308', '#0054A6', '#FFF');
      }

      svgRoot.appendChild(g);
    }

    function renderSchranke(parentG, x, y, length, height, rotation) {
      const g = createSVG('g', { class: 'baugrube-schranke' });

      if (rotation === 90) {
        // Vertikale Schranke
        g.appendChild(createSVG('rect', {
          x, y, width: height, height: length,
          fill: '#FFF', stroke: '#999', 'stroke-width': 0.5, rx: 1
        }));
        // Rote Streifen
        const stripeH = 6;
        for (let i = 0; i < length; i += stripeH * 2) {
          g.appendChild(createSVG('rect', {
            x, y: y + i, width: height, height: Math.min(stripeH, length - i),
            fill: '#CC0000', opacity: 0.85
          }));
        }
        g.appendChild(createSVG('rect', {
          x, y, width: height, height: length,
          fill: 'none', stroke: '#888', 'stroke-width': 0.6, rx: 1
        }));
      } else {
        // Horizontale Schranke
        g.appendChild(createSVG('rect', {
          x, y, width: length, height,
          fill: '#FFF', stroke: '#999', 'stroke-width': 0.5, rx: 1
        }));
        const stripeW = 6;
        for (let i = 0; i < length; i += stripeW * 2) {
          g.appendChild(createSVG('rect', {
            x: x + i, y, width: Math.min(stripeW, length - i), height,
            fill: '#CC0000', opacity: 0.85
          }));
        }
        g.appendChild(createSVG('rect', {
          x, y, width: length, height,
          fill: 'none', stroke: '#888', 'stroke-width': 0.6, rx: 1
        }));
      }

      parentG.appendChild(g);
    }

    function renderVZRund(parentG, cx, cy, nummer, bgColor, textColor) {
      const r = 9;
      parentG.appendChild(createSVG('circle', {
        cx, cy, r,
        fill: bgColor === '#FFF' ? '#FFF' : bgColor,
        stroke: bgColor === '#FFF' ? '#CC0000' : bgColor,
        'stroke-width': 1.5
      }));
      parentG.appendChild(createSVG('text', {
        x: cx, y: cy + 3, 'text-anchor': 'middle',
        'font-size': 7, fill: textColor,
        'font-family': 'sans-serif', 'font-weight': 'bold'
      })).textContent = nummer;
      parentG.appendChild(createSVG('text', {
        x: cx, y: cy + r + 9, 'text-anchor': 'middle',
        'font-size': 5.5, fill: '#555',
        'font-family': 'monospace', 'font-weight': 'bold'
      })).textContent = `VZ ${nummer}`;
    }

    // Initial render
    render();

    // Re-render on zoom
    map.on('zoomend', render);
    map.on('moveend', render);

    return {
      state,
      render,
      getBounds: () => state.bounds,
      setBounds: (newBounds) => {
        state.bounds = L.latLngBounds(newBounds);
        render();
      },
      setFahrbahnBetroffen: (val) => {
        state.fahrbahnBetroffen = val;
        render();
      },
      remove: () => {
        map.off('zoomend', render);
        map.off('moveend', render);
        layerGroup.clearLayers();
        if (svgOverlay) map.removeLayer(svgOverlay);
      },
      getMeters: () => {
        const b = state.bounds;
        return {
          width: b.getNorthWest().distanceTo(b.getNorthEast()),
          height: b.getNorthWest().distanceTo(b.getSouthWest()),
        };
      },
    };
  }

  // ─── Baugrube per Maße platzieren ─────────────────────────
  // Klick auf Karte → Dialog mit Breite/Länge → Baugrube zentriert auf Klickpunkt
  function placeByDimensions(map, center, widthM, heightM, options = {}) {
    // Meter in LatLng-Offset umrechnen
    const latOffset = (heightM / 2) / 111320;
    const lngOffset = (widthM / 2) / (111320 * Math.cos(center.lat * Math.PI / 180));

    const bounds = [
      [center.lat + latOffset, center.lng - lngOffset], // NW
      [center.lat - latOffset, center.lng + lngOffset], // SE
    ];

    return createBaugrube(map, bounds, options);
  }

  // ─── Baugrube per Rechteck aufziehen ──────────────────────
  // Gibt ein Promise zurück, das resolved wenn der User 2 Ecken geklickt hat
  function placeByRectangle(map, options = {}) {
    return new Promise((resolve) => {
      let corner1 = null;
      let previewRect = null;
      let moveHandler = null;

      map.getContainer().style.cursor = 'crosshair';

      function onClick(e) {
        if (!corner1) {
          // Erste Ecke
          corner1 = e.latlng;
          L.circleMarker(corner1, {
            radius: 5, color: '#FF6D00', fillColor: '#FFF', fillOpacity: 1, weight: 2
          }).addTo(map);

          // Preview-Rechteck
          moveHandler = (ev) => {
            if (previewRect) map.removeLayer(previewRect);
            previewRect = L.rectangle([corner1, ev.latlng], {
              color: '#FF6D00', weight: 2, dashArray: '6,3',
              fillColor: '#FF6D00', fillOpacity: 0.08
            }).addTo(map);
          };
          map.on('mousemove', moveHandler);
        } else {
          // Zweite Ecke → Baugrube erstellen
          const corner2 = e.latlng;
          map.off('click', onClick);
          map.off('mousemove', moveHandler);
          if (previewRect) map.removeLayer(previewRect);
          map.getContainer().style.cursor = '';

          // Ecken sortieren
          const bounds = [
            [Math.max(corner1.lat, corner2.lat), Math.min(corner1.lng, corner2.lng)],
            [Math.min(corner1.lat, corner2.lat), Math.max(corner1.lng, corner2.lng)],
          ];

          const bg = createBaugrube(map, bounds, options);
          resolve(bg);
        }
      }

      map.on('click', onClick);

      // ESC zum Abbrechen
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          map.off('click', onClick);
          if (moveHandler) map.off('mousemove', moveHandler);
          if (previewRect) map.removeLayer(previewRect);
          map.getContainer().style.cursor = '';
          document.removeEventListener('keydown', escHandler);
          resolve(null);
        }
      };
      document.addEventListener('keydown', escHandler);
    });
  }

  // ─── Public API ───────────────────────────────────────────
  return {
    create: createBaugrube,
    placeByDimensions,
    placeByRectangle,
  };
})();
