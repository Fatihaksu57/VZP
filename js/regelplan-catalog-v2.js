// ═══════════════════════════════════════════════════════════════
// VZP Editor — Regelplan Catalog v2.1
// ═══════════════════════════════════════════════════════════════
// Deklarativer Katalog aller unterstuetzten RSA-21-Regelplaene.
// Jeder Plan wird als Liste von Elementen beschrieben. Layout und
// Renderer interpretieren diese Liste — kein Plan-spezifischer Code.
//
// Element-Typen (vgl. regelplan-layout-v2.js):
//   - warning_pair           : Z 123 Vor- und Nachwarnung
//   - cross_barrier          : Querabsperrung am Anfang/Ende
//   - longitudinal_barrier_row : Laengs-Schrankengitter (rot/weiss)
//   - beacon_row             : Leitbakenreihe mit Abstand RSA-konform
//   - sign_pair              : Paar von VZ am Anfang/Ende (z.B. Z 259)
//   - single_sign            : Einzelnes VZ an start/end (z.B. Z 306/Z 308)
//   - notweg_corridor        : Notweg-Korridor auf Fahrbahn (B II/4)
//   - diagonal_baken_row     : Diagonale Leitbaken am Querabschluss (B II/4)
// ═══════════════════════════════════════════════════════════════

var RegelplanCatalogV2 = (function() {

  // RSA 21 Teil B: Vorwarn-/Nach-Warnabstaende innerorts
  var RSA_DISTANCES = {
    innerorts_50: { vorwarn: 50, sicher: 5, nachwarn: 30 },
    innerorts_30: { vorwarn: 30, sicher: 3, nachwarn: 20 }
  };

  // ─── Gemeinsame Bausteine ────────────────────────────────────
  function warningZ123() {
    return { type: 'warning_pair', sign: '123', distanceProfile: 'innerorts' };
  }
  function crossBarrierStart() {
    return { type: 'cross_barrier', at: 'start', widthRef: 'workWidth' };
  }
  function crossBarrierEnd() {
    return { type: 'cross_barrier', at: 'end', widthRef: 'workWidth' };
  }
  function longitudinalBarrierRoadside() {
    return {
      type: 'longitudinal_barrier_row',
      sideRef: 'roadEdge',
      offset: 0.2,
      asset: 'absperrschranke.svg',
      role: 'roadside_barrier'
    };
  }
  function longitudinalBarrierSiteside() {
    return {
      type: 'longitudinal_barrier_row',
      sideRef: 'siteEdge',
      offset: -0.15,
      asset: 'absperrschranke_leuchte.svg',
      role: 'site_barrier'
    };
  }
  function centerBeaconRow() {
    // RSA 21: doppelseitige Leitbaken, Abstand max. 9 m
    return {
      type: 'beacon_row',
      sideRef: 'centerLine',
      offset: 0,
      spacing: 9,
      role: 'center_beacon_row'
    };
  }

  // ─── Plan-Definitionen ───────────────────────────────────────
  var PLANS = {

    // B II/1 — Paralleler Geh-/Radweg, Sperrung Radweg
    BII1: {
      id: 'BII1',
      name: 'B II/1',
      titel: 'Paralleler Geh-/Radweg – Sperrung Radweg',
      beschreibung: 'Radweg gesperrt, geringe Einengung',
      supported: true,
      elements: [
        warningZ123(),
        crossBarrierStart(),
        crossBarrierEnd(),
        longitudinalBarrierRoadside(),
        longitudinalBarrierSiteside(),
        centerBeaconRow()
      ],
      constraints: [
        { code: 'RESTWEG_LT_130', kind: 'min_remaining_width', min: 1.3, severity: 'warning' }
      ]
    },

    // B II/2 — B II/1 + Umleitungszeichen Z 259 (Fahrrad verboten)
    BII2: {
      id: 'BII2',
      name: 'B II/2',
      titel: 'Paralleler Geh-/Radweg – Sperrung mit Umleitung',
      beschreibung: 'Umleitung ueber gem. Geh-/Radweg (Z 259)',
      supported: true,
      elements: [
        warningZ123(),
        crossBarrierStart(),
        crossBarrierEnd(),
        longitudinalBarrierRoadside(),
        longitudinalBarrierSiteside(),
        centerBeaconRow(),
        {
          type: 'sign_pair',
          sign: '259',
          sideRef: 'siteEdge',
          sideOffset: 0.8,
          alongStart: -3,
          alongEnd: 3,
          role: 'umleitung_radfahrer'
        }
      ],
      constraints: [
        { code: 'RESTWEG_LT_130', kind: 'min_remaining_width', min: 1.3, severity: 'warning' }
      ]
    },

    // B II/3 — Nicht benutzungspfl. Radweg (ohne mittlere Bakenreihe)
    BII3: {
      id: 'BII3',
      name: 'B II/3',
      titel: 'Nicht benutzungspfl. Radweg – Sperrung',
      beschreibung: 'Schrankengitter zur Fahrbahn, keine Leitbaken mittig',
      supported: true,
      elements: [
        warningZ123(),
        crossBarrierStart(),
        crossBarrierEnd(),
        longitudinalBarrierRoadside(),
        longitudinalBarrierSiteside()
        // kein centerBeaconRow — Unterschied zu B II/1
      ],
      constraints: []
    },

    // B II/4 — Gehwegsperrung, Notweg auf Fahrbahn
    BII4: {
      id: 'BII4',
      name: 'B II/4',
      titel: 'Gehwegsperrung – Notweg auf Fahrbahn',
      beschreibung: 'Notweg 1,30 m, 3 diagonale Leitbaken, Z 259',
      supported: true,
      elements: [
        warningZ123(),
        { type: 'notweg_corridor', width: 1.3, label: 'Notweg 1,30 m' },
        crossBarrierStart(),
        crossBarrierEnd(),
        longitudinalBarrierRoadside(),
        longitudinalBarrierSiteside(),
        centerBeaconRow(),
        { type: 'diagonal_baken_row', at: 'start', count: 3, role: 'einlauf_baken' },
        { type: 'diagonal_baken_row', at: 'end',   count: 3, role: 'auslauf_baken' },
        {
          type: 'sign_pair',
          sign: '259',
          sideRef: 'siteEdge',
          sideOffset: 0.8,
          alongStart: -2.2,
          alongEnd: 2.2,
          role: 'gehweg_gesperrt'
        }
      ],
      constraints: []
    },

    // B II/5 — Halbseitige Sperrung + Verkehrsregelung (Z 306 / Z 308)
    BII5: {
      id: 'BII5',
      name: 'B II/5',
      titel: 'Halbseitige Sperrung + Verkehrsregelung',
      beschreibung: 'Z 306 (Vorfahrt) / Z 308 (Vorrang Gegenverkehr)',
      supported: true,
      elements: [
        warningZ123(),
        crossBarrierStart(),
        crossBarrierEnd(),
        longitudinalBarrierRoadside(),
        longitudinalBarrierSiteside(),
        centerBeaconRow(),
        {
          type: 'single_sign',
          sign: '306',
          at: 'start',
          sideRef: 'roadEdge',
          sideOffset: -2,
          alongOffset: -8,
          rotation: 0,
          role: 'vorfahrt'
        },
        {
          type: 'single_sign',
          sign: '308',
          at: 'end',
          sideRef: 'roadEdge',
          sideOffset: -2,
          alongOffset: 8,
          rotation: 180,
          role: 'vorrang_gegenverkehr'
        }
      ],
      constraints: []
    }

  };

  function getPlan(id) {
    return PLANS[id] || null;
  }

  function supports(id) {
    var plan = getPlan(id);
    return !!(plan && plan.supported);
  }

  return {
    RSA_DISTANCES: RSA_DISTANCES,
    PLANS: PLANS,
    getPlan: getPlan,
    supports: supports
  };
})();
