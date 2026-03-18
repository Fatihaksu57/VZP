// ═══════════════════════════════════════════════════
// VZP Editor — PDF Export Module
// ═══════════════════════════════════════════════════

const PDFExport = (() => {

  async function exportPDF() {
    UI.toast('PDF wird erstellt…');
    try {
      const mapEl = document.getElementById('map');
      const canvas = await html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

      // Header
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Verkehrszeichenplan nach RSA 21', 15, 15);

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      const projName = document.getElementById('pName').value || 'Ohne Titel';
      const firma = document.getElementById('pFirma').value || '';
      const bearb = document.getElementById('pBearb').value || '';
      const datum = document.getElementById('pDate').value || '';
      pdf.text(`Projekt: ${projName}  |  Firma: ${firma}  |  Bearbeiter: ${bearb}  |  Datum: ${datum}`, 15, 22);

      // Map image
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const mapW = pageW - 30;
      const mapH = mapW * (canvas.height / canvas.width);
      pdf.addImage(imgData, 'JPEG', 15, 28, mapW, Math.min(mapH, pageH - 45));

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128);
      pdf.text('Erstellt mit VZP Editor — © QFM Fernmelde- und Elektromontagen GmbH', 15, pageH - 5);

      const filename = `VZP_${projName.replace(/\\s+/g, '_')}_${datum || 'plan'}.pdf`;
      pdf.save(filename);
      UI.toast('PDF exportiert ✓');
    } catch (err) {
      console.error('PDF export error:', err);
      UI.toast('PDF-Export fehlgeschlagen');
    }
  }

  return { exportPDF };
})();
