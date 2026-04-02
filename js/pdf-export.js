// VZP Editor — PDF Export v5 (dom-to-image for accurate rendering)
const PDFExport = (() => {

  async function loadLib(url, check) {
    if (check()) return;
    return new Promise((res, rej) => {
      var s = document.createElement('script');
      s.src = url; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function exportPDF(map, regelplanId) {
    toast('📄 PDF wird erstellt…');

    try {
      await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf);

      // Try dom-to-image first (better SVG/CSS support), fallback to html2canvas
      var useDomToImage = false;
      try {
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js', () => window.domtoimage);
        useDomToImage = true;
      } catch(e) {
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => window.html2canvas);
      }

      // Hide UI elements before screenshot
      var selectors = '.map-switcher,.map-controls,.instruction-banner,.rp-preview,' +
        '.rp-overlay-controls,.status-bar,.leaflet-control-zoom,' +
        '.leaflet-control-attribution,.leaflet-control-scale,.toast';
      var hidden = [];
      document.querySelectorAll(selectors).forEach(function(el) {
        hidden.push({ el: el, d: el.style.display });
        el.style.display = 'none';
      });

      // Hide placement markers
      document.querySelectorAll('.placement-marker,.placement-marker-done').forEach(function(el) {
        var p = el.closest('.leaflet-marker-icon');
        if (p) { hidden.push({ el: p, d: p.style.display }); p.style.display = 'none'; }
      });

      var mapDiv = document.getElementById('map');
      var mapImg;

      if (useDomToImage) {
        // dom-to-image: much better at SVG and CSS transforms
        var dataUrl = await domtoimage.toJpeg(mapDiv, {
          quality: 0.95,
          bgcolor: '#ffffff',
          width: mapDiv.offsetWidth * 2,
          height: mapDiv.offsetHeight * 2,
          style: { transform: 'scale(2)', transformOrigin: 'top left' }
        });
        mapImg = dataUrl;
      } else {
        // Fallback: html2canvas
        var canvas = await html2canvas(mapDiv, {
          useCORS: true, allowTaint: true, scale: 2,
          logging: false, backgroundColor: '#ffffff'
        });
        mapImg = canvas.toDataURL('image/jpeg', 0.95);
      }

      // Restore hidden elements
      hidden.forEach(function(h) { h.el.style.display = h.d; });

      var aspect = mapDiv.offsetWidth / mapDiv.offsetHeight;

      // Create PDF — A3 landscape
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      var W = doc.internal.pageSize.getWidth();
      var H = doc.internal.pageSize.getHeight();

      var M = 5;
      var stempelH = 26;

      // Map fills full width
      var mapW = W - 2 * M;
      var mapH = H - 2 * M - stempelH - 1;

      var fitW = mapW;
      var fitH = fitW / aspect;
      if (fitH > mapH) { fitH = mapH; fitW = fitH * aspect; }

      var ox = M + (mapW - fitW) / 2;
      doc.addImage(mapImg, 'JPEG', ox, M, fitW, fitH);
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.rect(ox, M, fitW, fitH);

      // ── Plankopf ──
      var py = H - M - stempelH;
      var pw = W - 2 * M;
      doc.setDrawColor(0); doc.setLineWidth(0.4);
      doc.rect(M, py, pw, stempelH);

      var projekt = (document.getElementById('pdfProjekt') || document.getElementById('pdfProjektM') || {}).value || 'Verkehrszeichenplan';
      var strasse = (document.getElementById('addressInput') || {}).value || '';
      var ersteller = (document.getElementById('pdfErsteller') || document.getElementById('pdfErstellerM') || {}).value || 'QFM GmbH';
      var datum = new Date().toLocaleDateString('de-DE');
      var rpDef = (typeof RP_DEFS !== 'undefined' && RP_DEFS[regelplanId]) ? RP_DEFS[regelplanId] : null;
      var rpText = rpDef ? rpDef.name + ' — ' + rpDef.title : (regelplanId || '');
      var tempoVal = (typeof tempo !== 'undefined') ? tempo + ' km/h' : '50 km/h';

      // 6 columns, 2 rows
      var cols = [pw*0.20, pw*0.20, pw*0.22, pw*0.10, pw*0.10, pw*0.18];
      var cx = M;
      for (var c = 0; c < 5; c++) { cx += cols[c]; doc.setLineWidth(0.15); doc.line(cx, py, cx, py + stempelH); }
      var rh = stempelH / 2;
      doc.setLineWidth(0.15); doc.line(M, py + rh, M + pw, py + rh);

      function lbl(x, y, text) { doc.setFontSize(5); doc.setTextColor(140); doc.setFont('helvetica','normal'); doc.text(text, x+2, y+4); }
      function val(x, y, w, text, sz) { doc.setFontSize(sz||8); doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.text(text||'', x+2, y+10, {maxWidth:w-4}); }

      var x1=M, x2=M+cols[0], x3=x2+cols[1], x4=x3+cols[2], x5=x4+cols[3], x6=x5+cols[4];

      lbl(x1,py,'PROJEKT');     val(x1,py,cols[0],projekt,9);
      lbl(x2,py,'STRASSE/ORT'); val(x2,py,cols[1],strasse);
      lbl(x3,py,'REGELPLAN (RSA 21)'); val(x3,py,cols[2],rpText);
      lbl(x4,py,'DATUM');       val(x4,py,cols[3],datum,9);
      lbl(x5,py,'PLAN-NR.');   val(x5,py,cols[4],'VZP-001',10);

      lbl(x1,py+rh,'ERSTELLT DURCH'); val(x1,py+rh,cols[0],ersteller);
      lbl(x2,py+rh,'TEMPO');   val(x2,py+rh,cols[1],tempoVal,9);
      lbl(x3,py+rh,'MASSSTAB'); val(x3,py+rh,cols[2],'ca. 1:500',9);

      // Genehmigungsvermerk (last col, both rows)
      lbl(x6,py,'GENEHMIGUNGSVERMERK');
      doc.setDrawColor(200); doc.setLineWidth(0.1);
      doc.rect(x6+2, py+6, cols[5]-4, stempelH-10, 'S');
      doc.setFontSize(4); doc.setTextColor(180); doc.setFont('helvetica','normal');
      doc.text('Datum / Stempel / Unterschrift', x6+3, py+stempelH-3);

      var fn = 'VZP_' + projekt.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g,'_').substring(0,25) + '.pdf';
      doc.save(fn);
      toast('✓ PDF gespeichert');

    } catch (e) {
      console.error('PDF Export Fehler:', e);
      toast('PDF Fehler: ' + e.message);
    }
  }

  return { exportPDF: exportPDF };
})();
