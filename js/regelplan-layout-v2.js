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

  function resolveSideOffset(context, sideRef, rawOffset) {
    var offset = rawOffset || 0;
    if (sideRef === 'roadEdge') {
      return context.sideSign * offset;
    }
    if (sideRef === 'siteEdge') {
      return context.sideSign * (context.workWidth + offset);
    }
    return context.sideSign * offset;
  }

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
    var segmentLength = 2.0;
    var gap = 0.05;
    var runLength = context.totalLength;
    var count = Math.max(1, Math.floor(runLength / (segmentLength + gap)));
    var usedLength = count * segmentLength + (count - 1) * gap;
    var padding = (runLength - usedLength) / 2;
    var sideOffset = resolveSideOffset(context, element.sideRef, element.offset);
    var index;

    for (index = 0; index < count; index++) {
      var along = padding + index * (segmentLength + gap) + segmentLength / 2;
      var placement = RegelplanGeometryV2.pointAtMeters(
        context.referenceLine,
        along,
        context.totalLength,
        sideOffset,
        0
      );

      scene.items.push({
        kind: 'barrier',
        role: element.role,
        asset: element.asset,
        point: placement.p,
        bearing: placement.b,
        orientation: 'longitudinal',
        widthMeters: segmentLength
      });
    }
  }

  function buildBeaconRow(scene, context, element) {
    var spacing = element.spacing || 9;
    var count = Math.max(2, Math.floor(context.totalLength / spacing) + 1);
    var sideOffset = resolveSideOffset(context, element.sideRef, element.offset);
    var i;

    for (i = 0; i < count; i++) {
      var along = count > 1 ? i * context.totalLength / (count - 1) : context.totalLength / 2;
      var placement = RegelplanGeometryV2.pointAtMeters(
        context.referenceLine,
        along,
        context.totalLength,
        sideOffset,
        0
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

  function buildValidations(context, plan) {
    var validations = [];
    var remainingWidth;
    var i;

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

  function buildScene(input) {
    var plan = RegelplanCatalogV2.getPlan(input.planId);
    var context;
    var scene;
    var i;

    if (!plan) {
      return null;
    }

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
      if (plan.elements[i].type === 'warning_pair') {
        buildWarningPair(scene, context, plan.elements[i]);
      } else if (plan.elements[i].type === 'cross_barrier') {
        buildCrossBarrier(scene, context, plan.elements[i]);
      } else if (plan.elements[i].type === 'longitudinal_barrier_row') {
        buildLongitudinalBarrierRow(scene, context, plan.elements[i]);
      } else if (plan.elements[i].type === 'beacon_row') {
        buildBeaconRow(scene, context, plan.elements[i]);
      }
    }

    return scene;
  }

  return {
    buildScene: buildScene
  };
})();
