var RegelplanCatalogV2 = (function() {
  var RSA_DISTANCES = {
    innerorts_50: { vorwarn: 50, sicher: 5, nachwarn: 30 },
    innerorts_30: { vorwarn: 30, sicher: 3, nachwarn: 20 }
  };

  var PLANS = {
    BII1: {
      id: 'BII1',
      name: 'B II/1',
      titel: 'Paralleler Geh-/Radweg - Sperrung Radweg',
      beschreibung: 'Radweg gesperrt, geringe Einengung',
      supported: true,
      elements: [
        { type: 'warning_pair', sign: '123', distanceProfile: 'innerorts' },
        { type: 'cross_barrier', at: 'start', widthRef: 'workWidth' },
        { type: 'cross_barrier', at: 'end', widthRef: 'workWidth' },
        {
          type: 'longitudinal_barrier_row',
          sideRef: 'roadEdge',
          offset: 0.2,
          asset: 'absperrschranke.svg',
          role: 'roadside_barrier'
        },
        {
          type: 'longitudinal_barrier_row',
          sideRef: 'siteEdge',
          offset: -0.15,
          asset: 'absperrschranke_leuchte.svg',
          role: 'site_barrier'
        },
        {
          type: 'beacon_row',
          sideRef: 'centerLine',
          offset: 0,
          spacing: 9,
          role: 'center_beacon_row'
        }
      ],
      constraints: [
        {
          code: 'RESTWEG_LT_130',
          kind: 'min_remaining_width',
          min: 1.3,
          severity: 'warning'
        }
      ]
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
