// ═══════════════════════════════════════════════════════════════
// VZP Editor — Ebenen-System (Layer Manager)
// ═══════════════════════════════════════════════════════════════
// Verwaltet alle Kartenebenen mit:
//   - Ein/Ausblenden pro Layer
//   - Opacity-Steuerung
//   - Z-Index Reihenfolge
//   - Gruppierung (Bestand, Regelplan, Maßketten, Baugrube, VZ)
// ═══════════════════════════════════════════════════════════════

const LayerManager = (() => {

  // Layer-Definitionen mit Default-Settings
  const LAYER_DEFS = {
    basemap:    { name: 'Basiskarte',    icon: '🗺️', visible: true, opacity: 1.0,  zIndex: 0,   group: 'basis' },
    alkis:      { name: 'ALKIS Flurkarte', icon: '📐', visible: false, opacity: 0.35, zIndex: 100, group: 'basis' },
    luftbild:   { name: 'Luftbild',      icon: '🛰️', visible: false, opacity: 0.6,  zIndex: 50,  group: 'basis' },
    regelplan:  { name: 'Regelplan',     icon: '🚧', visible: true, opacity: 1.0,  zIndex: 400, group: 'plan' },
    massketten: { name: 'Maßketten',     icon: '📏', visible: true, opacity: 1.0,  zIndex: 500, group: 'plan' },
    baugrube:   { name: 'Baugrube',      icon: '🕳️', visible: true, opacity: 1.0,  zIndex: 300, group: 'plan' },
    zeichnung:  { name: 'Zeichenlinie',  icon: '✏️', visible: true, opacity: 1.0,  zIndex: 350, group: 'plan' },
    eigene_vz:  { name: 'Eigene VZ',     icon: '🔶', visible: true, opacity: 1.0,  zIndex: 600, group: 'objekte' },
    handles:    { name: 'Drag Handles',  icon: '⊕',  visible: true, opacity: 1.0,  zIndex: 900, group: 'system' },
  };

  // State: Kopie der Layer-Defs mit aktuellem Status
  const state = {};
  // Referenzen zu Leaflet-Layern/LayerGroups
  const leafletLayers = {};

  function init() {
    // State initialisieren
    Object.entries(LAYER_DEFS).forEach(([id, def]) => {
      state[id] = { ...def, id };
    });
  }

  // Layer registrieren (Leaflet-Layer zuweisen)
  function register(layerId, leafletLayer) {
    leafletLayers[layerId] = leafletLayer;
    // Initialen Zustand anwenden
    if (state[layerId] && !state[layerId].visible && leafletLayer._map) {
      leafletLayer._map.removeLayer(leafletLayer);
    }
  }

  // Layer entfernen (z.B. beim Neuzeichnen)
  function unregister(layerId) {
    const layer = leafletLayers[layerId];
    if (layer && layer._map) {
      layer._map.removeLayer(layer);
    }
    delete leafletLayers[layerId];
  }

  // Sichtbarkeit togglen
  function toggle(layerId, map) {
    const s = state[layerId];
    if (!s) return;
    s.visible = !s.visible;
    
    const layer = leafletLayers[layerId];
    if (layer) {
      if (s.visible) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        if (layer.setOpacity) layer.setOpacity(s.opacity);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    }
    
    renderPanel();
    return s.visible;
  }

  // Opacity setzen
  function setOpacity(layerId, opacity) {
    const s = state[layerId];
    if (!s) return;
    s.opacity = opacity;
    
    const layer = leafletLayers[layerId];
    if (layer) {
      if (layer.setOpacity) {
        layer.setOpacity(opacity);
      } else if (layer.setStyle) {
        layer.setStyle({ opacity, fillOpacity: opacity * 0.3 });
      } else if (layer.eachLayer) {
        layer.eachLayer(l => {
          if (l.setOpacity) l.setOpacity(opacity);
          else if (l.setStyle) l.setStyle({ opacity, fillOpacity: opacity * 0.5 });
        });
      }
    }
  }

  // Ist Layer sichtbar?
  function isVisible(layerId) {
    return state[layerId]?.visible ?? true;
  }

  // Alle sichtbaren Layer-IDs
  function getVisibleLayers() {
    return Object.entries(state)
      .filter(([_, s]) => s.visible)
      .map(([id]) => id);
  }

  // State für einen Layer
  function getState(layerId) {
    return state[layerId];
  }

  // ─── Panel rendern ────────────────────────────────────────
  function renderPanel() {
    const panel = document.getElementById('layerPanel');
    if (!panel) return;

    const groups = {
      basis: { name: 'Grundlagen', layers: [] },
      plan: { name: 'Planung', layers: [] },
      objekte: { name: 'Objekte', layers: [] },
      system: { name: 'System', layers: [] },
    };

    Object.entries(state).forEach(([id, s]) => {
      if (s.group && groups[s.group]) {
        groups[s.group].layers.push({ id, ...s });
      }
    });

    let html = '';
    Object.entries(groups).forEach(([gid, group]) => {
      if (group.layers.length === 0) return;
      // System-Layer nicht anzeigen
      if (gid === 'system') return;

      html += `<div class="layer-group">
        <div class="layer-group-title">${group.name}</div>`;

      group.layers.forEach(l => {
        const checked = l.visible ? 'checked' : '';
        const opacityPct = Math.round(l.opacity * 100);
        html += `
          <div class="layer-item ${l.visible ? '' : 'layer-off'}">
            <label class="layer-toggle">
              <input type="checkbox" ${checked} onchange="LayerManager.toggle('${l.id}', map)">
              <span class="layer-icon">${l.icon}</span>
              <span class="layer-name">${l.name}</span>
            </label>
            <input type="range" class="layer-opacity" min="0" max="100" value="${opacityPct}" 
              oninput="LayerManager.setOpacity('${l.id}', this.value/100)"
              title="Deckkraft: ${opacityPct}%">
          </div>`;
      });

      html += `</div>`;
    });

    panel.innerHTML = html;
  }

  // ─── CSS injizieren ───────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('layer-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'layer-manager-styles';
    style.textContent = `
      .layer-group { margin-bottom: 8px; }
      .layer-group-title {
        font-size: 8px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 1.2px; color: var(--text2); margin-bottom: 4px;
        padding-bottom: 3px; border-bottom: 1px solid var(--border);
      }
      .layer-item {
        display: flex; align-items: center; gap: 4px;
        padding: 4px 0; transition: opacity 0.2s;
      }
      .layer-item.layer-off { opacity: 0.45; }
      .layer-toggle {
        display: flex; align-items: center; gap: 6px;
        cursor: pointer; flex: 1; min-width: 0;
      }
      .layer-toggle input[type=checkbox] {
        accent-color: var(--accent); width: 13px; height: 13px; cursor: pointer;
      }
      .layer-icon { font-size: 12px; flex-shrink: 0; }
      .layer-name {
        font-size: 10px; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .layer-off .layer-name { color: var(--text2); }
      .layer-opacity {
        width: 50px; height: 3px; -webkit-appearance: none; appearance: none;
        background: var(--border); border-radius: 2px; outline: none;
        cursor: pointer; flex-shrink: 0;
      }
      .layer-opacity::-webkit-slider-thumb {
        -webkit-appearance: none; width: 10px; height: 10px;
        border-radius: 50%; background: var(--accent); cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────
  return {
    init,
    register,
    unregister,
    toggle,
    setOpacity,
    isVisible,
    getVisibleLayers,
    getState,
    renderPanel,
    injectStyles,
    LAYER_DEFS,
    state,
  };
})();
