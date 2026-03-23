// ═══════════════════════════════════════════════════════════════
// VZP Editor — Regelplan SVG Template Engine
// ═══════════════════════════════════════════════════════════════
// Ersetzt die alte Absperrbereich-Generierung aus Primitiven.
// Pro Regelplan gibt es ein vordefiniertes SVG-Template,
// das entlang der gezeichneten Linie transformiert wird.
// ═══════════════════════════════════════════════════════════════

const RegelplanTemplates = (() => {

  // ─── RSA 21 Abstände (Innerorts, ≤50 km/h) ───────────────
  const RSA_DISTANCES = {
    innerorts_50: {
      vorwarnAbstand: 50,        // Abstand Vorwarntafel (VZ 123) vor Arbeitsstelle
      sicherheitsAbstand: 5,     // Sicherheitsabstand vor Absperrung
      ueberleitung: 10,          // Überleitungslänge bei Fahrbahnverschwenkung
      schutzraum: 0.50,          // Seitlicher Schutzraum zur Arbeitsstelle
      leitbakenAbstand: 6,       // Abstand zwischen Leitbaken in Überleitung
      leitkegel_abstand: 3,      // Abstand Leitkegel in Längsabsperrung
      nachwarnung: 30,           // Abstand nach Arbeitsstelle für VZ 123 Gegenrichtung
      mindestBreiteFahrbahn: 3.0,  // Mindestrestfahrbahnbreite
      mindestBreiteGehweg: 1.30,   // Mindestrestgehwegbreite (1.50 ideal)
    },
    innerorts_30: {
      vorwarnAbstand: 30,
      sicherheitsAbstand: 3,
      ueberleitung: 5,
      schutzraum: 0.30,
      leitbakenAbstand: 4,
      leitkegel_abstand: 2,
      nachwarnung: 20,
      mindestBreiteFahrbahn: 2.75,
      mindestBreiteGehweg: 1.30,
    }
  };

  // ─── Regelplan-Definitionen ───────────────────────────────
  // Jeder Regelplan definiert:
  //   - name, beschreibung
  //   - vz: Verkehrszeichen mit relativer Position (0..1 entlang Linie, offset in m)
  //   - absperrung: Absperrelemente (Schranken, Baken, Kegel)
  //   - arbeitsstelle: Position und Breite der Arbeitsstelle
  //   - massketten: automatische Bemaßungen
  const REGELPLÄNE = {

    // ── B I/1: Arbeitsstelle neben der Fahrbahn ──
    'BI1': {
      id: 'BI1',
      name: 'B I/1',
      titel: 'Arbeitsstelle neben der Fahrbahn',
      beschreibung: 'Arbeitsstelle auf Gehweg/Grünstreifen, keine Fahrbahneinschränkung',
      kategorie: 'B_I',
      // Verkehrszeichen: position = Anteil der Gesamtlänge, seite = links/rechts/mitte, offset = seitl. Abstand in m
      verkehrszeichen: [
        { vz: '123', position: 0.0, seite: 'rechts', offset: 1.5, label: 'Baustelle' },
        { vz: '123', position: 1.0, seite: 'rechts', offset: 1.5, label: 'Baustelle', richtung: 'gegen' },
      ],
      absperrung: {
        typ: 'schranke',
        positionen: [
          { start: 0.15, ende: 0.85, seite: 'angrenzend', element: 'absperrschranke' },
        ]
      },
      warnleuchten: [
        { position: 0.15, seite: 'angrenzend' },
        { position: 0.50, seite: 'angrenzend' },
        { position: 0.85, seite: 'angrenzend' },
      ],
      arbeitsstelle: { start: 0.20, ende: 0.80, breite: 2.0, seite: 'angrenzend' },
    },

    // ── B I/2: Halbseitige Sperrung mit Gegenverkehrsregelung ──
    'BI2': {
      id: 'BI2',
      name: 'B I/2',
      titel: 'Arbeitsstelle auf der Fahrbahn – halbseitige Sperrung',
      beschreibung: 'Einengung auf eine Fahrspur, Gegenverkehr durch Vorrang (Z 208/Z 308)',
      kategorie: 'B_I',
      verkehrszeichen: [
        { vz: '123', position: -0.15, seite: 'rechts', offset: 1.5, label: 'Baustelle' },
        { vz: '208', position: -0.05, seite: 'rechts', offset: 1.5, label: 'Vorrang Gegenverkehr' },
        { vz: '123', position: 1.15, seite: 'links', offset: 1.5, label: 'Baustelle', richtung: 'gegen' },
        { vz: '308', position: 1.05, seite: 'links', offset: 1.5, label: 'Vorrang vor Gegenverkehr', richtung: 'gegen' },
        { vz: '600', position: 0.0, seite: 'mitte_links', offset: 0, label: 'Absperrschranke', istSchranke: true },
        { vz: '600', position: 1.0, seite: 'mitte_links', offset: 0, label: 'Absperrschranke', istSchranke: true },
      ],
      absperrung: {
        typ: 'laengs',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'links', element: 'leitkegel', abstand: 3 },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'links' },
        { position: 0.5, seite: 'links' },
        { position: 1.0, seite: 'links' },
      ],
      arbeitsstelle: { start: 0.15, ende: 0.85, breite: 3.0, seite: 'links' },
    },

    // ── B I/3: Halbseitige Sperrung mit Ampel ──
    'BI3': {
      id: 'BI3',
      name: 'B I/3',
      titel: 'Arbeitsstelle auf der Fahrbahn – Ampelregelung',
      beschreibung: 'Halbseitige Sperrung mit Baustellenampel (Lichtsignalanlage)',
      kategorie: 'B_I',
      verkehrszeichen: [
        { vz: '123', position: -0.15, seite: 'rechts', offset: 1.5, label: 'Baustelle' },
        { vz: 'LSA', position: -0.02, seite: 'rechts', offset: 0.5, label: 'Baustellenampel', istAmpel: true },
        { vz: '123', position: 1.15, seite: 'links', offset: 1.5, label: 'Baustelle', richtung: 'gegen' },
        { vz: 'LSA', position: 1.02, seite: 'links', offset: 0.5, label: 'Baustellenampel', istAmpel: true, richtung: 'gegen' },
      ],
      absperrung: {
        typ: 'laengs',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'links', element: 'leitkegel', abstand: 3 },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'links' },
        { position: 0.5, seite: 'links' },
        { position: 1.0, seite: 'links' },
      ],
      arbeitsstelle: { start: 0.15, ende: 0.85, breite: 3.0, seite: 'links' },
    },

    // ── B II/1: Gehwegeinengung ──
    'BII1': {
      id: 'BII1',
      name: 'B II/1',
      titel: 'Arbeiten im Gehwegbereich – Einengung',
      beschreibung: 'Gehweg eingeengt, Restgehweg ≥1,30m, kein Ausweichen auf Fahrbahn',
      kategorie: 'B_II',
      verkehrszeichen: [
        { vz: '123', position: 0.0, seite: 'gehweg', offset: 0, label: 'Baustelle' },
      ],
      absperrung: {
        typ: 'gitter',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'gehweg', element: 'absperrgitter' },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'gehweg' },
        { position: 1.0, seite: 'gehweg' },
      ],
      arbeitsstelle: { start: 0.10, ende: 0.90, breite: 1.5, seite: 'gehweg' },
    },

    // ── B II/2: Gehwegsperrung – Fußgänger auf Radweg ──
    'BII2': {
      id: 'BII2',
      name: 'B II/2',
      titel: 'Gehwegsperrung – Fußgänger auf Radweg geleitet',
      beschreibung: 'Gehweg komplett gesperrt, Fußgänger über vorhandenen Radweg umgeleitet',
      kategorie: 'B_II',
      verkehrszeichen: [
        { vz: '123', position: 0.0, seite: 'gehweg', offset: 0, label: 'Baustelle' },
        { vz: '259', position: -0.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten' },
        { vz: '240', position: -0.05, seite: 'radweg', offset: 0, label: 'Gem. Geh-/Radweg' },
        { vz: '259', position: 1.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten', richtung: 'gegen' },
        { vz: '240', position: 1.05, seite: 'radweg', offset: 0, label: 'Gem. Geh-/Radweg', richtung: 'gegen' },
      ],
      absperrung: {
        typ: 'gitter',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'gehweg', element: 'absperrgitter' },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'gehweg' },
        { position: 1.0, seite: 'gehweg' },
      ],
      arbeitsstelle: { start: 0.05, ende: 0.95, breite: 2.0, seite: 'gehweg' },
    },

    // ── B II/3: Gehwegsperrung – Fußgänger auf Fahrbahn ──
    'BII3': {
      id: 'BII3',
      name: 'B II/3',
      titel: 'Gehwegsperrung – Fußgänger auf Fahrbahn geleitet',
      beschreibung: 'Gehweg gesperrt, Fußgänger werden über abgesperrten Fahrbahnbereich geführt',
      kategorie: 'B_II',
      verkehrszeichen: [
        { vz: '123', position: -0.10, seite: 'rechts', offset: 1.5, label: 'Baustelle' },
        { vz: '259', position: -0.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten' },
        { vz: '259', position: 1.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten', richtung: 'gegen' },
      ],
      absperrung: {
        typ: 'kombination',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'gehweg', element: 'absperrgitter' },
          { start: -0.02, ende: 1.02, seite: 'fahrbahn_rand', element: 'leitkegel', abstand: 3 },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'gehweg' },
        { position: 0.0, seite: 'fahrbahn_rand' },
        { position: 1.0, seite: 'gehweg' },
        { position: 1.0, seite: 'fahrbahn_rand' },
      ],
      arbeitsstelle: { start: 0.05, ende: 0.95, breite: 2.5, seite: 'gehweg' },
    },

    // ── B II/4: Gehwegsperrung mit Notgehweg auf Parkstreifen ──
    'BII4': {
      id: 'BII4',
      name: 'B II/4',
      titel: 'Gehwegsperrung – Notgehweg über Parkstreifen',
      beschreibung: 'Gehweg gesperrt, Notgehweg über vorhandenen Parkstreifen eingerichtet',
      kategorie: 'B_II',
      verkehrszeichen: [
        { vz: '123', position: -0.10, seite: 'rechts', offset: 1.5, label: 'Baustelle' },
        { vz: '283', position: -0.15, seite: 'parkstreifen', offset: 0, label: 'Halteverbot', istHVZ: true },
        { vz: '283', position: 1.15, seite: 'parkstreifen', offset: 0, label: 'Halteverbot', istHVZ: true, richtung: 'gegen' },
        { vz: '259', position: -0.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten' },
        { vz: '259', position: 1.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten', richtung: 'gegen' },
      ],
      absperrung: {
        typ: 'kombination',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'gehweg', element: 'absperrgitter' },
          { start: -0.02, ende: 1.02, seite: 'parkstreifen_aussen', element: 'absperrschranke' },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'gehweg' },
        { position: 0.0, seite: 'parkstreifen_aussen' },
        { position: 1.0, seite: 'gehweg' },
        { position: 1.0, seite: 'parkstreifen_aussen' },
      ],
      arbeitsstelle: { start: 0.05, ende: 0.95, breite: 2.0, seite: 'gehweg' },
    },

    // ── B II/5: Gehwegsperrung mit Notgehweg auf Fahrbahn ──
    'BII5': {
      id: 'BII5',
      name: 'B II/5',
      titel: 'Gehwegsperrung – Notgehweg auf Fahrbahn',
      beschreibung: 'Gehweg gesperrt, Notgehweg wird auf der Fahrbahn eingerichtet (Parkstreifen nicht vorhanden)',
      kategorie: 'B_II',
      verkehrszeichen: [
        { vz: '123', position: -0.15, seite: 'rechts', offset: 1.5, label: 'Baustelle' },
        { vz: '208', position: -0.05, seite: 'rechts', offset: 1.5, label: 'Vorrang Gegenverkehr' },
        { vz: '308', position: 1.05, seite: 'links', offset: 1.5, label: 'Vorrang', richtung: 'gegen' },
        { vz: '259', position: -0.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten' },
        { vz: '259', position: 1.05, seite: 'gehweg', offset: 0, label: 'Fußgänger verboten', richtung: 'gegen' },
      ],
      absperrung: {
        typ: 'kombination',
        positionen: [
          { start: 0.0, ende: 1.0, seite: 'gehweg', element: 'absperrgitter' },
          { start: -0.02, ende: 1.02, seite: 'fahrbahn_rand', element: 'leitkegel', abstand: 3 },
        ]
      },
      warnleuchten: [
        { position: 0.0, seite: 'gehweg' },
        { position: 0.0, seite: 'fahrbahn_rand' },
        { position: 1.0, seite: 'gehweg' },
        { position: 1.0, seite: 'fahrbahn_rand' },
      ],
      arbeitsstelle: { start: 0.05, ende: 0.95, breite: 2.5, seite: 'gehweg' },
    },
  };


  // ─── SVG Symbol Generators ────────────────────────────────
  // Jedes Symbol wird als SVG-Group generiert und per transform positioniert

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createSVGElement(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // Absperrschranke (rot-weiß gestreift)
  function svgAbsperrschranke(length, height = 8) {
    const g = createSVGElement('g', { class: 'absperrschranke' });
    const stripeW = 6;
    const numStripes = Math.ceil(length / stripeW);

    // Hintergrund weiß
    g.appendChild(createSVGElement('rect', {
      x: 0, y: 0, width: length, height: height,
      fill: '#fff', stroke: '#333', 'stroke-width': 0.5, rx: 1
    }));

    // Rote Streifen diagonal
    for (let i = -1; i < numStripes + 2; i++) {
      const path = createSVGElement('path', {
        d: `M${i * stripeW},0 L${i * stripeW + stripeW / 2},0 L${i * stripeW + stripeW},${height} L${i * stripeW + stripeW / 2},${height} Z`,
        fill: '#CC0000',
        'clip-path': `inset(0 0 0 0)`
      });
      g.appendChild(path);
    }

    // Clip-Rect
    const clipRect = createSVGElement('rect', {
      x: 0, y: 0, width: length, height: height,
      fill: 'none', stroke: '#666', 'stroke-width': 0.8, rx: 1
    });
    g.appendChild(clipRect);

    return g;
  }

  // Leitkegel (orange Kegel, Draufsicht)
  function svgLeitkegel(size = 6) {
    const g = createSVGElement('g', { class: 'leitkegel' });
    // Orange Kreis mit weißen Streifen
    g.appendChild(createSVGElement('circle', {
      cx: size / 2, cy: size / 2, r: size / 2,
      fill: '#FF6600', stroke: '#CC4400', 'stroke-width': 0.5
    }));
    g.appendChild(createSVGElement('circle', {
      cx: size / 2, cy: size / 2, r: size / 2 - 1.5,
      fill: 'none', stroke: '#fff', 'stroke-width': 1
    }));
    return g;
  }

  // Warnleuchte (gelber Punkt)
  function svgWarnleuchte(size = 5) {
    const g = createSVGElement('g', { class: 'warnleuchte' });
    g.appendChild(createSVGElement('circle', {
      cx: size / 2, cy: size / 2, r: size / 2,
      fill: '#FFD700', stroke: '#CC9900', 'stroke-width': 0.5,
      class: 'warnleuchte-glow'
    }));
    // Innerer heller Punkt
    g.appendChild(createSVGElement('circle', {
      cx: size / 2, cy: size / 2, r: 1.5,
      fill: '#FFF8DC', opacity: 0.8
    }));
    return g;
  }

  // Absperrgitter (rotes Gitter, Draufsicht)
  function svgAbsperrgitter(length, height = 5) {
    const g = createSVGElement('g', { class: 'absperrgitter' });
    g.appendChild(createSVGElement('rect', {
      x: 0, y: 0, width: length, height: height,
      fill: '#FFF', stroke: '#CC0000', 'stroke-width': 0.8, rx: 0.5,
      'stroke-dasharray': '3,2'
    }));
    // Diagonale rote Streifen
    for (let i = 0; i < length; i += 4) {
      g.appendChild(createSVGElement('line', {
        x1: i, y1: 0, x2: i + height, y2: height,
        stroke: '#CC0000', 'stroke-width': 0.6
      }));
    }
    return g;
  }

  // Verkehrszeichen-Icon (Kreis mit VZ-Nummer)
  function svgVZIcon(vzNummer, size = 14) {
    const g = createSVGElement('g', { class: 'vz-icon' });

    // Hintergrund
    if (vzNummer === '123') {
      // Dreieckig (Baustelle)
      g.appendChild(createSVGElement('polygon', {
        points: `${size / 2},1 ${size - 1},${size - 1} 1,${size - 1}`,
        fill: '#FFF', stroke: '#CC0000', 'stroke-width': 1.2
      }));
      g.appendChild(createSVGElement('text', {
        x: size / 2, y: size - 3, 'text-anchor': 'middle',
        'font-size': 5, fill: '#111', 'font-family': 'monospace', 'font-weight': 'bold'
      })).textContent = '⚠';
    } else if (['250', '259', '267', '283'].includes(vzNummer)) {
      // Rundes Verbotszeichen
      g.appendChild(createSVGElement('circle', {
        cx: size / 2, cy: size / 2, r: size / 2 - 1,
        fill: '#FFF', stroke: '#CC0000', 'stroke-width': 1.5
      }));
      g.appendChild(createSVGElement('text', {
        x: size / 2, y: size / 2 + 2.5, 'text-anchor': 'middle',
        'font-size': 5.5, fill: '#111', 'font-family': 'sans-serif', 'font-weight': 'bold'
      })).textContent = vzNummer;
    } else if (['208', '308'].includes(vzNummer)) {
      // Rundes Vorrang-Zeichen
      g.appendChild(createSVGElement('circle', {
        cx: size / 2, cy: size / 2, r: size / 2 - 1,
        fill: vzNummer === '308' ? '#0054A6' : '#FFF',
        stroke: vzNummer === '308' ? '#0054A6' : '#CC0000', 'stroke-width': 1.5
      }));
      g.appendChild(createSVGElement('text', {
        x: size / 2, y: size / 2 + 2.5, 'text-anchor': 'middle',
        'font-size': 5.5, fill: vzNummer === '308' ? '#FFF' : '#CC0000',
        'font-family': 'sans-serif', 'font-weight': 'bold'
      })).textContent = vzNummer;
    } else if (vzNummer === '240') {
      // Rundes Gebotszeichen (blau)
      g.appendChild(createSVGElement('circle', {
        cx: size / 2, cy: size / 2, r: size / 2 - 1,
        fill: '#0054A6', stroke: '#003A75', 'stroke-width': 1.2
      }));
      g.appendChild(createSVGElement('text', {
        x: size / 2, y: size / 2 + 2.5, 'text-anchor': 'middle',
        'font-size': 5, fill: '#FFF', 'font-family': 'sans-serif', 'font-weight': 'bold'
      })).textContent = '240';
    } else if (vzNummer === 'LSA') {
      // Ampel-Symbol
      g.appendChild(createSVGElement('rect', {
        x: size / 2 - 3, y: 1, width: 6, height: size - 2,
        fill: '#333', rx: 1.5
      }));
      [['#CC0000', 3], ['#FFAA00', size / 2], ['#00AA00', size - 4]].forEach(([c, cy]) => {
        g.appendChild(createSVGElement('circle', {
          cx: size / 2, cy, r: 1.8, fill: c
        }));
      });
    } else if (vzNummer === '600') {
      // Absperrschranke mini
      g.appendChild(createSVGElement('rect', {
        x: 0, y: size / 2 - 2, width: size, height: 4,
        fill: '#FFF', stroke: '#CC0000', 'stroke-width': 0.8
      }));
      for (let i = 0; i < size; i += 3) {
        g.appendChild(createSVGElement('rect', {
          x: i, y: size / 2 - 2, width: 1.5, height: 4,
          fill: '#CC0000'
        }));
      }
    } else {
      // Generisch
      g.appendChild(createSVGElement('rect', {
        x: 1, y: 1, width: size - 2, height: size - 2,
        fill: '#EEE', stroke: '#666', 'stroke-width': 0.8, rx: 2
      }));
      g.appendChild(createSVGElement('text', {
        x: size / 2, y: size / 2 + 2, 'text-anchor': 'middle',
        'font-size': 5, fill: '#333', 'font-family': 'sans-serif'
      })).textContent = vzNummer;
    }

    return g;
  }

  // Arbeitsstelle (schraffierte Fläche)
  function svgArbeitsstelle(w, h) {
    const g = createSVGElement('g', { class: 'arbeitsstelle' });

    // Definiere Schraffur-Pattern
    const patternId = 'hatch-' + Math.random().toString(36).slice(2, 8);
    const defs = createSVGElement('defs', {});
    const pattern = createSVGElement('pattern', {
      id: patternId, width: 6, height: 6,
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
    });
    pattern.appendChild(createSVGElement('line', {
      x1: 0, y1: 0, x2: 0, y2: 6,
      stroke: '#E65100', 'stroke-width': 1.5, opacity: 0.4
    }));
    defs.appendChild(pattern);
    g.appendChild(defs);

    // Fläche
    g.appendChild(createSVGElement('rect', {
      x: 0, y: 0, width: w, height: h,
      fill: `url(#${patternId})`, stroke: '#E65100', 'stroke-width': 0.8,
      'stroke-dasharray': '4,2', rx: 1, opacity: 0.8
    }));

    // Label
    g.appendChild(createSVGElement('text', {
      x: w / 2, y: h / 2 + 3, 'text-anchor': 'middle',
      'font-size': 7, fill: '#BF360C', 'font-family': 'sans-serif', 'font-weight': 'bold',
      opacity: 0.6
    })).textContent = 'Arbeitsstelle';

    return g;
  }


  // ─── Hauptfunktion: Regelplan als SVG-Overlay generieren ──
  // Nimmt eine Polyline (Array von [lat,lng]) und generiert
  // ein Leaflet-SVG-Overlay mit allen Elementen des Regelplans

  function generateOverlay(map, polylineLatLngs, regelplanId, seite, options = {}) {
    const plan = REGELPLÄNE[regelplanId];
    if (!plan) {
      console.error('Regelplan nicht gefunden:', regelplanId);
      return null;
    }

    const speed = options.speed || 50;
    const distances = speed <= 30 ? RSA_DISTANCES.innerorts_30 : RSA_DISTANCES.innerorts_50;
    const fahrbahnBreite = options.fahrbahnBreite || 6.5; // m
    const scale = options.scale || getMapScale(map);

    // Polyline in Pixel umrechnen
    const pixelPoints = polylineLatLngs.map(ll => map.latLngToLayerPoint(L.latLng(ll)));

    // Richtungsvektor und Normale berechnen
    const lineInfo = calculateLineInfo(pixelPoints);

    // Seitenfaktor: "rechts" = +1, "links" = -1 (in Fahrtrichtung)
    const seiteFaktor = seite === 'links' ? -1 : 1;

    // SVG-Container
    const svgOverlay = L.svg({ interactive: true });
    svgOverlay.addTo(map);
    const svgRoot = svgOverlay._rootGroup || svgOverlay._container.querySelector('g');

    const mainGroup = createSVGElement('g', {
      class: `regelplan-overlay rp-${regelplanId}`,
      'data-regelplan': regelplanId,
      'data-seite': seite
    });

    // ── 1. Arbeitsstelle zeichnen ──
    if (plan.arbeitsstelle) {
      const as = plan.arbeitsstelle;
      const startPt = interpolatePoint(pixelPoints, as.start);
      const endPt = interpolatePoint(pixelPoints, as.ende);
      const asLength = distance(startPt, endPt);
      const asWidth = as.breite * scale;
      const angle = angleBetween(startPt, endPt);

      const asGroup = svgArbeitsstelle(asLength, asWidth);
      const offsetY = seiteFaktor * (fahrbahnBreite / 2) * scale;

      asGroup.setAttribute('transform',
        `translate(${startPt.x},${startPt.y + offsetY}) rotate(${angle},0,0)`
      );
      mainGroup.appendChild(asGroup);
    }

    // ── 2. Absperrelemente zeichnen ──
    if (plan.absperrung) {
      plan.absperrung.positionen.forEach(pos => {
        const startPt = interpolatePoint(pixelPoints, Math.max(0, pos.start));
        const endPt = interpolatePoint(pixelPoints, Math.min(1, pos.ende));
        const segLength = distance(startPt, endPt);
        const angle = angleBetween(startPt, endPt);

        let offsetY = 0;
        if (pos.seite === 'links') offsetY = -seiteFaktor * (fahrbahnBreite / 4) * scale;
        if (pos.seite === 'angrenzend') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 1) * scale;
        if (pos.seite === 'gehweg') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 2) * scale;
        if (pos.seite === 'fahrbahn_rand') offsetY = seiteFaktor * (fahrbahnBreite / 2 - 1) * scale;
        if (pos.seite === 'parkstreifen_aussen') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 4) * scale;

        let element;
        if (pos.element === 'absperrschranke') {
          element = svgAbsperrschranke(segLength, 6);
        } else if (pos.element === 'absperrgitter') {
          element = svgAbsperrgitter(segLength, 4);
        } else if (pos.element === 'leitkegel') {
          // Mehrere Kegel im Abstand
          const kegelGroup = createSVGElement('g', {});
          const abstand = (pos.abstand || 3) * scale;
          const numKegel = Math.floor(segLength / abstand) + 1;
          for (let i = 0; i < numKegel; i++) {
            const kegel = svgLeitkegel(5);
            kegel.setAttribute('transform', `translate(${i * abstand},0)`);
            kegelGroup.appendChild(kegel);
          }
          element = kegelGroup;
        }

        if (element) {
          element.setAttribute('transform',
            `translate(${startPt.x},${startPt.y + offsetY}) rotate(${angle},0,0)`
          );
          mainGroup.appendChild(element);
        }
      });
    }

    // ── 3. Warnleuchten ──
    if (plan.warnleuchten) {
      plan.warnleuchten.forEach(wl => {
        const pt = interpolatePoint(pixelPoints, Math.max(0, Math.min(1, wl.position)));
        let offsetY = 0;
        if (wl.seite === 'links') offsetY = -seiteFaktor * (fahrbahnBreite / 4) * scale;
        if (wl.seite === 'angrenzend') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 1) * scale;
        if (wl.seite === 'gehweg') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 2) * scale;
        if (wl.seite === 'fahrbahn_rand') offsetY = seiteFaktor * (fahrbahnBreite / 2 - 1) * scale;
        if (wl.seite === 'parkstreifen_aussen') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 4) * scale;

        const leuchte = svgWarnleuchte(5);
        leuchte.setAttribute('transform', `translate(${pt.x - 2.5},${pt.y + offsetY - 2.5})`);
        mainGroup.appendChild(leuchte);
      });
    }

    // ── 4. Verkehrszeichen ──
    if (plan.verkehrszeichen) {
      plan.verkehrszeichen.forEach(vz => {
        const clampedPos = Math.max(0, Math.min(1, vz.position));
        const pt = interpolatePoint(pixelPoints, clampedPos);

        // Position außerhalb der Linie für VZ mit negativer/über-1 Position
        let extraOffset = 0;
        if (vz.position < 0) extraOffset = vz.position * totalLength(pixelPoints) * scale;
        if (vz.position > 1) extraOffset = (vz.position - 1) * totalLength(pixelPoints) * scale;

        let offsetY = 0;
        let offsetX = extraOffset;
        if (vz.seite === 'rechts') offsetY = seiteFaktor * (fahrbahnBreite / 2 + vz.offset + 1) * scale;
        if (vz.seite === 'links') offsetY = -seiteFaktor * (fahrbahnBreite / 2 + vz.offset + 1) * scale;
        if (vz.seite === 'mitte_links') offsetY = -seiteFaktor * (fahrbahnBreite / 4) * scale;
        if (vz.seite === 'gehweg') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 3) * scale;
        if (vz.seite === 'radweg') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 5) * scale;
        if (vz.seite === 'parkstreifen') offsetY = seiteFaktor * (fahrbahnBreite / 2 + 4) * scale;

        const vzIcon = svgVZIcon(vz.vz, 16);
        vzIcon.setAttribute('transform', `translate(${pt.x + offsetX - 8},${pt.y + offsetY - 8})`);

        // Label
        const label = createSVGElement('text', {
          x: pt.x + offsetX, y: pt.y + offsetY + 14,
          'text-anchor': 'middle', 'font-size': 6, fill: '#333',
          'font-family': 'sans-serif', 'font-weight': 'bold'
        });
        label.textContent = `VZ ${vz.vz}`;

        mainGroup.appendChild(vzIcon);
        mainGroup.appendChild(label);
      });
    }

    svgRoot.appendChild(mainGroup);

    return {
      overlay: svgOverlay,
      group: mainGroup,
      plan: plan,
      distances: distances,
      update: () => {
        // Re-render bei Zoom-Änderung
        svgRoot.removeChild(mainGroup);
        const newResult = generateOverlay(map, polylineLatLngs, regelplanId, seite, options);
        return newResult;
      },
      remove: () => {
        map.removeLayer(svgOverlay);
      }
    };
  }


  // ─── Geometrie-Hilfsfunktionen ────────────────────────────

  function calculateLineInfo(points) {
    if (points.length < 2) return { direction: { x: 1, y: 0 }, normal: { x: 0, y: -1 }, length: 0 };
    const dx = points[points.length - 1].x - points[0].x;
    const dy = points[points.length - 1].y - points[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      direction: { x: dx / len, y: dy / len },
      normal: { x: -dy / len, y: dx / len },
      length: len
    };
  }

  function interpolatePoint(points, t) {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    t = Math.max(0, Math.min(1, t));
    const totalLen = totalLength(points);
    let targetLen = t * totalLen;
    let accumulated = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const segLen = distance(points[i], points[i + 1]);
      if (accumulated + segLen >= targetLen) {
        const segT = (targetLen - accumulated) / segLen;
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * segT,
          y: points[i].y + (points[i + 1].y - points[i].y) * segT,
        };
      }
      accumulated += segLen;
    }
    return points[points.length - 1];
  }

  function distance(a, b) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  function totalLength(points) {
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) len += distance(points[i], points[i + 1]);
    return len;
  }

  function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
  }

  function getMapScale(map) {
    // Pixel pro Meter bei aktuellem Zoom
    const center = map.getCenter();
    const p1 = map.latLngToLayerPoint(center);
    const p2 = map.latLngToLayerPoint(L.latLng(center.lat, center.lng + 0.00001));
    const pixelPerDeg = distance(p1, p2) / 0.00001;
    const meterPerDeg = 111320 * Math.cos(center.lat * Math.PI / 180);
    return pixelPerDeg / meterPerDeg; // pixel per meter
  }


  // ─── Public API ───────────────────────────────────────────
  return {
    REGELPLÄNE,
    RSA_DISTANCES,
    generateOverlay,
    getMapScale,
    // Symbol-Generatoren exportieren für externe Nutzung
    svg: {
      absperrschranke: svgAbsperrschranke,
      leitkegel: svgLeitkegel,
      warnleuchte: svgWarnleuchte,
      absperrgitter: svgAbsperrgitter,
      vzIcon: svgVZIcon,
      arbeitsstelle: svgArbeitsstelle,
    }
  };
})();
