var RegelplanGeometryV2 = (function() {
  function offsetLatLng(latlng, bearingDeg, distanceMeters) {
    var earthRadius = 6378137;
    var bearingRad = bearingDeg * Math.PI / 180;
    var angularDistance = distanceMeters / earthRadius;
    var latRad = latlng[0] * Math.PI / 180;
    var lngRad = latlng[1] * Math.PI / 180;
    var nextLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );
    var nextLng = lngRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLat)
    );
    return [nextLat * 180 / Math.PI, nextLng * 180 / Math.PI];
  }

  function bearing(a, b) {
    var lat1 = a[0] * Math.PI / 180;
    var lat2 = b[0] * Math.PI / 180;
    var deltaLng = (b[1] - a[1]) * Math.PI / 180;
    return Math.atan2(
      Math.sin(deltaLng) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
    ) * 180 / Math.PI;
  }

  function polylineLength(latlngs) {
    var total = 0;
    for (var i = 0; i < latlngs.length - 1; i++) {
      total += L.latLng(latlngs[i]).distanceTo(L.latLng(latlngs[i + 1]));
    }
    return total;
  }

  function interpolate(latlngs, t) {
    var totalLength = polylineLength(latlngs);
    var target = Math.max(0, Math.min(1, t)) * totalLength;
    var travelled = 0;
    for (var i = 0; i < latlngs.length - 1; i++) {
      var segmentLength = L.latLng(latlngs[i]).distanceTo(L.latLng(latlngs[i + 1]));
      if (travelled + segmentLength >= target || i === latlngs.length - 2) {
        var ratio = segmentLength > 0 ? (target - travelled) / segmentLength : 0;
        return {
          p: [
            latlngs[i][0] + (latlngs[i + 1][0] - latlngs[i][0]) * ratio,
            latlngs[i][1] + (latlngs[i + 1][1] - latlngs[i][1]) * ratio
          ],
          b: bearing(latlngs[i], latlngs[i + 1])
        };
      }
      travelled += segmentLength;
    }
    return { p: latlngs[latlngs.length - 1], b: 0 };
  }

  function pointAt(latlngs, t, sideOffset, alongOffset) {
    var result = interpolate(latlngs, Math.max(0, Math.min(1, t)));
    var point = result.p;
    if (alongOffset) {
      point = offsetLatLng(point, result.b, alongOffset);
    }
    if (sideOffset) {
      point = offsetLatLng(point, result.b + 90, sideOffset);
    }
    return { p: point, b: result.b };
  }

  function pointAtMeters(latlngs, meters, totalLength, sideOffset, alongOffset) {
    if (totalLength <= 0) {
      return pointAt(latlngs, 0, sideOffset, alongOffset);
    }
    return pointAt(latlngs, meters / totalLength, sideOffset, alongOffset);
  }

  function buildCorridorPolygon(latlngs, sideSign, widthMeters) {
    var totalLength = polylineLength(latlngs);
    var steps = Math.max(10, Math.ceil(totalLength / 2));
    var polygon = [];
    var i;

    for (i = 0; i <= steps; i++) {
      polygon.push(pointAt(latlngs, i / steps, 0.05 * sideSign, 0).p);
    }
    for (i = steps; i >= 0; i--) {
      polygon.push(pointAt(latlngs, i / steps, (widthMeters - 0.05) * sideSign, 0).p);
    }

    return polygon;
  }

  return {
    offsetLatLng: offsetLatLng,
    bearing: bearing,
    polylineLength: polylineLength,
    interpolate: interpolate,
    pointAt: pointAt,
    pointAtMeters: pointAtMeters,
    buildCorridorPolygon: buildCorridorPolygon
  };
})();
