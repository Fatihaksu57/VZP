// VZP Editor — PDF Export v6
// Verbesserungen:
//   - Professionelles Schriftfeld wie PLAN//305 / Tenado-Standard
//   - Nordpfeil auf dem Plan
//   - QFM GmbH Logo-Bereich
//   - Maßstabsbalken
//   - Farbkodierung im Schriftfeld

const PDFExport = (() => {

  async function loadLib(url, check) {
    if (check()) return;
    return new Promise((res, rej) => {
      var s = document.createElement('script');
      s.src = url; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // Nordpfeil als SVG-Pfad zeichnen (oben rechts auf der Karte)
  function drawNordpfeil(doc, x, y, size) {
    size = size || 14;
    var cx = x + size/2, cy = y + size/2 + 4;
    // Pfeil-Körper
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    // Spitze (Nord = oben = schwarz)
    doc.setFillColor(0,0,0);
    doc.triangle(cx, cy - size*0.55, cx - size*0.22, cy + size*0.1, cx + size*0.22, cy + size*0.1, 'F');
    // Süden (weiß)
    doc.setFillColor(255,255,255);
    doc.triangle(cx, cy + size*0.55, cx - size*0.22, cy + size*0.1, cx + size*0.22, cy + size*0.1, 'FD');
    // N-Buchstabe
    doc.setFontSize(6); doc.setTextColor(0); doc.setFont('helvetica','bold');
    doc.text('N', cx - 1.5, cy - size*0.6);
    // Kreis
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.setFillColor(255,255,255);
    doc.circle(cx, cy, size*0.65, 'S');
  }

  // Maßstabsbalken zeichnen
  function drawScaleBar(doc, x, y, mapWidthMm, mapWidthM) {
    var barM = Math.pow(10, Math.floor(Math.log10(mapWidthM * 0.25)));
    var barMm = (barM / mapWidthM) * mapWidthMm;
    if (barMm < 5) { barM *= 5; barMm *= 5; }
    if (barMm > 40) { barM /= 2; barMm /= 2; }

    doc.setDrawColor(0); doc.setLineWidth(0.3);
    // Balken: schwarz-weiß alternierend
    var segs = 4, segW = barMm / segs;
    for (var i = 0; i < segs; i++) {
      if (i % 2 === 0) doc.setFillColor(0,0,0);
      else doc.setFillColor(255,255,255);
      doc.rect(x + i*segW, y, segW, 2, 'FD');
    }
    doc.setFontSize(5); doc.setTextColor(0); doc.setFont('helvetica','normal');
    doc.text('0', x - 1, y + 4.5, {align:'right'});
    doc.text(barM + ' m', x + barMm + 1, y + 4.5);
    doc.text('Maßstab ca. 1:' + Math.round(mapWidthM/mapWidthMm*1000), x, y - 1.5);
  }

  async function exportPDF(map, regelplanId) {
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('📄 PDF wird erstellt…');
    else if (typeof toast === 'function') toast('📄 PDF wird erstellt…');

    try {
      await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf);

      var useDomToImage = false;
      try {
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js', () => window.domtoimage);
        useDomToImage = true;
      } catch(e) {
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => window.html2canvas);
      }

      // UI ausblenden
      var selectors = '.map-switcher,.map-controls,.instruction-banner,.rp-preview,' +
        '.rp-overlay-controls,.status-bar,.leaflet-control-zoom,' +
        '.leaflet-control-attribution,.leaflet-control-scale,.toast,.tab-bar,.panel';
      var hidden = [];
      document.querySelectorAll(selectors).forEach(function(el) {
        hidden.push({ el: el, d: el.style.display });
        el.style.display = 'none';
      });
      document.querySelectorAll('.placement-marker,.placement-marker-done').forEach(function(el) {
        var p = el.closest('.leaflet-marker-icon');
        if (p) { hidden.push({ el: p, d: p.style.display }); p.style.display = 'none'; }
      });

      var mapDiv = document.getElementById('map');
      var mapImg;

      if (useDomToImage) {
        var dataUrl = await domtoimage.toJpeg(mapDiv, {
          quality: 0.95, bgcolor: '#ffffff',
          width: mapDiv.offsetWidth * 2, height: mapDiv.offsetHeight * 2,
          style: { transform: 'scale(2)', transformOrigin: 'top left' }
        });
        mapImg = dataUrl;
      } else {
        var canvas = await html2canvas(mapDiv, {
          useCORS: true, allowTaint: true, scale: 2,
          logging: false, backgroundColor: '#ffffff'
        });
        mapImg = canvas.toDataURL('image/jpeg', 0.95);
      }

      // UI wiederherstellen
      hidden.forEach(function(h) { h.el.style.display = h.d; });

      var aspect = mapDiv.offsetWidth / mapDiv.offsetHeight;

      // PDF A3 Hochformat (wie Referenz-VZP Glinkastraße)
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a3' });
      var W = doc.internal.pageSize.getWidth();   // 297mm
      var H = doc.internal.pageSize.getHeight();  // 420mm

      var M = 8;           // Seitenrand
      var schH = 42;       // Schriftfeld-Höhe (wie Referenz)
      var titleH = 12;     // Titelzeile oben

      // ── Rahmen gesamt ──
      doc.setDrawColor(0); doc.setLineWidth(0.5);
      doc.rect(M, M, W - 2*M, H - 2*M);

      // ── Kartenbereich ──
      var mapX = M;
      var mapY = M + titleH;
      var mapW = W - 2*M;
      var mapH = H - 2*M - titleH - schH;

      // Karte platzieren (mit Seitenverhältnis)
      var fitW = mapW, fitH = fitW / aspect;
      if (fitH > mapH) { fitH = mapH; fitW = fitH * aspect; }
      var ox = mapX + (mapW - fitW) / 2;
      var oy = mapY + (mapH - fitH) / 2;

      doc.addImage(mapImg, 'JPEG', ox, oy, fitW, fitH);
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.rect(ox, oy, fitW, fitH);

      // ── Titel-Zeile ──
      doc.setFillColor(40, 40, 40);
      doc.rect(M, M, W-2*M, titleH, 'F');
      doc.setFontSize(11); doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.text('VERKEHRSZEICHENPLAN', M+4, M+8);
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(200,200,200);

      var strasse = (document.getElementById('addressInput') || {}).value || '';
      if (strasse) doc.text(strasse, M+4, M+11.5);

      // RSA 21 Badge
      doc.setFillColor(230, 81, 0);
      doc.roundedRect(W-M-22, M+2, 20, 8, 1, 1, 'F');
      doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
      doc.text('RSA 2021', W-M-11, M+7.5, {align:'center'});

      // ── Nordpfeil (auf dem Plan, oben rechts) ──
      drawNordpfeil(doc, ox + fitW - 22, oy + 4, 16);

      // ── Maßstabsbalken ──
      var bounds = map.getBounds();
      var mapWidthM = bounds.getNorthWest().distanceTo(bounds.getNorthEast());
      drawScaleBar(doc, ox + 4, oy + fitH - 10, fitW * 0.25, mapWidthM * (fitW/mapDiv.offsetWidth) * (mapDiv.offsetWidth/(fitW)));

      // ── Schriftfeld ──
      var sy = H - M - schH;
      var sw = W - 2*M;

      doc.setDrawColor(0); doc.setLineWidth(0.4);
      doc.rect(M, sy, sw, schH);

      // Trennlinie Mitte (horizontal)
      var rowH = schH * 0.45;
      doc.setLineWidth(0.2);
      doc.line(M, sy + rowH, M + sw, sy + rowH);

      // Spaltenbreiten: Ersteller | Auftraggeber | Inhalt | Datum/Nr.
      var cW = [sw*0.28, sw*0.28, sw*0.28, sw*0.16];
      var cx0 = M;
      for (var ci = 0; ci < 3; ci++) {
        cx0 += cW[ci];
        doc.line(cx0, sy, cx0, sy + schH);
      }

      // Trennlinie im Datumsspalte
      doc.line(M + cW[0] + cW[1] + cW[2], sy + rowH/2, M+sw, sy + rowH/2);

      function lbl(x, y, text) {
        doc.setFontSize(5); doc.setTextColor(100); doc.setFont('helvetica','normal');
        doc.text(text, x+2, y+3.5);
      }
      function val(x, y, w, text, sz, bold) {
        doc.setFontSize(sz||8); doc.setTextColor(0);
        doc.setFont('helvetica', bold!==false?'bold':'normal');
        doc.text(text||'', x+2, y+rowH*0.75, {maxWidth:w-4});
      }
      function valSm(x, y, w, text, sz) {
        doc.setFontSize(sz||7); doc.setTextColor(0); doc.setFont('helvetica','normal');
        doc.text(text||'', x+2, y+rowH*0.75+1, {maxWidth:w-4});
      }

      var projekt = (document.getElementById('pdfProjekt')||document.getElementById('pdfProjektM')||{}).value || 'Leitungsarbeiten';
      var ersteller = (document.getElementById('pdfErsteller')||document.getElementById('pdfErstellerM')||{}).value || 'QFM GmbH';
      var datum = new Date().toLocaleDateString('de-DE');
      var rpDef = (typeof RP_DEFS !== 'undefined' && RP_DEFS && RP_DEFS[regelplanId]) ? RP_DEFS[regelplanId] : null;
      var rpText = rpDef ? rpDef.name + ' — ' + rpDef.title : (regelplanId || 'B II/–');
      var tempoVal = (typeof tempo !== 'undefined') ? tempo + ' km/h' : '50 km/h';

      var x1=M, x2=M+cW[0], x3=x2+cW[1], x4=x3+cW[2];

      // Zeile 1
      lbl(x1, sy, 'PLAN ERSTELLT VON');
      val(x1, sy, cW[0], ersteller, 8);

      lbl(x2, sy, 'AUFTRAGGEBER');
      val(x2, sy, cW[1], 'QFM Fernmelde- und Elektromontagen GmbH', 7);

      lbl(x3, sy, 'INHALT');
      val(x3, sy, cW[2], projekt, 8);

      lbl(x4, sy, 'ERSTELLT AM');
      val(x4, sy, cW[3], datum, 9);

      // Zeile 2
      lbl(x1, sy+rowH, 'BAUFIRMA');
      valSm(x1, sy+rowH, cW[0], 'QFM GmbH, Großbeerenstraße 136, 12277 Berlin', 7);

      lbl(x2, sy+rowH, 'BAUVORHABEN');
      valSm(x2, sy+rowH, cW[1], strasse || 'Berlin', 7);

      lbl(x3, sy+rowH, 'REGELPLAN (RSA 2021)');
      valSm(x3, sy+rowH, cW[2], rpText, 7);

      // Plan-Nr. + Maßstab
      lbl(x4, sy+rowH/2, 'PLAN-NR.');
      doc.setFontSize(10); doc.setTextColor(0); doc.setFont('helvetica','bold');
      doc.text('VZP-001', x4+2, sy+rowH*0.5+rowH*0.6);

      lbl(x4, sy+rowH, 'MASSSTAB / FORMAT');
      valSm(x4, sy+rowH, cW[3], '1:500  DIN A3', 7);

      // QFM Orange-Balken (visueller Akzent unten)
      doc.setFillColor(230, 81, 0);
      doc.rect(M, H-M-3, sw, 3, 'F');
      doc.setFontSize(5); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
      doc.text('QFM', M+2, H-M-0.8);

      var fn = 'VZP_' + (strasse||projekt).replace(/[^a-zA-Z0-9äöüÄÖÜß]/g,'_').substring(0,30) + '.pdf';
      doc.save(fn);

      if (typeof UI !== 'undefined' && UI.toast) UI.toast('✓ PDF gespeichert');
      else if (typeof toast === 'function') toast('✓ PDF gespeichert');

    } catch (e) {
      console.error('PDF Export Fehler:', e);
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('PDF Fehler: ' + e.message);
      else if (typeof toast === 'function') toast('PDF Fehler: ' + e.message);
    }
  }

  return { exportPDF: exportPDF };
})();
