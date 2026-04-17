// ═══════════════════════════════════════════════════════════════
// VZP Editor — Regelplan Layout Engine v2.1
// ═══════════════════════════════════════════════════════════════
// Interpretiert die Element-Listen aus RegelplanCatalogV2 und
// produziert eine Szene (items[]) fuer den Renderer.
//
// Alle geometrischen Operationen kommen aus RegelplanGeometryV2.
// Die Szene enthaelt ausserdem workZonePolygon (Baufeldflaeche)
// sowie Laengen/Validierungen.
// ═══════════════════════════════════════════════════════════════

var RegelplanLayoutV2 = (function() {

  function getDistanceProfile(speed) {
    return speed <= 30
      ? RegelplanCatalogV2.RSA_DISTANCES.innerorts_30
      : RegelplanCatalogV2.RSA_DISTANCES.innerorts_50;
  }

  function makeContext(referenceLine, side, opts) {
    var workWidth = opts.arbeitsstelleBreite || 2.0;
    var existingPathWidth = opts.gehwegBreite || null;
    var speed = opts.speed || 50;
    var totalLength = RegelplanGeometryV2.polylineLength(referenceLine);

    return {
      referenceLine: referenceLine,
      side: side,
      sideSign: side === 'links' ? -1 : 1,
      speed: speed,
      workWidth: workWidth,
      existingPathWidth: existingPathWidth,
      totalLength: totalLength,
      distanceProfile: getDistanceProfile(speed)
    };
  }

  // sideRef: 'roadEdge' (Fahrbahnkante), 'siteEdge' (Baufeld-Aussenkante),
  //          'centerLine' (Baufeldmitte)
  function resolveSideOffset(context, sideRef, rawOffset) {
    var offset = rawOffset || 0;
    if (sideRef === 'roadEdge') {
      return context.sideSign * offset;
    }
    if (sideRef === 'siteEdge') {
      return context.sideSign * (context.workWidth + offset);
    }
    if (sideRef === 'centerLine') {
      return context.sideSign * (context.workWidth / 2 + offset);
    }
    return context.sideSign * offset;
  }

  // ─── Element-Builder ─────────────────────────────────────────

  function buildWarningPair(scene, context, element) {
    var distanceProfile = context.distanceProfile;
    var line = context.referenceLine;
    var sideOffset = -2 * context.sideSign;
    var startBearing = RegelplanGeometryV2.bearing(line[0], line[Math.min(1, line.length - 1)]);
    var endBearing = RegelplanGeometryV2.bearing(line[Math.max(0, line.length - 2)], line[line.length - 1]);
    var beforeDistance = Math.min(distanceProfile.vorwarn, context.totalLength * 0.8);
    var afterDistance = Math.min(distanceProfile.nachwarn, context.totalLength * 0.6);
    var beforePoint = RegelplanGeometryV2.offsetLatLng(line[0], startBearing + 180, beforeDistance);
    var afterPoint = RegelplanGeometryV2.offsetLatLng(line[line.length - 1], endBearing, afterDistance);

    scene.items.push({
      kind: 'sign',
      role: 'advance_warning_start',
      sign: element.sign,
      point: RegelplanGeometryV2.offsetLatLng(beforePoint, startBearing + 90, sideOffset),
      rotation: 0
    });

    scene.items.push({
      kind: 'sign',
      role: 'advance_warning_end',
      sign: element.sign,
      point: RegelplanGeometryV2.offsetLatLng(afterPoint, endBearing + 90, sideOffset),
      rotation: 180
    });
  }

  function buildCrossBarrier(scene, context, element) {
    var t = element.at === 'end' ? 1 : 0;
    var width = context.workWidth;
    var barrierPoint = RegelplanGeometryV2.pointAt(context.referenceLine, t, (width / 2) * context.sideSign, 0);
    var beaconPoint = RegelplanGeometryV2.pointAt(context.referenceLine, t, 0, 0);

    scene.items.push({
      kind: 'barrier',
      role: 'cross_barrier_' + element.at,
      asset: 'absperrschranke_leuchte.svg',
      point: barrierPoint.p,
      bearing: barrierPoint.b,
      orientation: 'cross',
      widthMeters: width
    });

    scene.items.push({
      kind: 'beacon',
      role: 'cross_barrier_beacon_' + element.at,
      point: beaconPoint.p,
      bearing: beaconPoint.b,
      variant: context.sideSign < 0 ? 'left_light' : 'right_light',
      orientation: 'upright'
    });
  }

  function buildLongitudinalBarrierRow(scene, context, element) {
    var sideOffset = resolveSideOffset(context, element.sideRef, element.offset);
    var baseBearing = RegelplanGeometryV2.bearing(
      context.referenceLine[0],
      context.referenceLine[Math.min(1, context.referenceLine.length - 1)]
    );

    scene.items.push({
      kind: 'barrier_line',
      role: element.role,
      asset: element.asset,
      line: context.referenceLine.map(function(point) {
        return RegelplanGeometryV2.offsetLatLng(point, baseBearing + 90, sideOffset);
      }),
      orientation: 'longitudinal',
      lengthMeters: context.totalLength
    });
  }

  function buildBeaconRow(scene, context, element) {
    var spacing = element.spacing || 9;
    var count = Math.max(2, Math.floor(context.totalLength / spacing) + 1);
    var sideOffset = resolveSideOffset(context, element.sideRef, element.offset);
    var i;

    for (i = 0; i < count; i++) {
      var along = count > 1 ? i * context.totalLength / (count - 1) : context.totalLength / 2;
      var placement = RegelplanGeometryV2.pointAtMeters(
        context.referenceLine, along, context.totalLength, sideOffset, 0
      );
      var isTerminal = i === 0 || i === count - 1;

      scene.items.push({
        kind: 'beacon',
        role: element.role,
        point: placement.p,
        bearing: placement.b,
        variant: context.sideSign < 0
          ? (isTerminal ? 'left_light' : 'left')
          : (isTerminal ? 'right_light' : 'right'),
        orientation: 'upright'
      });
    }
  }

  // Paar von VZ an Anfang + Ende (spiegelverkehrt ausgerichtet)
  function buildSignPair(scene, context, element) {
    var sideOffset = resolveSideOffset(context, element.sideRef, element.sideOffset);
    var startPlacement = RegelplanGeometryV2.pointAt(
      context.referenceLine, 0, sideOffset, element.alongStart || 0
    );
    var endPlacement = RegelplanGeometryV2.pointAt(
      context.referenceLine, 1, sideOffset, element.alongEnd || 0
    );

    scene.items.push({
      kind: 'sign',
      role: element.role + '_start',
      sign: element.sign,
      point: startPlacement.p,
      rotation: 0
    });

    scene.items.push({
      kind: 'sign',
      role: element.role + '_end',
      sign: element.sign,
      point: endPlacement.p,
      rotation: 180
    });
  }

  // Einzelnes VZ an start oder end mit konfigurierbaren Offsets
  function buildSingleSign(scene, context, element) {
    var t = element.at === 'end' ? 1 : 0;
    var sideOffset = resolveSideOffset(context, element.sideRef, element.sideOffset);
    var placement = RegelplanGeometryV2.pointAt(
      context.referenceLine, t, sideOffset, element.alongOffset || 0
    );

    scene.items.push({
      kind: 'sign',
      role: element.role,
      sign: element.sign,
      point: placement.p,
      rotation: element.rotation || 0
    });
  }

  // Notweg-Korridor: Polygon gegenueber der Arbeitsstelle auf der Fahrbahn
  // plus rot/weisse Begrenzungslinie zur Fahrbahn und Textlabel.
  function buildNotwegCorridor(scene, context, element) {
    var width = element.width || 1.3;
    // Korridor liegt zur Fahrbahnseite hin (sideSign entgegen arbeitsstelle)
    // Da die Arbeitsstelle auf context.sideSign liegt, ist der Notweg
    // jenseits der Fahrbahnkante, also sideSign*(-width) vom centerLine
    // Vereinfachung: wir legen ihn direkt fahrbahnseitig unmittelbar an die
    // Baustelle an (zwischen Baufeld und Fahrbahn).
    var sideSign = context.sideSign;
    var steps = Math.max(8, Math.ceil(context.totalLength / 3));
    var polygon = [];
    var i;

    // obere Kante: am referenceLine (0 Offset)
    for (i = 0; i <= steps; i++) {
      polygon.push(RegelplanGeometryV2.pointAt(context.referenceLine, i / steps, 0, 0).p);
    }
    // untere Kante: -width * sideSign (fahrbahnseitig)
    for (i = steps; i >= 0; i--) {
      polygon.push(RegelplanGeometryV2.pointAt(context.referenceLine, i / steps, -width * sideSign, 0).p);
    }

    scene.items.push({
      kind: 'notweg_polygon',
      role: 'notweg_corridor',
      polygon: polygon,
      widthMeters: width
    });

    // Rot/weisse Linie an der Fahrbahn-Aussenkante des Notwegs
    var aussenLine = [];
    for (i = 0; i <= steps; i++) {
      aussenLine.push(RegelplanGeometryV2.pointAt(context.referenceLine, i / steps, -width * sideSign, 0).p);
    }
    scene.items.push({
      kind: 'barrier_line',
      role: 'notweg_aussenkante',
      asset: 'absperrschranke.svg',
      line: aussenLine,
      orientation: 'longitudinal',
      lengthMeters: context.totalLength
    });

    // Textlabel in der Mitte des Korridors
    if (element.label) {
      var labelPlacement = RegelplanGeometryV2.pointAt(
        context.referenceLine, 0.5, -width * 0.5 * sideSign, 0
      );
      scene.items.push({
        kind: 'text_label',
        role: 'notweg_label',
        point: labelPlacement.p,
        bearing: labelPlacement.b,
        text: element.label
      });
    }
  }

  // 3 diagonale Leitbaken als Verschwenkungs-Ein-/Auslauf (B II/4)
  // Verlaufen schraeg vom Querabschluss nach aussen, imitieren RSA-Keil 1:10
  function buildDiagonalBakenRow(scene, context, element) {
    var count = element.count || 3;
    var t = element.at === 'end' ? 1 : 0;
    // Richtung nach aussen: start = rueckwaerts, end = vorwaerts
    var dir = element.at === 'end' ? -1 : 1;
    var i;

    for (i = 0; i < count; i++) {
      var ratio = count === 1 ? 0.5 : i / (count - 1);
      // seitlich: startet am Rand der Arbeitsstelle (0), endet aussen (workWidth)
      var sideOff = (0.25 + context.workWidth * ratio) * context.sideSign;
      // laengs: startet nah am Querabschluss (1.4), endet weiter weg (-1.4)
      var alongOff = (1.4 - ratio * 2.8) * dir;
      var placement = RegelplanGeometryV2.pointAt(
        context.referenceLine, t, sideOff, alongOff
      );

      scene.items.push({
        kind: 'beacon',
        role: element.role + '_' + i,
        point: placement.p,
        bearing: placement.b,
        // Diagonale Neigung leicht zur Fahrbahn
        rotation: dir * 35,
        variant: context.sideSign < 0 ? 'left_light' : 'right_light',
        orientation: 'diagonal'
      });
    }
  }

  // ─── Validierungen ───────────────────────────────────────────
  function buildValidations(context, plan) {
    var validations = [];
    var remainingWidth;
    var i;

    if (context.workWidth <= 0 || context.workWidth > 8) {
      validations.push({
        code: 'WORK_WIDTH_INVALID',
        severity: 'error',
        message: 'Arbeitsstellenbreite ist unplausibel',
        value: context.workWidth
      });
    }
    if (context.totalLength < 5) {
      validations.push({
        code: 'LINE_TOO_SHORT',
        severity: 'error',
        message: 'Baustellenlinie ist zu kurz fuer einen belastbaren Plan',
        value: context.totalLength
      });
    }
    if (!plan.constraints || context.existingPathWidth === null) {
      return validations;
    }
    remainingWidth = context.existingPathWidth - context.workWidth;
    for (i = 0; i < plan.constraints.length; i++) {
      if (plan.constraints[i].kind === 'min_remaining_width' && remainingWidth < plan.constraints[i].min) {
        validations.push({
          code: plan.constraints[i].code,
          severity: plan.constraints[i].severity,
          message: 'Restgehwegbreite unter ' + plan.constraints[i].min.toFixed(2) + ' m',
          value: remainingWidth
        });
      }
    }
    return validations;
  }

  // ─── Dispatcher ──────────────────────────────────────────────
  var BUILDERS = {
    'warning_pair':            buildWarningPair,
    'cross_barrier':           buildCrossBarrier,
    'longitudinal_barrier_row': buildLongitudinalBarrierRow,
    'beacon_row':              buildBeaconRow,
    'sign_pair':               buildSignPair,
    'single_sign':             buildSingleSign,
    'notweg_corridor':         buildNotwegCorridor,
    'diagonal_baken_row':      buildDiagonalBakenRow
  };

  function buildScene(input) {
    var plan = RegelplanCatalogV2.getPlan(input.planId);
    var context;
    var scene;
    var i;
    var element;
    var builder;

    if (!plan) return null;

    context = makeContext(input.referenceLine, input.side, input.opts || {});
    scene = {
      planId: plan.id,
      plan: plan,
      context: context,
      baustellenLaenge: context.totalLength,
      workZonePolygon: RegelplanGeometryV2.buildCorridorPolygon(
        context.referenceLine,
        context.sideSign,
        context.workWidth
      ),
      items: [],
      dimensions: [
        { kind: 'length', value: context.totalLength }
      ],
      validations: buildValidations(context, plan)
    };

    for (i = 0; i < plan.elements.length; i++) {
      element = plan.elements[i];
      builder = BUILDERS[element.type];
      if (builder) {
        builder(scene, context, element);
      } else if (typeof console !== 'undefined' && console.warn) {
        console.warn('RegelplanLayoutV2: unknown element type "' + element.type + '" in plan ' + plan.id);
      }
    }

    return scene;
  }

  return {
    buildScene: buildScene
  };
})();
