var RegelplanLeafletRendererV2 = (function() {
  function metersToPixels(map, meters) {
    var center = map.getCenter();
    var startPoint = map.latLngToContainerPoint(center);
    var endPoint = map.latLngToContainerPoint(
      RegelplanGeometryV2.offsetLatLng([center.lat, center.lng], 90, meters)
    );
    return Math.abs(endPoint.x - startPoint.x);
  }

  function barrierWidthPx(map, widthMeters) {
    return Math.max(18, Math.round(metersToPixels(map, widthMeters || 2.0)));
  }

  function barrierHeightPx(map, asset, widthPx) {
    if (asset === 'absperrschranke_leuchte.svg') {
      return Math.max(6, Math.round(widthPx * 0.28));
    }
    return Math.max(5, Math.round(widthPx * 0.22));
  }

  function beaconHeightPx(map) {
    return Math.max(20, Math.round(metersToPixels(map, 1.1)));
  }

  function beaconWidthPx(map, heightPx) {
    return Math.max(6, Math.round(heightPx * 0.3));
  }

  function signSizePx(map) {
    return Math.max(18, Math.round(metersToPixels(map, 1.0)));
  }

  function rotatedBoundingBox(widthPx, heightPx, rotationDeg) {
    var rad = rotationDeg * Math.PI / 180;
    return {
      w: Math.ceil(widthPx * Math.abs(Math.cos(rad)) + heightPx * Math.abs(Math.sin(rad))),
      h: Math.ceil(widthPx * Math.abs(Math.sin(rad)) + heightPx * Math.abs(Math.cos(rad)))
    };
  }

  function makeSvgMarker(map, layerGroup, item, widthPx, heightPx, rotationDeg, zIndex) {
    var bb = rotatedBoundingBox(widthPx, heightPx, rotationDeg);
    var marker = L.marker(item.point, {
      draggable: true,
      icon: L.divIcon({
        html: '<div style="width:' + bb.w + 'px;height:' + bb.h + 'px;display:flex;align-items:center;justify-content:center"><img src="assets/svg/' + item.asset + '" style="width:' + widthPx + 'px;height:' + heightPx + 'px;transform:rotate(' + rotationDeg + 'deg);flex-shrink:0" draggable="false"></div>',
        iconSize: [bb.w, bb.h],
        iconAnchor: [bb.w / 2, bb.h / 2],
        className: ''
      }),
      zIndexOffset: zIndex || 500
    });
    layerGroup.addLayer(marker);
    return marker;
  }

  function makeSignMarker(map, layerGroup, item) {
    var fileName = {
      '123': 'vz_123.svg',
      '208': 'vz_208.svg',
      '259': 'vz_259.svg',
      '267': 'vz_267.svg',
      '283': 'vz_283.svg',
      '306': 'vz_306.svg',
      '308': 'vz_308.svg'
    }[item.sign];
    var sizePx;
    var marker;

    if (!fileName) {
      return null;
    }

    sizePx = signSizePx(map);
    marker = L.marker(item.point, {
      draggable: true,
      icon: L.divIcon({
        html: '<img src="assets/svg/' + fileName + '" style="width:' + sizePx + 'px;height:' + sizePx + 'px;background:#fff;border-radius:2px;padding:1px;box-shadow:0 1px 3px rgba(0,0,0,.3);transform:rotate(' + (item.rotation || 0) + 'deg)" draggable="false">',
        iconSize: [sizePx, sizePx],
        iconAnchor: [sizePx / 2, sizePx / 2],
        className: ''
      }),
      zIndexOffset: 700
    });
    layerGroup.addLayer(marker);
    return marker;
  }

  function makeBarrierLine(layerGroup, item) {
    var line = item.line || [];
    if (line.length < 2) return null;

    var base = L.polyline(line, {
      color: '#1f1b14',
      weight: 7,
      opacity: 0.45,
      lineCap: 'butt',
      lineJoin: 'miter',
      interactive: false
    });
    var white = L.polyline(line, {
      color: '#ffffff',
      weight: 5,
      opacity: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      interactive: false
    });
    var red = L.polyline(line, {
      color: '#d71920',
      weight: 5,
      opacity: 1,
      dashArray: '8 6',
      lineCap: 'butt',
      lineJoin: 'miter',
      interactive: false
    });

    layerGroup.addLayer(base);
    layerGroup.addLayer(white);
    layerGroup.addLayer(red);
    return { base: base, white: white, red: red };
  }

  function renderItem(map, layerGroup, item) {
    var widthPx;
    var heightPx;

    if (item.kind === 'sign') {
      return makeSignMarker(map, layerGroup, item);
    }

    if (item.kind === 'barrier_line') {
      return makeBarrierLine(layerGroup, item);
    }

    if (item.kind === 'beacon') {
      heightPx = beaconHeightPx(map);
      widthPx = beaconWidthPx(map, heightPx);
      item.asset = {
        left: 'bake_links.svg',
        left_light: 'bake_links_leuchte.svg',
        right: 'bake_rechts.svg',
        right_light: 'bake_rechts_leuchte.svg'
      }[item.variant] || 'bake_rechts.svg';
      return makeSvgMarker(map, layerGroup, item, widthPx, heightPx, 0, 555);
    }

    if (item.kind === 'barrier') {
      widthPx = barrierWidthPx(map, item.widthMeters);
      heightPx = barrierHeightPx(map, item.asset, widthPx);
      return makeSvgMarker(
        map,
        layerGroup,
        item,
        widthPx,
        heightPx,
        item.orientation === 'cross' ? item.bearing : item.bearing - 90,
        item.orientation === 'cross' ? 570 : 510
      );
    }

    return null;
  }

  function renderScene(map, scene, layerGroup) {
    var rendered = {
      markers: [],
      polygons: []
    };
    var polygonLayer;
    var marker;
    var i;

    if (scene.workZonePolygon && scene.workZonePolygon.length) {
      polygonLayer = L.polygon(scene.workZonePolygon, {
        fillColor: '#9e9e9e',
        fillOpacity: 0.25,
        color: '#c62828',
        weight: 2,
        dashArray: '4,4',
        interactive: false
      });
      layerGroup.addLayer(polygonLayer);
      rendered.polygons.push(polygonLayer);
    }

    for (i = 0; i < scene.items.length; i++) {
      marker = renderItem(map, layerGroup, scene.items[i]);
      if (marker) {
        rendered.markers.push(marker);
      }
    }

    return rendered;
  }

  return {
    renderScene: renderScene
  };
})();

var RegelplanEngineV2 = (function() {
  var activeOverlay = null;

  function removeActive() {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
  }

  function supports(planId) {
    return typeof RegelplanCatalogV2 !== 'undefined' && RegelplanCatalogV2.supports(planId);
  }

  function generateOverlay(map, referenceLine, planId, side, opts) {
    var scene;
    var layerGroup;
    var rendered;
    var onZoom;
    var overlay;

    if (!supports(planId)) {
      return null;
    }

    removeActive();
    scene = RegelplanLayoutV2.buildScene({
      planId: planId,
      referenceLine: referenceLine,
      side: side,
      opts: opts || {}
    });

    if (!scene) {
      return null;
    }

    layerGroup = L.layerGroup().addTo(map);

    function render() {
      layerGroup.clearLayers();
      rendered = RegelplanLeafletRendererV2.renderScene(map, scene, layerGroup);
      if (overlay) {
        overlay.markers = rendered.markers;
      }
    }

    render();
    onZoom = function() {
      render();
    };
    map.on('zoomend', onZoom);

    overlay = {
      overlay: layerGroup,
      group: layerGroup,
      scene: scene,
      markers: rendered ? rendered.markers : [],
      baustellenLaenge: scene.baustellenLaenge,
      validations: scene.validations,
      remove: function() {
        map.removeLayer(layerGroup);
        map.off('zoomend', onZoom);
        if (activeOverlay === overlay) {
          activeOverlay = null;
        }
      }
    };

    activeOverlay = overlay;
    return overlay;
  }

  return {
    supports: supports,
    generateOverlay: generateOverlay,
    removeActive: removeActive
  };
})();
