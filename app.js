// =========================================================
//  Pokémon Card Inventory Tracker — Renderer Logic
// =========================================================

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'%3E%3Crect fill='%230f3460' width='100' height='140'/%3E%3Ctext x='50' y='75' text-anchor='middle' fill='%23606080' font-size='11' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";

const CONDITIONS = {
  M:  'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  D:  'Damaged'
};

// ===== State =====
let inventory         = [];
let filteredInventory = [];
let selectedCard      = null;   // card object from TCG API during add flow
let currentDetailId   = null;   // inventory entry id open in detail modal
let searchTimer       = null;
let viewMode          = 'grid'; // 'grid' | 'list'

// ===== Boot =====
async function init() {
  inventory = (await window.electronAPI.loadInventory()) || [];
  renderAll();
  setupListeners();
}

// ===== Event Wiring =====
function setupListeners() {
  // Header
  document.getElementById('globalSearch').addEventListener('input', applyAndRender);
  document.getElementById('btnAddCard').addEventListener('click', () => openModal('addCardModal'));
  document.getElementById('btnExport').addEventListener('click', handleExport);
  document.getElementById('btnImport').addEventListener('click', handleImport);
  document.getElementById('btnBackups').addEventListener('click', openBackupModal);
  document.getElementById('btnSettings').addEventListener('click', openSettingsModal);
  document.getElementById('btnCheckUpdates').addEventListener('click', checkForUpdates);
  document.getElementById('btnOpenDataFolder').addEventListener('click', () => window.electronAPI.openDataFolder());
  document.getElementById('btnCreateBackup').addEventListener('click', createBackupNow);
  document.getElementById('btnOpenBackupFolder').addEventListener('click', () => window.electronAPI.backupOpenFolder());

  // Toolbar
  document.getElementById('sortBy').addEventListener('change', applyAndRender);
  document.getElementById('viewGrid').addEventListener('click', () => setView('grid'));
  document.getElementById('viewList').addEventListener('click', () => setView('list'));

  // Sidebar filters
  document.getElementById('filterSet').addEventListener('change', applyAndRender);
  document.getElementById('filterType').addEventListener('change', applyAndRender);
  document.getElementById('filterDateAdded').addEventListener('change', applyAndRender);
  document.getElementById('filterPriceMin').addEventListener('input', applyAndRender);
  document.getElementById('filterPriceMax').addEventListener('input', applyAndRender);
  document.getElementById('filterQtyMin').addEventListener('input', applyAndRender);
  document.querySelectorAll('#filterSupertype input').forEach(cb =>
    cb.addEventListener('change', applyAndRender)
  );
  document.getElementById('btnClearFilters').addEventListener('click', clearFilters);

  // Modal tabs
  document.getElementById('tabSearch').addEventListener('click', () => switchTab('search'));
  document.getElementById('tabManual').addEventListener('click', () => switchTab('manual'));

  // Manual entry form
  document.getElementById('btnConfirmManual').addEventListener('click', confirmAddManual);
  document.getElementById('btnManualLookup').addEventListener('click', () => {
    const q = document.getElementById('manualName').value.trim();
    if (q.length >= 2) lookupManualCard(q);
    else toast('Enter a card name first, then click Look Up Info.');
  });

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); })
  );

  // Add card modal — search input
  document.getElementById('cardSearchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) {
      document.getElementById('searchResults').innerHTML = '';
      document.getElementById('searchStatus').textContent = '';
      return;
    }
    document.getElementById('searchStatus').textContent = 'Searching…';
    searchTimer = setTimeout(() => fetchCards(q), 420);
  });

  // Add card modal — confirm / back
  document.getElementById('btnConfirmAdd').addEventListener('click', confirmAddCard);
  document.getElementById('btnCancelSelect').addEventListener('click', showSearchPanel);

  // Detail modal
  document.getElementById('btnSaveDetail').addEventListener('click', saveCardDetail);
  document.getElementById('btnDeleteCard').addEventListener('click', deleteCard);
  document.getElementById('btnRefreshPrice').addEventListener('click', refreshCardPrice);

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('addCardModal');
      closeModal('cardDetailModal');
    }
  });
}

// =========================================================
//  POKEMON TCG API
// =========================================================
async function fetchCards(query) {
  const status     = document.getElementById('searchStatus');
  const resultsDiv = document.getElementById('searchResults');
  try {
    const encoded = encodeURIComponent(query);
    const url     = `https://api.pokemontcg.io/v2/cards?q=name:${encoded}*&pageSize=24&select=id,name,set,number,rarity,supertype,types,images,tcgplayer&orderBy=name`;
    const resp    = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { data: cards = [] } = await resp.json();

    status.textContent = cards.length ? `${cards.length} result${cards.length > 1 ? 's' : ''} found` : 'No cards found — try a different name.';
    renderSearchResults(cards);
  } catch (err) {
    status.textContent = 'Search failed. Check your internet connection.';
    console.error('[TCG API]', err);
  }
}

function renderSearchResults(cards) {
  const div = document.getElementById('searchResults');
  div.innerHTML = '';
  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'search-card';

    const img = document.createElement('img');
    img.src = card.images?.small || FALLBACK_IMG;
    img.alt = card.name;
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.src = FALLBACK_IMG; });

    const name = document.createElement('div');
    name.className = 'search-card-name';
    name.textContent = card.name;

    const set = document.createElement('div');
    set.className = 'search-card-set';
    set.textContent = card.set?.name || '';

    el.append(img, name, set);
    el.addEventListener('click', () => openSelectedCardPanel(card));
    div.appendChild(el);
  });
}

function openSelectedCardPanel(card) {
  selectedCard = card;

  document.getElementById('searchPanel').style.display          = 'none';
  document.getElementById('selectedCardPanel').style.display    = 'flex';

  document.getElementById('selectedCardImg').src       = card.images?.large || card.images?.small || FALLBACK_IMG;
  document.getElementById('selectedCardName').textContent      = card.name;
  document.getElementById('selectedCardSetInfo').textContent   =
    `${card.set?.name || 'Unknown Set'} · #${card.number || '?'} · ${card.rarity || 'Unknown Rarity'}`;

  const price = extractPrice(card);
  document.getElementById('selectedCardPrice').textContent =
    price.market ? `Market price: $${price.market.toFixed(2)}` : '';

  document.getElementById('cardQuantity').value  = 1;
  document.getElementById('cardCondition').value = 'NM';
  document.getElementById('cardNotes').value     = '';
}

function showSearchPanel() {
  document.getElementById('searchPanel').style.display       = 'block';
  document.getElementById('selectedCardPanel').style.display = 'none';
  selectedCard = null;
}

async function confirmAddCard() {
  if (!selectedCard) return;

  const price = extractPrice(selectedCard);
  const entry = {
    id:        `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    cardId:    selectedCard.id,
    name:      selectedCard.name,
    supertype: selectedCard.supertype || 'Pokémon',
    set:       selectedCard.set   || null,
    number:    selectedCard.number || '',
    rarity:    selectedCard.rarity || 'Unknown',
    types:     selectedCard.types  || [],
    images:    selectedCard.images || {},
    price,
    quantity:  Math.max(1, parseInt(document.getElementById('cardQuantity').value)  || 1),
    condition: document.getElementById('cardCondition').value,
    notes:     document.getElementById('cardNotes').value.trim(),
    addedAt:   new Date().toISOString()
  };

  inventory.push(entry);
  await saveInventory();
  renderAll();
  closeModal('addCardModal');
  toast(`${entry.name} added to your collection!`, 'success');
}

// =========================================================
//  CARD DETAIL MODAL
// =========================================================
function openCardDetail(inventoryId) {
  const card = inventory.find(c => c.id === inventoryId);
  if (!card) return;
  currentDetailId = inventoryId;

  document.getElementById('detailCardName').textContent    = card.name;
  document.getElementById('detailCardImg').src             = card.images?.large || card.images?.small || FALLBACK_IMG;
  document.getElementById('detailSet').textContent         = card.set?.name || 'Unknown';
  document.getElementById('detailNumber').textContent      = `#${card.number || '?'}`;
  document.getElementById('detailRarity').textContent      = card.rarity || 'Unknown';
  document.getElementById('detailTypes').textContent       = card.types?.join(', ') || 'N/A';
  document.getElementById('detailPrice').textContent       = card.price?.market ? `$${card.price.market.toFixed(2)}` : 'N/A';
  document.getElementById('detailQuantity').value          = card.quantity;
  document.getElementById('detailCondition').value         = card.condition;
  document.getElementById('detailNotes').value             = card.notes || '';

  openModal('cardDetailModal');
}

async function saveCardDetail() {
  const card = inventory.find(c => c.id === currentDetailId);
  if (!card) return;

  card.quantity  = Math.max(1, parseInt(document.getElementById('detailQuantity').value) || 1);
  card.condition = document.getElementById('detailCondition').value;
  card.notes     = document.getElementById('detailNotes').value.trim();

  await saveInventory();
  renderAll();
  closeModal('cardDetailModal');
  toast('Card updated!', 'success');
}

async function deleteCard() {
  const confirmed = await window.electronAPI.showConfirm(
    'Remove Card',
    'Remove this card from your inventory? This cannot be undone.'
  );
  if (!confirmed) return;

  inventory = inventory.filter(c => c.id !== currentDetailId);
  await saveInventory();
  renderAll();
  closeModal('cardDetailModal');
  toast('Card removed from inventory.');
}

async function refreshCardPrice() {
  const card = inventory.find(c => c.id === currentDetailId);
  if (!card?.cardId) return;

  try {
    document.getElementById('btnRefreshPrice').textContent = '↻ …';
    const resp = await fetch(`https://api.pokemontcg.io/v2/cards/${card.cardId}?select=id,tcgplayer`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { data } = await resp.json();
    if (data?.tcgplayer) {
      card.price = extractPrice(data);
      await saveInventory();
      document.getElementById('detailPrice').textContent =
        card.price?.market ? `$${card.price.market.toFixed(2)}` : 'N/A';
      toast('Price refreshed!', 'success');
      renderAll();
    } else {
      toast('No price data available for this card.');
    }
  } catch {
    toast('Could not refresh price — check internet connection.');
  } finally {
    document.getElementById('btnRefreshPrice').textContent = '↻ Refresh';
  }
}

// =========================================================
//  RENDER
// =========================================================
function renderAll() {
  applyAndRender();
  updateFilterOptions();
  updateStats();
}

function applyAndRender() {
  const searchQ           = document.getElementById('globalSearch').value.toLowerCase().trim();
  const filterSet         = document.getElementById('filterSet').value;
  const filterType        = document.getElementById('filterType').value;
  const checkedConds      = checkedValues('#filterCondition input');
  const checkedRarities   = checkedValues('#filterRarity input');
  const checkedSupertypes = checkedValues('#filterSupertype input');
  const priceMin  = parseFloat(document.getElementById('filterPriceMin').value)  || null;
  const priceMax  = parseFloat(document.getElementById('filterPriceMax').value)  || null;
  const dateDays  = parseInt(document.getElementById('filterDateAdded').value)   || null;
  const qtyMin    = parseInt(document.getElementById('filterQtyMin').value)      || null;

  filteredInventory = inventory.filter(card => {
    if (searchQ && !card.name.toLowerCase().includes(searchQ) &&
        !(card.set?.name || '').toLowerCase().includes(searchQ)) return false;
    if (filterSet  && card.set?.id      !== filterSet)              return false;
    if (filterType && !card.types?.includes(filterType))            return false;
    if (checkedConds.length    && !checkedConds.includes(card.condition)) return false;
    if (checkedRarities.length && !checkedRarities.includes(card.rarity)) return false;
    if (checkedSupertypes.length && !checkedSupertypes.includes(card.supertype)) return false;
    if (priceMin !== null && (card.price?.market || 0) < priceMin) return false;
    if (priceMax !== null && (card.price?.market || 0) > priceMax) return false;
    if (dateDays !== null) {
      const cutoff = new Date(Date.now() - dateDays * 864e5);
      if (new Date(card.addedAt) < cutoff) return false;
    }
    if (qtyMin !== null && card.quantity < qtyMin) return false;
    return true;
  });

  // Sort
  const sortBy = document.getElementById('sortBy').value;
  filteredInventory.sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':      return a.name.localeCompare(b.name);
      case 'name-desc':     return b.name.localeCompare(a.name);
      case 'set-asc':       return (a.set?.name || '').localeCompare(b.set?.name || '');
      case 'value-desc':    return (b.price?.market || 0) - (a.price?.market || 0);
      case 'value-asc':     return (a.price?.market || 0) - (b.price?.market || 0);
      case 'added-desc':    return new Date(b.addedAt) - new Date(a.addedAt);
      case 'quantity-desc': return b.quantity - a.quantity;
      default: return 0;
    }
  });

  renderCards();
}

function renderCards() {
  const grid  = document.getElementById('cardGrid');
  const empty = document.getElementById('emptyState');

  document.getElementById('resultsCount').textContent =
    `${filteredInventory.length} card${filteredInventory.length !== 1 ? 's' : ''}`;

  if (inventory.length === 0) {
    grid.innerHTML       = '';
    grid.style.display   = 'none';
    empty.style.display  = 'flex';
    return;
  }

  empty.style.display = 'none';
  grid.style.display  = viewMode === 'grid' ? 'grid' : 'flex';

  if (filteredInventory.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px 0">
      No cards match your current filters.
    </p>`;
    return;
  }

  grid.innerHTML = '';
  filteredInventory.forEach(card => {
    const el = document.createElement('div');
    el.className = 'inv-card';

    const img = document.createElement('img');
    img.className = 'inv-card-img';
    img.src = card.images?.small || FALLBACK_IMG;
    img.alt = card.name;
    img.addEventListener('error', () => { img.src = FALLBACK_IMG; });

    const price = card.price?.market ? `$${card.price.market.toFixed(2)}` : '';
    const info = document.createElement('div');
    info.className = 'inv-card-info';
    info.innerHTML = `
      <div class="inv-card-name">${escHtml(card.name)}</div>
      <div class="inv-card-set">${escHtml(card.set?.name || '')} ${card.number ? '#' + escHtml(card.number) : ''}</div>
      <div class="inv-card-footer">
        <span class="badge-qty">×${card.quantity}</span>
        <span class="badge-cond">${escHtml(card.condition)}</span>
        ${price ? `<span class="badge-price">${price}</span>` : ''}
      </div>
    `;

    el.append(img, info);
    el.addEventListener('click', () => openCardDetail(card.id));
    grid.appendChild(el);
  });
}

function updateStats() {
  const total  = inventory.reduce((s, c) => s + c.quantity, 0);
  const unique = inventory.length;
  const sets   = new Set(inventory.map(c => c.set?.id).filter(Boolean)).size;
  const value  = inventory.reduce((s, c) => s + (c.price?.market || 0) * c.quantity, 0);

  document.getElementById('statTotal').textContent  = total;
  document.getElementById('statUnique').textContent = unique;
  document.getElementById('statSets').textContent   = sets;
  document.getElementById('statValue').textContent  = `$${value.toFixed(0)}`;
}

function updateFilterOptions() {
  // Conditions
  rebuildCheckboxes('#filterCondition',
    [...new Set(inventory.map(c => c.condition))].sort(),
    v => `${v} — ${CONDITIONS[v] || v}`
  );
  // Rarities
  rebuildCheckboxes('#filterRarity',
    [...new Set(inventory.map(c => c.rarity).filter(Boolean))].sort()
  );

  // Sets dropdown
  const sets      = [...new Map(inventory.map(c => [c.set?.id, c.set])).values()].filter(Boolean)
                      .sort((a, b) => a.name.localeCompare(b.name));
  const setSelect = document.getElementById('filterSet');
  const curSet    = setSelect.value;
  setSelect.innerHTML = '<option value="">All Sets</option>';
  sets.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name;
    setSelect.appendChild(o);
  });
  setSelect.value = curSet;

  // Types dropdown
  const types      = [...new Set(inventory.flatMap(c => c.types || []))].sort();
  const typeSelect = document.getElementById('filterType');
  const curType    = typeSelect.value;
  typeSelect.innerHTML = '<option value="">All Types</option>';
  types.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    typeSelect.appendChild(o);
  });
  typeSelect.value = curType;
}

function rebuildCheckboxes(selector, values, labelFn = v => v) {
  const container = document.querySelector(selector);
  const prevChecked = checkedValues(`${selector} input`);
  container.innerHTML = '';
  values.forEach(v => {
    const lbl = document.createElement('label');
    lbl.className = 'checkbox-item';
    lbl.innerHTML = `<input type="checkbox" value="${escHtml(v)}"> ${escHtml(labelFn(v))}`;
    const cb = lbl.querySelector('input');
    if (prevChecked.includes(v)) cb.checked = true;
    cb.addEventListener('change', applyAndRender);
    container.appendChild(lbl);
  });
}

// =========================================================
//  VIEW / FILTERS
// =========================================================
function setView(mode) {
  viewMode = mode;
  document.getElementById('cardGrid').className = mode === 'list' ? 'card-grid list-view' : 'card-grid';
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
  renderCards();
}

function clearFilters() {
  document.getElementById('globalSearch').value   = '';
  document.getElementById('filterSet').value      = '';
  document.getElementById('filterType').value     = '';
  document.getElementById('filterDateAdded').value = '';
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.getElementById('filterQtyMin').value   = '';
  document.querySelectorAll('#filterCondition input, #filterRarity input, #filterSupertype input')
    .forEach(i => i.checked = false);
  applyAndRender();
}

// =========================================================
//  MODAL HELPERS
// =========================================================
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  if (id === 'addCardModal') {
    switchTab('search');
    document.getElementById('cardSearchInput').value    = '';
    document.getElementById('searchResults').innerHTML  = '';
    document.getElementById('searchStatus').textContent = '';
    resetManualForm();
    setTimeout(() => document.getElementById('cardSearchInput').focus(), 60);
  }
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// =========================================================
//  EXPORT / IMPORT
// =========================================================
async function handleExport() {
  if (inventory.length === 0) { toast('Nothing to export — add some cards first!'); return; }
  const ok = await window.electronAPI.exportCSV(inventory);
  if (ok) toast('Inventory exported to CSV!', 'success');
}

async function handleImport() {
  const data = await window.electronAPI.importJSON();
  if (!data) return;
  if (!Array.isArray(data)) { toast('Invalid file — expected a JSON array.'); return; }
  inventory = data;
  await saveInventory();
  renderAll();
  toast(`Imported ${inventory.length} card${inventory.length !== 1 ? 's' : ''}!`, 'success');
}

// =========================================================
//  BACKUP MANAGER
// =========================================================
async function openBackupModal() {
  document.getElementById('backupModal').style.display = 'flex';
  await refreshBackupList();
}

async function refreshBackupList() {
  const listEl = document.getElementById('backupList');
  listEl.innerHTML = '<div class="backup-loading">Loading…</div>';
  const backups = await window.electronAPI.backupList();

  if (!backups.length) {
    listEl.innerHTML = '<div class="backup-empty">No backups yet. Click <strong>Create Backup Now</strong> to make one.</div>';
    return;
  }

  listEl.innerHTML = '';
  backups.forEach(b => {
    const date   = new Date(b.mtime);
    const label  = b.filename.includes('-auto')
                 ? 'auto'
                 : b.filename.includes('-pre-restore')
                 ? 'pre-restore'
                 : 'manual';
    const labelClass = `backup-label-${label}`;
    const labelText  = label === 'pre-restore' ? 'pre-restore' : label;
    const sizeKB     = (b.size / 1024).toFixed(1);

    const row = document.createElement('div');
    row.className = 'backup-item';
    row.innerHTML = `
      <span class="backup-icon">💾</span>
      <div class="backup-meta">
        <div class="backup-date">${date.toLocaleString()}</div>
        <div class="backup-details">${b.count} card${b.count !== 1 ? 's' : ''} · ${sizeKB} KB · ${b.filename}</div>
      </div>
      <span class="backup-label ${labelClass}">${labelText}</span>
      <div class="backup-actions">
        <button class="btn btn-secondary btn-sm btn-restore" data-file="${escHtml(b.filename)}">Restore</button>
        <button class="btn btn-danger btn-sm btn-del-backup" data-file="${escHtml(b.filename)}">✕</button>
      </div>
    `;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll('.btn-restore').forEach(btn =>
    btn.addEventListener('click', () => restoreBackup(btn.dataset.file))
  );
  listEl.querySelectorAll('.btn-del-backup').forEach(btn =>
    btn.addEventListener('click', () => deleteBackup(btn.dataset.file))
  );
}

async function createBackupNow() {
  const btn = document.getElementById('btnCreateBackup');
  btn.disabled    = true;
  btn.textContent = 'Creating…';
  const result = await window.electronAPI.backupCreate();
  btn.disabled    = false;
  btn.textContent = '+ Create Backup Now';
  if (result.ok) {
    toast('Backup created!', 'success');
    await refreshBackupList();
  } else {
    toast('Backup failed: ' + (result.error || 'unknown error'));
  }
}

async function restoreBackup(filename) {
  const confirmed = await window.electronAPI.showConfirm(
    'Restore Backup',
    `Restore inventory from this backup?\n\nYour current inventory will be saved as a pre-restore backup first.`
  );
  if (!confirmed) return;

  const result = await window.electronAPI.backupRestore(filename);
  if (result.ok) {
    inventory = result.data || [];
    renderAll();
    closeModal('backupModal');
    toast('Inventory restored from backup!', 'success');
  } else {
    toast('Restore failed: ' + (result.error || 'unknown error'));
  }
}

async function deleteBackup(filename) {
  const confirmed = await window.electronAPI.showConfirm(
    'Delete Backup',
    `Permanently delete this backup file?\n${filename}`
  );
  if (!confirmed) return;
  const ok = await window.electronAPI.backupDelete(filename);
  if (ok) {
    toast('Backup deleted.');
    await refreshBackupList();
  }
}


// =========================================================
//  SETTINGS
// =========================================================
async function openSettingsModal() {
  document.getElementById('settingsModal').style.display = 'flex';
  const ver = await window.electronAPI.getAppVersion();
  document.getElementById('settingsVersion').textContent = `v${ver}`;
  document.getElementById('updateStatus').textContent    = '';
  document.getElementById('updateStatus').className      = 'update-status';
}

async function checkForUpdates() {
  const btn    = document.getElementById('btnCheckUpdates');
  const status = document.getElementById('updateStatus');
  btn.disabled    = true;
  btn.textContent = 'Checking…';
  status.className      = 'update-status';
  status.textContent    = '';

  const result = await window.electronAPI.checkForUpdates();
  btn.disabled    = false;
  btn.textContent = 'Check for Updates';

  if (!result.ok) {
    status.className   = 'update-status error';
    status.textContent = `Error: ${result.error}`;
    return;
  }

  const current = result.current.split('.').map(Number);
  const latest  = result.latest.split('.').map(Number);
  const isNewer = latest.some((n, i) => n > (current[i] || 0));
  const isSame  = !isNewer && latest.every((n, i) => n === (current[i] || 0));

  if (isNewer) {
    status.className   = 'update-status new';
    status.textContent = `Update available: v${result.latest} — visit GitHub to download.`;
  } else if (isSame) {
    status.className   = 'update-status ok';
    status.textContent = `You're up to date (v${result.current}).`;
  } else {
    status.className   = 'update-status ok';
    status.textContent = `You're running a pre-release build (v${result.current}).`;
  }
}

// =========================================================
//  MANUAL ENTRY — API CROSS-REFERENCE
// =========================================================
async function lookupManualCard(query) {
  const resultsDiv = document.getElementById('manualLookupResults');
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = '<div class="manual-lookup-status">Searching…</div>';
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.pokemontcg.io/v2/cards?q=name:${encoded}*&pageSize=20&select=id,name,set,number,rarity,supertype,types,images,tcgplayer&orderBy=name`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { data: cards = [] } = await resp.json();
    renderManualLookupResults(cards);
  } catch {
    resultsDiv.innerHTML = '<div class="manual-lookup-status">Search failed — check your internet connection.</div>';
  }
}

function renderManualLookupResults(cards) {
  const resultsDiv = document.getElementById('manualLookupResults');
  if (!cards.length) {
    resultsDiv.innerHTML = '<div class="manual-lookup-status">No cards found.</div>';
    return;
  }
  resultsDiv.innerHTML = '';
  cards.forEach(card => {
    const item = document.createElement('div');
    item.className = 'manual-lookup-item';

    const img = document.createElement('img');
    img.src = card.images?.small || FALLBACK_IMG;
    img.alt = card.name;
    img.addEventListener('error', () => { img.src = FALLBACK_IMG; });

    const info = document.createElement('div');
    info.className = 'manual-lookup-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'manual-lookup-name';
    nameEl.textContent = card.name;
    const metaEl = document.createElement('div');
    metaEl.className = 'manual-lookup-meta';
    metaEl.textContent = `${card.set?.name || 'Unknown Set'} · #${card.number || '?'} · ${card.rarity || ''}`;
    info.append(nameEl, metaEl);

    item.append(img, info);
    item.addEventListener('click', () => fillManualFromCard(card));
    resultsDiv.appendChild(item);
  });
}

function fillManualFromCard(card) {
  const price = extractPrice(card);
  document.getElementById('manualName').value     = card.name || '';
  document.getElementById('manualSupertype').value = card.supertype || 'Pokémon';
  document.getElementById('manualSet').value      = card.set?.name || '';
  document.getElementById('manualNumber').value   = card.number || '';
  document.getElementById('manualRarity').value   = card.rarity || '';
  document.getElementById('manualTypes').value    = (card.types || []).join(', ');
  document.getElementById('manualPrice').value    = price.market > 0 ? price.market.toFixed(2) : '';
  document.getElementById('manualImageUrl').value = card.images?.small || '';

  document.getElementById('manualLookupResults').style.display = 'none';
}

// =========================================================
//  MODAL TAB SWITCHING
// =========================================================
function switchTab(tab) {
  const isSearch = tab === 'search';
  document.getElementById('tabSearch').classList.toggle('active', isSearch);
  document.getElementById('tabManual').classList.toggle('active', !isSearch);
  document.getElementById('searchPanel').style.display        = isSearch ? 'block' : 'none';
  document.getElementById('selectedCardPanel').style.display  = 'none';
  document.getElementById('manualPanel').style.display        = isSearch ? 'none' : 'block';
  if (isSearch) {
    selectedCard = null;
    setTimeout(() => document.getElementById('cardSearchInput').focus(), 60);
  }
}

function resetManualForm() {
  ['manualName','manualSet','manualNumber','manualRarity','manualTypes','manualImageUrl','manualNotes']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('manualSupertype').value  = 'Pokémon';
  document.getElementById('manualQuantity').value   = '1';
  document.getElementById('manualCondition').value  = 'NM';
  document.getElementById('manualPrice').value      = '';
  document.getElementById('manualLookupResults').style.display = 'none';
}

async function confirmAddManual() {
  const name = document.getElementById('manualName').value.trim();
  if (!name) { toast('Card name is required.'); return; }

  const typesRaw = document.getElementById('manualTypes').value.trim();
  const types    = typesRaw ? typesRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = document.getElementById('manualImageUrl').value.trim();
  const price    = parseFloat(document.getElementById('manualPrice').value) || 0;

  const entry = {
    id:        `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    cardId:    null,
    name,
    supertype: document.getElementById('manualSupertype').value,
    set:       { id: null, name: document.getElementById('manualSet').value.trim() || 'Unknown' },
    number:    document.getElementById('manualNumber').value.trim(),
    rarity:    document.getElementById('manualRarity').value.trim() || 'Unknown',
    types,
    images:    { small: imageUrl, large: imageUrl },
    price:     { market: price, low: 0, high: 0, mid: 0 },
    quantity:  Math.max(1, parseInt(document.getElementById('manualQuantity').value) || 1),
    condition: document.getElementById('manualCondition').value,
    notes:     document.getElementById('manualNotes').value.trim(),
    addedAt:   new Date().toISOString()
  };

  inventory.push(entry);
  await saveInventory();
  renderAll();
  closeModal('addCardModal');
  toast(`${entry.name} added to your collection!`, 'success');
}

async function saveInventory() {
  await window.electronAPI.saveInventory(inventory);
}

// =========================================================
//  UTILS
// =========================================================
function extractPrice(card) {
  const tcg = card.tcgplayer?.prices;
  if (!tcg) return { market: 0, low: 0, high: 0, mid: 0 };
  const key = 'holofoil' in tcg ? 'holofoil'
            : 'normal'   in tcg ? 'normal'
            : Object.keys(tcg)[0];
  const p   = tcg[key] || {};
  return {
    market: p.market || p.mid || 0,
    low:    p.low    || 0,
    high:   p.high   || 0,
    mid:    p.mid    || 0
  };
}

function checkedValues(selector) {
  return [...document.querySelectorAll(selector)]
    .filter(i => i.checked)
    .map(i => i.value);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(message, type = '') {
  const el = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ===== Start =====
init();
