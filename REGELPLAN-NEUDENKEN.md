# Regelpläne Neu Denken

## Ausgangslage

Die aktuelle Umsetzung in [js/regelplan-templates.js](/c:/Users/fatih.aksu/Desktop/vzp/VZP/js/regelplan-templates.js) funktioniert als schneller, pragmatischer Renderer, koppelt aber mehrere Ebenen zu eng:

- Geometrie und Projektion liegen direkt neben fachlichen RSA-Regeln.
- Regelwissen steckt in prozeduralen `placeBII*`-Funktionen statt in Plan-Daten.
- Rendering-Details wie SVG-Dateien, Pixelgrößen und Leaflet-Marker sind Teil der Planlogik.
- Die App übergibt nur ein sehr kleines Optionsobjekt aus [index.html:784](/c:/Users/fatih.aksu/Desktop/vzp/VZP/index.html#L784), obwohl die Regelpläne fachlich deutlich mehr Zustände kennen.

Das ist für fünf B-II-Pläne noch beherrschbar, skaliert aber schlecht, sobald Validierung, mehrere Pläne, Restbreitenregeln, Varianten oder Speichern dazukommen.

## Was heute gut ist

- Die Linie als primäres Eingabeobjekt ist richtig gedacht.
- Das Seitenmodell mit `sf` und Offsets entlang/quer zur Linie ist grundsätzlich brauchbar.
- Das Re-Rendering bei Zoom hält die Symbole lesbar.
- Die aktuelle Struktur ist klein genug, um ersetzt zu werden, ohne dass man eine riesige Altlast mitschleppen muss.

## Hauptprobleme im Ist-Zustand

### 1. Fachlogik und Darstellung sind untrennbar

In [js/regelplan-templates.js:49](/c:/Users/fatih.aksu/Desktop/vzp/VZP/js/regelplan-templates.js#L49) baut `mkSVG()` sofort Leaflet-Marker mit konkreten SVG-Dateien. Dadurch gibt es keine saubere Zwischenstufe wie:

- "Hier steht eine Leitbake mit Funktion X"
- "Diese Bake wird auf Zoomstufe Y mit Asset Z gerendert"

Stattdessen ist beides dasselbe Objekt.

### 2. Regelpläne sind als Kopierlogik modelliert

`placeBII1` bis `placeBII5` in [js/regelplan-templates.js:176](/c:/Users/fatih.aksu/Desktop/vzp/VZP/js/regelplan-templates.js#L176) bis [js/regelplan-templates.js:223](/c:/Users/fatih.aksu/Desktop/vzp/VZP/js/regelplan-templates.js#L223) bestehen aus hart codierten Aufrufen wie:

- "platziere Schrankenreihe"
- "füge zwei VZ 259 hinzu"
- "verwende dieselbe Logik wie BII1 plus ..."

Das ist schnell geschrieben, aber die Regelpläne sind damit kein Datenbestand, sondern verstreute JS-Prozedur. Jede Abweichung erzeugt neue Sonderfälle.

### 3. Das Eingabemodell ist zu arm

In [index.html:788](/c:/Users/fatih.aksu/Desktop/vzp/VZP/index.html#L788) werden `gehwegBreite` und `arbeitsstelleBreite` aktuell identisch gesetzt. Fachlich sind das aber verschiedene Dinge:

- verfügbare Breite Bestand
- beanspruchte Breite Arbeitsstelle
- verbleibende Breite Restweg
- notwendige Sicherheitsräume
- Verkehrsführungstyp

Solange diese Begriffe im Datenmodell fehlen, kann die Engine keine echte RSA-Logik abbilden, sondern nur "Icons entlang einer Linie setzen".

### 4. Das System kennt keine semantischen Objekte

Die Engine erzeugt direkt Marker, aber keine domänenspezifischen Instanzen wie:

- Arbeitsbereich
- Absperrung längs
- Absperrung quer
- Leitbakenkette
- Vorwarnung
- Nachwarnung
- Notweg
- Verkehrszeichen mit Zweck

Ohne solche Objekte gibt es keine belastbare Basis für:

- Validierung
- Editieren einzelner Bausteine
- Export mit Legende
- Speichern/Laden
- spätere automatische Korrekturen

### 5. Die Geometrie ist nur "gut genug", nicht systematisch

Das Kernmodell `pt/ptM/oLL/bear` in [js/regelplan-templates.js:36](/c:/Users/fatih.aksu/Desktop/vzp/VZP/js/regelplan-templates.js#L36) ist brauchbar, aber die Regeln für Quer-/Längsorientierung, Bakenrotation, Warnabstände und Schraffur liegen verteilt in einzelnen Helfern. Dass Leitbaken zuletzt über einen Fix "immer senkrecht" stabilisiert wurden, ist ein Symptom dafür.

## Neuansatz: Drei getrennte Schichten

### 1. Plan-Definition

Jeder Regelplan wird als reine Datenbeschreibung modelliert, nicht als Funktion.

Beispielhaft:

```js
const PLAN_BII1 = {
  id: 'BII1',
  name: 'B II/1',
  anchors: ['start', 'end', 'workArea', 'roadSide', 'siteSide'],
  params: {
    speed: { type: 'enum', values: [30, 50], default: 50 },
    side: { type: 'enum', values: ['links', 'rechts'], default: 'rechts' },
    workWidth: { type: 'number', min: 0.5, max: 8, default: 2.0 },
    existingPathWidth: { type: 'number', min: 0.5, max: 8, required: false }
  },
  elements: [
    { type: 'warning_pair', sign: '123', source: 'rsa.innerorts' },
    { type: 'cross_barrier', at: 'start', width: 'workWidth' },
    { type: 'cross_barrier', at: 'end', width: 'workWidth' },
    { type: 'longitudinal_barrier_row', side: 'roadSide', offset: 0.2 },
    { type: 'longitudinal_barrier_row', side: 'siteSide', offset: 'workWidth - 0.15', lights: true },
    { type: 'beacon_row', side: 'centerLine', spacing: 9 }
  ],
  constraints: [
    { rule: 'min_remaining_width', target: 'existingPathWidth - workWidth', min: 1.3, severity: 'warning' }
  ]
};
```

Die Definition sagt dann nur noch, *was* der Plan enthält, nicht *wie* Leaflet ihn malt.

### 2. Layout-Engine

Eine einzige Engine transformiert:

- Benutzereingaben
- gezeichnete Referenzlinie
- Plan-Definition

in ein neutrales Layout-Modell.

Ausgabe wäre zum Beispiel:

```js
{
  workZonePolygon: [...],
  items: [
    { kind: 'barrier', variant: 'longitudinal', role: 'roadside', center: [...], bearing: 23, lengthM: 2.0 },
    { kind: 'beacon', variant: 'right_light', center: [...], bearing: 23, role: 'start_taper' },
    { kind: 'sign', sign: '123', center: [...], facing: 203, role: 'advance_warning' }
  ],
  dimensions: [
    { kind: 'length', value: 18.3 },
    { kind: 'remaining_width', value: 1.45 }
  ],
  validations: [
    { severity: 'warning', code: 'RESTWEG_LT_130', message: 'Restgehwegbreite unter 1,30 m' }
  ]
}
```

Wichtig: Dieses Modell ist Leaflet-frei.

### 3. Renderer

Erst die dritte Schicht rendert das Layout:

- `leafletRenderer` für die App
- `svgRenderer` für Export
- später eventuell `canvasRenderer` für Performance

Dann ist `mkSVG()` kein Domänenbaustein mehr, sondern nur noch eine Rendering-Strategie.

## Das eigentliche neue mentale Modell

Heute ist ein Regelplan praktisch "eine Linie plus ein paar Marker".  
Neu sollte ein Regelplan sein:

> eine verkehrsrechtliche Anordnung, die aus einer Referenzachse, einem Arbeitsraum, Führungskanten, Verkehrszeichen, Warnräumen und Prüfregeln besteht.

Dann ergeben sich die richtigen Kernobjekte fast automatisch:

- `ReferenceAxis`
- `WorkArea`
- `TrafficSide` / `SiteSide`
- `BarrierRun`
- `BeaconRun`
- `CrossClosure`
- `WarningSignPlacement`
- `PedestrianBypass`
- `ValidationResult`

Das ist aus meiner Sicht der entscheidende Schritt: weg von "BII4 zeichnet ein paar Dinge", hin zu "BII4 beschreibt eine temporäre Verkehrsführung".

## Wie ich die Engine neu schneiden würde

### Modul 1: `regelplan-catalog.js`

Enthält nur Metadaten, Parameterfelder, Constraints und Elementlisten der Pläne.

### Modul 2: `regelplan-geometry.js`

Enthält nur geometrische Primitive:

- Interpolation entlang Linie
- Offset quer zur Linie
- Bearing/Facing
- Segmentierung in Meter
- polygonale Flächen aus Korridoren

Keine SVG-Dateien, keine Verkehrszeichen-Nummern.

### Modul 3: `regelplan-layout.js`

Übersetzt einen Plan + Kontext in semantische Items.

### Modul 4: `regelplan-render-leaflet.js`

Setzt semantische Items in Marker/Polygone/SVG um.

### Modul 5: `regelplan-validate.js`

Prüft RSA-nahe Regeln und UI-Hinweise:

- Restgehweg unter Mindestmaß
- Arbeitsstelle länger/kürzer als Mindestabstände
- Schildabstände abgeschnitten
- Planparameter unplausibel

## Warum das für eure App besonders wichtig ist

Die App ist mobile-first und soll schnell benutzbar bleiben. Genau deshalb braucht ihr intern mehr Struktur, nicht weniger:

- Die UI kann simpel bleiben, wenn die Engine sauber ist.
- Speichern/Laden wird trivialer, weil ihr nicht Markerzustände, sondern Planzustände speichert.
- Multi-Plan-Projekte werden beherrschbar.
- PDF-Export muss nicht denselben Leaflet-Trick wiederverwenden.
- Maßketten und Restbreiten können aus demselben Layout-Modell gespeist werden statt aus parallelen Sonderpfaden.

## Konkrete Kritik an der heutigen API

`generateOverlay(map, lls, rpId, seite, opts)` in [js/regelplan-templates.js:233](/c:/Users/fatih.aksu/Desktop/vzp/VZP/js/regelplan-templates.js#L233) ist für Rendering ok, aber als Systemgrenze zu grob.

Besser wäre:

```js
const scene = RegelplanEngine.buildScene({
  planId: activeRP,
  referenceLine: drawnLine,
  side: seite,
  speed: tempo,
  workWidth: breite,
  existingPathWidth: detectedGehwegBreite,
  context: {
    city: 'Berlin',
    roadClass: 'innerorts'
  }
});

RegelplanLeafletRenderer.render(map, scene);
Massketten.render(map, scene.dimensions);
ValidationPanel.render(scene.validations);
```

Dann bekommt jedes Subsystem genau das, was es braucht.

## Migrationspfad ohne Totalumbau

### Phase 1

Neue Layout-Engine parallel zur alten Struktur bauen, aber nur für `BII1`.

### Phase 2

Renderer so schreiben, dass er dasselbe visuelle Ergebnis wie heute erzeugt.

### Phase 3

`applyRegelplan()` in [index.html:784](/c:/Users/fatih.aksu/Desktop/vzp/VZP/index.html#L784) erst auf die neue Engine für `BII1`, dann `BII2` bis `BII5` umschalten.

### Phase 4

Maßketten und Validierung an das neue `scene`-Modell hängen.

### Phase 5

Alte `placeBII*`-Funktionen entfernen.

## Meine klare Empfehlung

Nicht `regelplan-templates.js` weiter "sauber refactoren".  
Das wäre wahrscheinlich nur eine hübschere Version derselben Kopplung.

Stattdessen:

1. Semantisches Scene-Modell definieren.
2. Einen Plan datengetrieben beschreiben.
3. Einen einzigen allgemeinen Layout-Resolver bauen.
4. Rendering und Validierung davon ableiten.

Der größte Gewinn wäre nicht schönere Syntax, sondern dass die Regelpläne erstmals als fachliche Objekte im System existieren.
