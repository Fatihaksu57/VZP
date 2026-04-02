// VZP Editor — KI Regelplan Assistent v1
// Nutzt die Anthropic API um aus einer Situationsbeschreibung den passenden
// Regelplan + Parameter zu ermitteln und dann generateOverlay() aufzurufen.

var KIAssistent = (function () {

  var SYSTEM_PROMPT = `Du bist ein Experte für die RSA 2021 (Richtlinien für die Sicherung von Arbeitsstellen an Straßen) in Deutschland.
Der Nutzer beschreibt eine Arbeitsstelle. Du wählst den passenden Regelplan aus der Kategorie B (Gehwege und Radwege) und gibst die notwendigen Parameter zurück.

Verfügbare Regelpläne:
- BII1: Paralleler Geh-/Radweg – Sperrung Radweg (Radweg gesperrt, keine Umleitung, ggf. Gehweg mitnutzbar)
- BII2: Geh-/Radweg – Sperrung mit Umleitung (Radweg gesperrt mit Umleitung über gem. Geh-/Radweg)
- BII3: Nicht benutzungspflichtiger Radweg – Sperrung (Schrankengitter zur Fahrbahn hin)
- BII4: Gehwegsperrung – Notweg auf Fahrbahn (3 Leitbaken diagonal, Notweg auf Fahrbahn)
- BII5: Halbseitige Sperrung + LZA (zweistreifig, Verkehrsregelung durch Lichtsignalanlage)

Antworte NUR mit einem JSON-Objekt, ohne Erklärung, ohne Markdown-Backticks:
{
  "regelplanId": "BII1",
  "seite": "rechts",
  "arbeitsstelleBreite": 2.0,
  "gehwegBreite": 2.5,
  "begruendung": "Kurze Erklärung warum dieser Plan passt (max. 1 Satz)"
}

Regeln:
- seite: "rechts" wenn das Baufeld rechts der Fahrtrichtung liegt, "links" wenn links
- arbeitsstelleBreite: Breite des Baufeldes in Metern (typisch 1.5–4.0)
- gehwegBreite: Breite des Gehwegs in Metern (typisch 1.5–4.0)
- Bei Unsicherheit: BII1 mit Standardwerten wählen`;

  // ─── Öffentliche API ───────────────────────────────────────────────────────

  async function analyse(params) {
    // params: { strassentyp, tempo, baustellentyp, seite, breite, freitext }

    var beschreibung = [
      'Straßentyp: ' + params.strassentyp,
      'Geschwindigkeit: ' + params.tempo + ' km/h',
      'Baustellenart: ' + params.baustellentyp,
      'Betroffene Seite: ' + (params.seite === 'rechts' ? 'Rechts der Fahrtrichtung' : 'Links der Fahrtrichtung'),
      'Geschätzte Baustellenbreite: ' + params.breite + ' m',
    ].join('\n');

    if (params.freitext && params.freitext.trim()) {
      beschreibung += '\nZusatzinfo: ' + params.freitext.trim();
    }

    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: beschreibung }]
      })
    });

    if (!resp.ok) throw new Error('API Fehler: ' + resp.status);
    var data = await resp.json();
    var text = (data.content || []).map(function(b){ return b.text || ''; }).join('');
    // Strip any accidental markdown fences
    text = text.replace(/```[a-z]*\n?/gi, '').trim();
    return JSON.parse(text);
  }

  return { analyse: analyse };
})();
