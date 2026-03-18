// ═══════════════════════════════════════════════════
// VZP Editor — Object Manager Module
// ═══════════════════════════════════════════════════

const ObjectManager = (() => {
  let objects = [];
  let selected = null;
  let undoStack = [];

  const VZ_PATH = 'assets/vz/';

  function add(obj) {
    objects.push(obj);
    undoStack.push({ action: 'add', obj });
    updateCount();
  }

  function remove(obj) {
    const map = MapModule.getMap();
    if (obj.marker) map.removeLayer(obj.marker);
    if (obj.layer) map.removeLayer(obj.layer);
    objects = objects.filter(o => o !== obj);
    undoStack.push({ action: 'remove', obj });
    updateCount();
  }

  function placeVZ(vzId, latlng, size, rotation) {
    size = size || 50;
    rotation = rotation || 0;

    const entry = VZ_CATALOG.find(v => v.id === vzId);
    if (!entry) return;

    const map = MapModule.getMap();
    const imgSrc = VZ_PATH + entry.file;

    const icon = L.divIcon({
      html: `<img class="vz-icon" src="${imgSrc}" style="transform:rotate(${rotation}deg);width:${size}px;height:auto" draggable="false">`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      className: 'vz-m',
    });

    const marker = L.marker(latlng, { icon, draggable: true }).addTo(map);
    const obj = { type: 'symbol', marker, vzId, rotation, size, latlng, name: entry.name, code: entry.code };

    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      select(obj);
    });
    marker.on('dragend', () => {
      obj.latlng = marker.getLatLng();
    });
    marker.on('contextmenu', e => {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      select(obj);
      UI.showCtxMenu(e.originalEvent.clientX, e.originalEvent.clientY);
    });

    add(obj);
    select(obj);
    UI.toast(entry.name + ' platziert');
  }

  function select(obj) {
    deselect();
    selected = obj;
    if (obj.type === 'symbol' && obj.marker) {
      obj.marker.getElement()?.classList.add('sel');
    }
    UI.showProperties(obj);
  }

  function deselect() {
    if (selected?.marker) {
      selected.marker.getElement()?.classList.remove('sel');
    }
    selected = null;
    UI.hideProperties();
  }

  function getSelected() { return selected; }

  function updateSelected(prop, value) {
    if (!selected || selected.type !== 'symbol') return;
    value = parseInt(value);
    if (prop === 'rotation') selected.rotation = value;
    else if (prop === 'size') selected.size = value;
    refreshIcon(selected);
  }

  function refreshIcon(obj) {
    const entry = VZ_CATALOG.find(v => v.id === obj.vzId);
    if (!entry) return;
    const imgSrc = VZ_PATH + entry.file;
    const icon = L.divIcon({
      html: `<img class="vz-icon" src="${imgSrc}" style="transform:rotate(${obj.rotation}deg);width:${obj.size}px;height:auto" draggable="false">`,
      iconSize: [obj.size, obj.size],
      iconAnchor: [obj.size / 2, obj.size / 2],
      className: 'vz-m',
    });
    obj.marker.setIcon(icon);
    // Re-apply selection styling
    setTimeout(() => obj.marker.getElement()?.classList.add('sel'), 10);
  }

  function duplicateSelected() {
    if (!selected || selected.type !== 'symbol') return;
    const map = MapModule.getMap();
    const offset = map.latLngToContainerPoint(selected.latlng);
    const newLL = map.containerPointToLatLng(L.point(offset.x + 30, offset.y + 30));
    placeVZ(selected.vzId, newLL, selected.size, selected.rotation);
  }

  function deleteSelected() {
    if (!selected) return;
    remove(selected);
    deselect();
  }

  function bringToFront() {
    if (selected?.marker) selected.marker.setZIndexOffset(1000);
  }

  function sendToBack() {
    if (selected?.marker) selected.marker.setZIndexOffset(-1000);
  }

  function undo() {
    const last = undoStack.pop();
    if (!last) return;
    const map = MapModule.getMap();
    if (last.action === 'add') {
      if (last.obj.marker) map.removeLayer(last.obj.marker);
      if (last.obj.layer) map.removeLayer(last.obj.layer);
      objects = objects.filter(o => o !== last.obj);
    }
    deselect();
    updateCount();
    UI.toast('Rückgängig');
  }

  function clearAll() {
    if (objects.length === 0) return;
    if (!confirm(`Alle ${objects.length} Objekte löschen?`)) return;
    const map = MapModule.getMap();
    objects.forEach(obj => {
      if (obj.marker) map.removeLayer(obj.marker);
      if (obj.layer) map.removeLayer(obj.layer);
    });
    objects = [];
    undoStack = [];
    deselect();
    updateCount();
    UI.toast('Alles gelöscht');
  }

  function updateCount() {
    document.getElementById('stObj').textContent = 'Objekte: ' + objects.length;
  }

  function getAll() { return objects; }

  return {
    add, remove, placeVZ, select, deselect, getSelected,
    updateSelected, duplicateSelected, deleteSelected,
    bringToFront, sendToBack, undo, clearAll, getAll
  };
})();
