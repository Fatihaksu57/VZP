// ═══════════════════════════════════════════════════
// VZP Editor — UI Module
// ═══════════════════════════════════════════════════

const UI = (() => {
  let currentTab = 'absperr'; // Start with most relevant tab for VZP
  let highlightedSigns = [];

  function init() {
    renderTabs();
    renderVZ(currentTab);
    renderRegelplaene();
    initSearch();
    initKeyboard();
    initDragDrop();
    setDate();
    document.addEventListener('click', hideCtxMenu);
  }

  /* ─── TABS ─── */
  function renderTabs() {
    const el = document.getElementById('tabs');
    el.innerHTML = '';
    const order = ['absperr', 'gefahr', 'vorschrift', 'richt', 'zusatz', 'wegweiser', 'sonstige'];
    order.forEach(catId => {
      const cat = VZ_CATEGORIES[catId];
      if (!cat) return;
      const count = VZ_CATALOG.filter(v => v.cat === catId).length;
      if (count === 0) return;
      const btn = document.createElement('button');
      btn.className = 'tab' + (catId === currentTab ? ' on' : '');
      btn.dataset.cat = catId;
      btn.textContent = cat.name.replace('zeichen', 'z.').replace('geräte', '');
      btn.onclick = () => {
        currentTab = catId;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
        btn.classList.add('on');
        renderVZ(catId);
      };
      el.appendChild(btn);
    });
  }

  /* ─── VZ LIST ─── */
  function renderVZ(catId, filter) {
    const list = document.getElementById('slist');
    list.innerHTML = '';

    let items = VZ_CATALOG.filter(v => v.cat === catId);
    if (filter) {
      const f = filter.toLowerCase();
      items = items.filter(v =>
        v.name.toLowerCase().includes(f) ||
        v.code.toLowerCase().includes(f) ||
        v.id.includes(f)
      );
    }

    items.forEach(vz => {
      const item = document.createElement('div');
      item.className = 'sitem' + (highlightedSigns.includes(vz.id) ? ' hl' : '');
      item.dataset.vzId = vz.id;
      item.draggable = true;
      item.innerHTML = `
        <div class="simg"><img src="assets/vz/${vz.file}" alt="${vz.code}" loading="lazy"></div>
        <div class="slbl">${vz.name}<span class="code">${vz.code}</span></div>
      `;
      list.appendChild(item);
    });

    // Count
    const countEl = document.getElementById('scount');
    if (countEl) countEl.textContent = items.length + ' Zeichen';
  }

  function filterVZ(query) {
    if (!query) {
      renderVZ(currentTab);
    } else {
      // Search across ALL categories
      const list = document.getElementById('slist');
      list.innerHTML = '';
      const f = query.toLowerCase();
      const items = VZ_CATALOG.filter(v =>
        v.name.toLowerCase().includes(f) ||
        v.code.toLowerCase().includes(f) ||
        v.id.includes(f)
      );
      items.forEach(vz => {
        const item = document.createElement('div');
        item.className = 'sitem' + (highlightedSigns.includes(vz.id) ? ' hl' : '');
        item.dataset.vzId = vz.id;
        item.draggable = true;
        item.innerHTML = `
          <div class="simg"><img src="assets/vz/${vz.file}" alt="${vz.code}" loading="lazy"></div>
          <div class="slbl">${vz.name}<span class="code">${vz.code}</span></div>
        `;
        list.appendChild(item);
      });
    }
  }

  /* ─── REGELPLÄNE ─── */
  function renderRegelplaene() {
    const el = document.getElementById('rpList');
    el.innerHTML = '';
    REGELPLAENE.forEach(rp => {
      const card = document.createElement('div');
      card.className = 'rcard';
      card.innerHTML = `
        <div class="rt">${rp.code} — ${rp.name}</div>
        <div class="rd">${rp.desc}</div>
        <div class="rb">${rp.signs.length} Zeichen</div>
      `;
      card.onclick = () => activateRegelplan(rp, card);
      el.appendChild(card);
    });
  }

  function activateRegelplan(rp, card) {
    document.querySelectorAll('.rcard').forEach(c => c.classList.remove('on'));
    card.classList.add('on');
    highlightedSigns = rp.signs;
    // Switch to first tab that has highlighted signs, prefer absperr
    const bestTab = ['absperr', 'gefahr', 'vorschrift', 'richt', 'zusatz']
      .find(cat => rp.signs.some(s => VZ_CATALOG.find(v => v.id === s && v.cat === cat)));
    if (bestTab) {
      currentTab = bestTab;
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('on', t.dataset.cat === bestTab);
      });
    }
    renderVZ(currentTab);

    // Map Regelplan code to engine ID
    const rpIdMap = { 'B I/1': 'BI1', 'B I/2': 'BI2', 'B II/1': 'BII1', 'B II/2': 'BII2', 'B II/3': 'BII3' };
    const engineId = rpIdMap[rp.code];
    if (engineId) {
      RegelplanEngine.generate(engineId);
    } else {
      toast(`Regelplan ${rp.code} — relevante Zeichen hervorgehoben`);
    }
  }

  /* ─── PROPERTIES PANEL ─── */
  function showProperties(obj) {
    if (obj.type !== 'symbol') return;
    const panel = document.getElementById('propP');
    panel.style.display = 'block';
    document.getElementById('pRot').value = obj.rotation || 0;
    document.getElementById('pRotV').textContent = (obj.rotation || 0) + '°';
    document.getElementById('pSz').value = obj.size || 50;
    document.getElementById('pSzV').textContent = obj.size || 50;
  }

  function hideProperties() {
    document.getElementById('propP').style.display = 'none';
  }

  /* ─── SEARCH ─── */
  function initSearch() {
    const input = document.getElementById('sInp');
    let timeout;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(timeout);
        MapModule.searchAddress(input.value);
      }
    });
    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (input.value.length > 3) MapModule.searchAddress(input.value);
      }, 600);
    });
  }

  /* ─── KEYBOARD ─── */
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'v' || e.key === 'Escape') DrawTools.setMode('select');
      else if (e.key === 'l') DrawTools.setMode('draw');
      else if (e.key === 'm') DrawTools.setMode('measure');
      else if (e.key === 'a') DrawTools.setMode('area');
      else if (e.key === 'Delete' || e.key === 'Backspace') ObjectManager.deleteSelected();
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ObjectManager.undo(); }
      else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ObjectManager.duplicateSelected(); }
    });
  }

  /* ─── DRAG & DROP ─── */
  function initDragDrop() {
    let dragVzId = null;

    document.addEventListener('dragstart', e => {
      const item = e.target.closest('.sitem');
      if (!item) return;
      dragVzId = item.dataset.vzId;
      e.dataTransfer.setData('text/plain', dragVzId);
      e.dataTransfer.effectAllowed = 'copy';
    });

    const mapEl = MapModule.getContainer();
    mapEl.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    mapEl.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragVzId) return;
      const map = MapModule.getMap();
      const rect = mapEl.getBoundingClientRect();
      const latlng = map.containerPointToLatLng(L.point(
        e.clientX - rect.left,
        e.clientY - rect.top
      ));
      ObjectManager.placeVZ(dragVzId, latlng);
      dragVzId = null;
    });
  }

  /* ─── CONTEXT MENU ─── */
  function showCtxMenu(x, y) {
    const menu = document.getElementById('ctx');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('show');
  }

  function hideCtxMenu() {
    document.getElementById('ctx').classList.remove('show');
  }

  function ctxAction(action) {
    hideCtxMenu();
    if (action === 'del') ObjectManager.deleteSelected();
    else if (action === 'dup') ObjectManager.duplicateSelected();
    else if (action === 'front') ObjectManager.bringToFront();
    else if (action === 'back') ObjectManager.sendToBack();
  }

  /* ─── TOAST ─── */
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  /* ─── HELPERS ─── */
  function setDate() {
    document.getElementById('pDate').value = new Date().toISOString().split('T')[0];
  }

  return {
    init, toast, showCtxMenu, hideCtxMenu, ctxAction,
    showProperties, hideProperties, filterVZ, renderVZ
  };
})();
