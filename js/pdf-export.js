// VZP Editor - PDF Export v8

const PDFExport = (() => {
  async function loadLib(url, check) {
    if (check()) return;
    return new Promise((resolve, reject) => {
      var script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function drawNorthArrow(doc, x, y, size) {
    var cx = x + size / 2;
    var cy = y + size / 2 + 4;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.setFillColor(0, 0, 0);
    doc.triangle(cx, cy - size * 0.55, cx - size * 0.22, cy + size * 0.1, cx + size * 0.22, cy + size * 0.1, 'F');
    doc.setFillColor(255, 255, 255);
    doc.triangle(cx, cy + size * 0.55, cx - size * 0.22, cy + size * 0.1, cx + size * 0.22, cy + size * 0.1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('N', cx - 1.5, cy - size * 0.6);
    doc.circle(cx, cy, size * 0.65, 'S');
  }

  function drawScaleBar(doc, x, y, mapWidthMm, mapWidthM) {
    if (!mapWidthM || !isFinite(mapWidthM)) return;
    var barM = Math.pow(10, Math.floor(Math.log10(mapWidthM * 0.25 || 1)));
    var barMm = (barM / mapWidthM) * mapWidthMm;

    if (barMm < 10) {
      barM *= 5;
      barMm *= 5;
    }
    if (barMm > 42) {
      barM /= 2;
      barMm /= 2;
    }

    doc.setLineWidth(0.25);
    for (var i = 0; i < 4; i++) {
      var fill = i % 2 === 0 ? 0 : 255;
      doc.setFillColor(fill, fill, fill);
      doc.rect(x + i * (barMm / 4), y, barMm / 4, 2.4, 'FD');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(30);
    doc.text('0', x - 1, y + 5, { align: 'right' });
    doc.text(barM + ' m', x + barMm + 1, y + 5);
  }

  function collectLegend(items) {
    var seen = {};
    (items || []).forEach(function(item) {
      if (item.kind === 'barrier') seen.barrier = 'Absperrschranke / Quersperre';
      if (item.kind === 'barrier_line') seen.barrier = 'Durchgehende rot-weisse Absperrlinie';
      if (item.kind === 'beacon') seen.beacon = 'Leitbake / Leitbakenreihe';
      if (item.kind === 'sign') seen.sign = 'Verkehrszeichen / Vorwarnung';
      if (item.role && item.role.indexOf('parking_prohibition') === 0) seen.parking = 'Parkverbot-Paar, Pfeile zueinander';
      if (item.kind === 'workarea') seen.workarea = 'Rot schraffierter Arbeitsbereich';
    });
    return Object.keys(seen).map(function(key) { return seen[key]; });
  }

  function collectAuthorityNotes(planDocument) {
    var notes = (planDocument && planDocument.authorityNotes) || [];
    notes = notes.map(function(text) { return (text || '').trim(); }).filter(Boolean);
    if (notes.length) return notes;
    var isPolygon = planDocument && planDocument.geometry && planDocument.geometry.mode === 'polygon';
    return isPolygon
      ? [
          'Haus- und Grundstueckszugaenge werden nicht beeintraechtigt und bei Bedarf mit Bruecken versehen.',
          'Zugang zu den Hauseingaengen wird jederzeit gewaehrleistet.'
        ]
      : [
          'Restgehwegbreite und Absperrung sind im Plan zu pruefen.',
          'Zugaenge bleiben, soweit erforderlich, gesichert.'
        ];
  }

  async function captureMap() {
    await loadLib('https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js', function() {
      return window.domtoimage;
    });

    var selectors = '.map-switcher,.map-controls,.instruction-banner,.rp-preview,.rp-overlay-controls,.status-bar,.toast,.tab-bar,.panel,.search-strip';
    var hidden = [];
    var mapDiv = document.getElementById('map');

    document.querySelectorAll(selectors).forEach(function(el) {
      hidden.push({ el: el, display: el.style.display });
      el.style.display = 'none';
    });

    try {
      return await window.domtoimage.toJpeg(mapDiv, {
        quality: 0.95,
        bgcolor: '#ffffff',
        width: mapDiv.offsetWidth * 2,
        height: mapDiv.offsetHeight * 2,
        style: { transform: 'scale(2)', transformOrigin: 'top left' }
      });
    } finally {
      hidden.forEach(function(item) {
        item.el.style.display = item.display;
      });
    }
  }

  function renderInfoTable(doc, x, y, w, rows) {
    var rowH = 7;
    rows.forEach(function(row, index) {
      var yy = y + index * rowH;
      doc.setFillColor(index % 2 === 0 ? 247 : 241, index % 2 === 0 ? 245 : 239, index % 2 === 0 ? 241 : 236);
      doc.rect(x, yy, w, rowH, 'F');
      doc.setDrawColor(214, 206, 196);
      doc.rect(x, yy, w, rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(110);
      doc.text(row.label, x + 2, yy + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30);
      doc.text(row.value || '-', x + 28, yy + 4.5, { maxWidth: w - 31 });
    });
    return y + rows.length * rowH;
  }

  function renderValidationBlock(doc, x, y, w, validations) {
    var lineY = y;
    var items = validations && validations.length ? validations : [{ severity: 'ok', message: 'Keine blockierenden Pruefhinweise.' }];

    items.forEach(function(item) {
      var fill = item.severity === 'error'
        ? [251, 235, 235]
        : item.severity === 'warning'
          ? [252, 244, 226]
          : [232, 245, 233];
      var border = item.severity === 'error'
        ? [198, 40, 40]
        : item.severity === 'warning'
          ? [249, 168, 37]
          : [46, 125, 50];

      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.roundedRect(x, lineY, w, 9, 1.2, 1.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(border[0], border[1], border[2]);
      doc.text((item.severity || 'info').toUpperCase(), x + 2, lineY + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(40);
      doc.text(item.message, x + 18, lineY + 5.6, { maxWidth: w - 20 });
      lineY += 11;
    });

    return lineY;
  }

  function renderAuthorityNotes(doc, x, y, w, notes) {
    var lineY = y;
    doc.setDrawColor(230, 81, 0);
    doc.setFillColor(255, 246, 240);
    doc.roundedRect(x, lineY, w, 9 + Math.min(2, notes.length) * 8, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(214, 55, 0);
    doc.text('BEHOERDENHINWEISE', x + 2, lineY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    notes.slice(0, 2).forEach(function(note, index) {
      doc.text(note, x + 2, lineY + 10 + index * 7, { maxWidth: w - 4 });
    });
    return lineY + 11 + Math.min(2, notes.length) * 8;
  }

  async function exportPlan(planDocument, mapContext) {
    if (!planDocument) throw new Error('Kein Plan zum Export vorhanden');
    if (planDocument.exportMeta && planDocument.exportMeta.hasErrors) throw new Error('Plan hat blockierende Pruefhinweise');

    if (typeof UI !== 'undefined' && UI.toast) UI.toast('PDF wird erstellt...');
    else if (typeof toast === 'function') toast('PDF wird erstellt...');

    try {
      await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function() {
        return window.jspdf;
      });

      var map = mapContext && mapContext.map;
      var mapDiv = document.getElementById('map');
      var mapImg = await captureMap();
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a3' });
      var W = doc.internal.pageSize.getWidth();
      var H = doc.internal.pageSize.getHeight();
      var M = 8;
      var titleH = 14;
      var bottomH = 58;
      var sideW = 76;
      var mapX = M;
      var mapY = M + titleH;
      var mapW = W - 2 * M - sideW - 4;
      var mapH = H - 2 * M - titleH - bottomH;
      var sideX = mapX + mapW + 4;
      var sideY = mapY;
      var aspect = mapDiv.offsetWidth / mapDiv.offsetHeight;
      var fitW = mapW;
      var fitH = fitW / aspect;
      var version = (planDocument.exportMeta && planDocument.exportMeta.version) || 'v-local';
      var isPolygon = planDocument.geometry && planDocument.geometry.mode === 'polygon';

      if (fitH > mapH) {
        fitH = mapH;
        fitW = fitH * aspect;
      }

      var mapOx = mapX + (mapW - fitW) / 2;
      var mapOy = mapY + (mapH - fitH) / 2;

      doc.setLineWidth(0.45);
      doc.rect(M, M, W - 2 * M, H - 2 * M);

      doc.setFillColor(38, 38, 38);
      doc.rect(M, M, W - 2 * M, titleH, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('VERKEHRSZEICHENPLAN', M + 4, M + 8.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(planDocument.site.adresse || 'Baustelle', M + 4, M + 11.8);

      doc.setFillColor(230, 81, 0);
      doc.roundedRect(W - M - 24, M + 2.5, 21, 8, 1.2, 1.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('RSA 2021', W - M - 13.5, M + 7.8, { align: 'center' });

      doc.addImage(mapImg, 'JPEG', mapOx, mapOy, fitW, fitH);
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(mapOx, mapOy, fitW, fitH);

      if (map && map.getBounds) {
        var bounds = map.getBounds();
        var mapWidthM = bounds.getNorthWest().distanceTo(bounds.getNorthEast());
        drawScaleBar(doc, mapOx + 4, mapOy + fitH - 10, fitW * 0.25, mapWidthM * (fitW / mapDiv.offsetWidth));
      }
      drawNorthArrow(doc, mapOx + fitW - 22, mapOy + 4, 16);

      doc.setFillColor(247, 245, 241);
      doc.rect(sideX, sideY, sideW, mapH, 'F');
      doc.setDrawColor(214, 206, 196);
      doc.rect(sideX, sideY, sideW, mapH);

      doc.setTextColor(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Planuebersicht', sideX + 3, sideY + 5);

      var infoEnd = renderInfoTable(doc, sideX + 3, sideY + 8, sideW - 6, [
        { label: 'Regelplan', value: planDocument.regelplan.name + (planDocument.regelplan.title ? ' - ' + planDocument.regelplan.title : '') },
        { label: 'Bauvorhaben', value: planDocument.project.bauvorhaben },
        { label: 'Adresse', value: planDocument.site.adresse },
        { label: 'Seite', value: planDocument.site.seite === 'links' ? 'Links' : 'Rechts' },
        { label: 'Tempo', value: planDocument.site.tempo + ' km/h' },
        { label: isPolygon ? 'Arbeitsbereich' : 'Arbeitsstelle', value: isPolygon ? 'Polygon-Arbeitsbereich' : planDocument.geometry.arbeitsstelleBreite.toFixed(1) + ' m' },
        { label: isPolygon ? 'Flaeche' : 'Restbreite', value: isPolygon ? ((planDocument.geometry.polygonArea || 0).toFixed(1) + ' qm') : (planDocument.geometry.restbreite !== null ? planDocument.geometry.restbreite.toFixed(2) + ' m' : 'nicht gemessen') },
        { label: isPolygon ? 'Umfang' : 'Laenge', value: isPolygon ? ((planDocument.geometry.polygonPerimeter || 0).toFixed(1) + ' m') : (planDocument.geometry.baustellenLaenge ? planDocument.geometry.baustellenLaenge.toFixed(1) + ' m' : '-') },
        { label: 'Version', value: version }
      ]);

      var legend = collectLegend(planDocument.scene.items || []);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Legende', sideX + 3, infoEnd + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      if (legend.length) {
        legend.forEach(function(text, index) {
          doc.text('- ' + text, sideX + 4, infoEnd + 12 + index * 4);
        });
      } else {
        doc.text('- Kartenansicht mit aktuellem Regelplan', sideX + 4, infoEnd + 12);
      }

      var notesStart = infoEnd + 27;
      var notesEnd = renderAuthorityNotes(doc, sideX + 3, notesStart, sideW - 6, collectAuthorityNotes(planDocument));

      var validationStart = Math.min(sideY + mapH - 42, notesEnd + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Pruefhinweise', sideX + 3, validationStart);
      renderValidationBlock(doc, sideX + 3, validationStart + 3, sideW - 6, planDocument.scene.validations || []);

      var bottomY = H - M - bottomH;
      var bottomW = W - 2 * M;
      doc.setDrawColor(0);
      doc.rect(M, bottomY, bottomW, bottomH);

      var columns = [bottomW * 0.28, bottomW * 0.26, bottomW * 0.28, bottomW * 0.18];
      var x1 = M;
      var x2 = x1 + columns[0];
      var x3 = x2 + columns[1];
      var x4 = x3 + columns[2];
      var rowH = 17;

      doc.line(x2, bottomY, x2, bottomY + bottomH);
      doc.line(x3, bottomY, x3, bottomY + bottomH);
      doc.line(x4, bottomY, x4, bottomY + bottomH);
      doc.line(M, bottomY + rowH, M + bottomW, bottomY + rowH);
      doc.line(M, bottomY + rowH * 2, M + bottomW, bottomY + rowH * 2);

      function blockLabel(x, y, text) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(110);
        doc.text(text, x + 2, y + 4);
      }

      function blockValue(x, y, w, text, size, weight) {
        doc.setFont('helvetica', weight || 'bold');
        doc.setFontSize(size || 7);
        doc.setTextColor(20);
        doc.text(text || '-', x + 2, y + 11, { maxWidth: w - 4 });
      }

      blockLabel(x1, bottomY, 'ERSTELLT VON');
      blockValue(x1, bottomY, columns[0], planDocument.project.ersteller, 8, 'bold');
      blockLabel(x2, bottomY, 'AUFTRAGGEBER');
      blockValue(x2, bottomY, columns[1], planDocument.project.auftraggeber, 7, 'normal');
      blockLabel(x3, bottomY, 'BAUVORHABEN');
      blockValue(x3, bottomY, columns[2], planDocument.project.bauvorhaben, 7, 'normal');
      blockLabel(x4, bottomY, 'ERSTELLT AM');
      blockValue(x4, bottomY, columns[3], planDocument.project.datum, 8, 'bold');

      blockLabel(x1, bottomY + rowH, 'ORT / ADRESSE');
      blockValue(x1, bottomY + rowH, columns[0], planDocument.site.adresse, 7, 'normal');
      blockLabel(x2, bottomY + rowH, 'REGELPLAN');
      blockValue(x2, bottomY + rowH, columns[1], planDocument.regelplan.name + (planDocument.regelplan.title ? ' - ' + planDocument.regelplan.title : ''), 7, 'normal');
      blockLabel(x3, bottomY + rowH, 'PLANPARAMETER');
      blockValue(x3, bottomY + rowH, columns[2], 'Seite ' + (planDocument.site.seite === 'links' ? 'links' : 'rechts') + ', ' + planDocument.site.tempo + ' km/h', 7, 'normal');
      blockLabel(x4, bottomY + rowH, 'PLAN-NR.');
      blockValue(x4, bottomY + rowH, columns[3], planDocument.project.planNummer, 9, 'bold');

      blockLabel(x1, bottomY + rowH * 2, 'FORMAT');
      blockValue(x1, bottomY + rowH * 2, columns[0], 'A3 Hochformat', 7, 'normal');
      blockLabel(x2, bottomY + rowH * 2, isPolygon ? 'ARBEITSBEREICH' : 'ARBEITSSTELLE');
      blockValue(x2, bottomY + rowH * 2, columns[1], isPolygon ? 'Polygon-Arbeitsbereich' : planDocument.geometry.arbeitsstelleBreite.toFixed(1) + ' m', 7, 'normal');
      blockLabel(x3, bottomY + rowH * 2, isPolygon ? 'FLAECHE / UMFANG' : 'RESTBREITE');
      blockValue(x3, bottomY + rowH * 2, columns[2], isPolygon ? ((planDocument.geometry.polygonArea || 0).toFixed(1) + ' qm / ' + (planDocument.geometry.polygonPerimeter || 0).toFixed(1) + ' m') : (planDocument.geometry.restbreite !== null ? planDocument.geometry.restbreite.toFixed(2) + ' m' : 'nicht gemessen'), 7, 'normal');
      blockLabel(x4, bottomY + rowH * 2, 'VERSION');
      blockValue(x4, bottomY + rowH * 2, columns[3], version, 6, 'normal');

      doc.setFillColor(230, 81, 0);
      doc.rect(M, H - M - 3, bottomW, 3, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text('QFM', M + 2, H - M - 0.8);

      var fileBase = (planDocument.site.adresse || planDocument.project.bauvorhaben || 'VZP').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').substring(0, 40);
      doc.save('VZP_' + fileBase + '.pdf');

      if (typeof UI !== 'undefined' && UI.toast) UI.toast('PDF gespeichert');
      else if (typeof toast === 'function') toast('PDF gespeichert');
    } catch (error) {
      console.error('PDF Export Fehler:', error);
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('PDF Fehler: ' + error.message);
      else if (typeof toast === 'function') toast('PDF Fehler: ' + error.message);
      throw error;
    }
  }

  return {
    exportPlan: exportPlan
  };
})();
