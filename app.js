const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'%3E%3Crect fill='%230f3460' width='100' height='140'/%3E%3Ctext x='50' y='75' text-anchor='middle' fill='%23606080' font-size='11' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";

const CONDITIONS = { M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', D: 'Damaged' };

let inventory = [], filteredInventory = [], selectedCard = null, currentDetailId = null, searchTimer = null, viewMode = 'grid';

async function init() {
  inventory = (await window.electronAPI.loadInventory()) || [];
  renderAll();
  setupListeners();
}

function setupListeners() {
  document.getElementById('globalSearch').addEventListener('input', applyAndRender);
  document.getElementById('btnAddCard').addEventListener('click', () => openModal('addCardModal'));
  document.getElementById('btnExport').addEventListener('click', handleExport);
  document.getElementById('btnImport').addEventListener('click', handleImport);
  document.getElementById('btnBackups').addEventListener('click', openBackupModal);
  document.getElementById('btnCreateBackup').addEventListener('click', createBackupNow);
  document.getElementById('btnOpenBackupFolder').addEventListener('click', () => window.electronAPI.backupOpenFolder());
  document.getElementById('sortBy').addEventListener('change', applyAndRender);
  document.getElementById('viewGrid').addEventListener('click', () => setView('grid'));
  document.getElementById('viewList').addEventListener('click', () => setView('list'));
  document.getElementById('filterSet').addEventListener('change', applyAndRender);
  document.getElementById('filterType').addEventListener('change', applyAndRender);
  document.getElementById('btnClearFilters').addEventListener('click', clearFilters);
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); }));
  document.getElementById('cardSearchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { document.getElementById('searchResults').innerHTML = ''; document.getElementById('searchStatus').textContent = ''; return; }
    document.getElementById('searchStatus').textContent = 'Searching\u2026';
    searchTimer = setTimeout(() => fetchCards(q), 420);
  });
  document.getElementById('btnConfirmAdd').addEventListener('click', confirmAddCard);
  document.getElementById('btnCancelSelect').addEventListener('click', showSearchPanel);
  document.getElementById('btnSaveDetail').addEventListener('click', saveCardDetail);
  document.getElementById('btnDeleteCard').addEventListener('click', deleteCard);
  document.getElementById('btnRefreshPrice').addEventListener('click', refreshCardPrice);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal('addCardModal'); closeModal('cardDetailModal'); closeModal('backupModal'); }
  });
}

async function fetchCards(query) {
  const status = document.getElementById('searchStatus');
  try {
    const url  = `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}*&pageSize=24&select=id,name,set,number,rarity,types,images,tcgplayer&orderBy=name`;
    const resp = await fetch(url);
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
    el.innerHTML = `<img src="${card.images?.small || FALLBACK_IMG}" alt="${escHtml(card.name)}" loading="lazy" onerror="this.src='${FALLBACK_IMG}'">
      <div class="search-card-name">${escHtml(card.name)}</div>
      <div class="search-card-set">${escHtml(card.set?.name || '')}</div>`;
    el.addEventListener('click', () => openSelectedCardPanel(card));
    div.appendChild(el);
  });
}

function openSelectedCardPanel(card) {
  selectedCard = card;
  document.getElementById('searchPanel').style.display       = 'none';
  document.getElementById('selectedCardPanel').style.display = 'flex';
  document.getElementById('selectedCardImg').src             = card.images?.large || card.images?.small || FALLBACK_IMG;
  document.getElementById('selectedCardName').textContent    = card.name;
  document.getElementById('selectedCardSetInfo').textContent = `${card.set?.name || 'Unknown Set'} · #${card.number || '?'} · ${card.rarity || 'Unknown Rarity'}`;
  const price = extractPrice(card);
  document.getElementById('selectedCardPrice').textContent   = price.market ? `Market price: $${price.market.toFixed(2)}` : '';
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
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    cardId: selectedCard.id, name: selectedCard.name, set: selectedCard.set || null,
    number: selectedCard.number || '', rarity: selectedCard.rarity || 'Unknown',
    types: selectedCard.types || [], images: selectedCard.images || {}, price,
    quantity:  Math.max(1, parseInt(document.getElementById('cardQuantity').value) || 1),
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

function openCardDetail(inventoryId) {
  const card = inventory.find(c => c.id === inventoryId);
  if (!card) return;
  currentDetailId = inventoryId;
  document.getElementById('detailCardName').textContent  = card.name;
  document.getElementById('detailCardImg').src           = card.images?.large || card.images?.small || FALLBACK_IMG;
  document.getElementById('detailSet').textContent       = card.set?.name || 'Unknown';
  document.getElementById('detailNumber').textContent    = `#${card.number || '?'}`;
  document.getElementById('detailRarity').textContent    = card.rarity || 'Unknown';
  document.getElementById('detailTypes').textContent     = card.types?.join(', ') || 'N/A';
  document.getElementById('detailPrice').textContent     = card.price?.market ? `$${card.price.market.toFixed(2)}` : 'N/A';
  document.getElementById('detailQuantity').value        = card.quantity;
  document.getElementById('detailCondition').value       = card.condition;
  document.getElementById('detailNotes').value           = card.notes || '';
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
  const confirmed = await window.electronAPI.showConfirm('Remove Card', 'Remove this card from your inventory? This cannot be undone.');
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
      document.getElementById('detailPrice').textContent = card.price?.market ? `$${card.price.market.toFixed(2)}` : 'N/A';
      toast('Price refreshed!', 'success');
      renderAll();
    } else {
      toast('No price data available for this card.');
    }
  } catch { toast('Could not refresh price — check internet connection.'); }
  finally { document.getElementById('btnRefreshPrice').textContent = '↻ Refresh'; }
}

function renderAll() { applyAndRender(); updateFilterOptions(); updateStats(); }

function applyAndRender() {
  const searchQ         = document.getElementById('globalSearch').value.toLowerCase().trim();
  const filterSet       = document.getElementById('filterSet').value;
  const filterType      = document.getElementById('filterType').value;
  const checkedConds    = checkedValues('#filterCondition input');
  const checkedRarities = checkedValues('#filterRarity input');
  filteredInventory = inventory.filter(card => {
    if (searchQ && !card.name.toLowerCase().includes(searchQ) && !(card.set?.name || '').toLowerCase().includes(searchQ)) return false;
    if (filterSet  && card.set?.id    !== filterSet)           return false;
    if (filterType && !card.types?.includes(filterType))       return false;
    if (checkedConds.length    && !checkedConds.includes(card.condition)) return false;
    if (checkedRarities.length && !checkedRarities.includes(card.rarity)) return false;
    return true;
  });
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
  document.getElementById('resultsCount').textContent = `${filteredInventory.length} card${filteredInventory.length !== 1 ? 's' : ''}`;
  if (inventory.length === 0) { grid.innerHTML = ''; grid.style.display = 'none'; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  grid.style.display  = viewMode === 'grid' ? 'grid' : 'flex';
  if (filteredInventory.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px 0">No cards match your current filters.</p>`;
    return;
  }
  grid.innerHTML = '';
  filteredInventory.forEach(card => {
    const el    = document.createElement('div');
    el.className = 'inv-card';
    const price = card.price?.market ? `$${card.price.market.toFixed(2)}` : '';
    el.innerHTML = `
      <img class="inv-card-img" src="${card.images?.small || FALLBACK_IMG}" alt="${escHtml(card.name)}" loading="lazy" onerror="this.src='${FALLBACK_IMG}'">
      <div class="inv-card-info">
        <div class="inv-card-name">${escHtml(card.name)}</div>
        <div class="inv-card-set">${escHtml(card.set?.name || '')} ${card.number ? '#' + card.number : ''}</div>
        <div class="inv-card-footer">
          <span class="badge-qty">×${card.quantity}</span>
          <span class="badge-cond">${card.condition}</span>
          ${price ? `<span class="badge-price">${price}</span>` : ''}
        </div>
      </div>`;
    el.addEventListener('click', () => openCardDetail(card.id));
    grid.appendChild(el);
  });
}

function updateStats() {
  const total  = inventory.reduce((s, c) => s + c.quantity, 0);
  const sets   = new Set(inventory.map(c => c.set?.id).filter(Boolean)).size;
  const value  = inventory.reduce((s, c) => s + (c.price?.market || 0) * c.quantity, 0);
  document.getElementById('statTotal').textContent  = total;
  document.getElementById('statUnique').textContent = inventory.length;
  document.getElementById('statSets').textContent   = sets;
  document.getElementById('statValue').textContent  = `$${value.toFixed(0)}`;
}

function updateFilterOptions() {
  rebuildCheckboxes('#filterCondition', [...new Set(inventory.map(c => c.condition))].sort(), v => `${v} — ${CONDITIONS[v] || v}`);
  rebuildCheckboxes('#filterRarity',    [...new Set(inventory.map(c => c.rarity).filter(Boolean))].sort());
  const sets      = [...new Map(inventory.map(c => [c.set?.id, c.set])).values()].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const setSelect = document.getElementById('filterSet');
  const curSet    = setSelect.value;
  setSelect.innerHTML = '<option value="">All Sets</option>';
  sets.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; setSelect.appendChild(o); });
  setSelect.value = curSet;
  const types      = [...new Set(inventory.flatMap(c => c.types || []))].sort();
  const typeSelect = document.getElementById('filterType');
  const curType    = typeSelect.value;
  typeSelect.innerHTML = '<option value="">All Types</option>';
  types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeSelect.appendChild(o); });
  typeSelect.value = curType;
}

function rebuildCheckboxes(selector, values, labelFn = v => v) {
  const container   = document.querySelector(selector);
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

function setView(mode) {
  viewMode = mode;
  document.getElementById('cardGrid').className = mode === 'list' ? 'card-grid list-view' : 'card-grid';
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
  renderCards();
}

function clearFilters() {
  document.getElementById('globalSearch').value = '';
  document.getElementById('filterSet').value    = '';
  document.getElementById('filterType').value   = '';
  document.querySelectorAll('#filterCondition input, #filterRarity input').forEach(i => i.checked = false);
  applyAndRender();
}

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  if (id === 'addCardModal') {
    showSearchPanel();
    document.getElementById('cardSearchInput').value    = '';
    document.getElementById('searchResults').innerHTML  = '';
    document.getElementById('searchStatus').textContent = '';
    setTimeout(() => document.getElementById('cardSearchInput').focus(), 60);
  }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

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

async function openBackupModal() {
  document.getElementById('backupModal').style.display = 'flex';
  await refreshBackupList();
}

async function refreshBackupList() {
  const listEl = document.getElementById('backupList');
  listEl.innerHTML = '<div class="backup-loading">Loading…</div>';
  const backups = await window.electronAPI.backupList();
  if (!backups.length) { listEl.innerHTML = '<div class="backup-empty">No backups yet. Click <strong>Create Backup Now</strong> to make one.</div>'; return; }
  listEl.innerHTML = '';
  backups.forEach(b => {
    const date      = new Date(b.mtime);
    const label     = b.filename.includes('-auto') ? 'auto' : b.filename.includes('-pre-restore') ? 'pre-restore' : 'manual';
    const labelClass = `backup-label-${label}`;
    const row = document.createElement('div');
    row.className = 'backup-item';
    row.innerHTML = `
      <span class="backup-icon">💾</span>
      <div class="backup-meta">
        <div class="backup-date">${date.toLocaleString()}</div>
        <div class="backup-details">${b.count} card${b.count !== 1 ? 's' : ''} · ${(b.size/1024).toFixed(1)} KB · ${b.filename}</div>
      </div>
      <span class="backup-label ${labelClass}">${label}</span>
      <div class="backup-actions">
        <button class="btn btn-secondary btn-sm btn-restore" data-file="${escHtml(b.filename)}">Restore</button>
        <button class="btn btn-danger btn-sm btn-del-backup" data-file="${escHtml(b.filename)}">✕</button>
      </div>`;
    listEl.appendChild(row);
  });
  listEl.querySelectorAll('.btn-restore').forEach(btn => btn.addEventListener('click', () => restoreBackup(btn.dataset.file)));
  listEl.querySelectorAll('.btn-del-backup').forEach(btn => btn.addEventListener('click', () => deleteBackup(btn.dataset.file)));
}

async function createBackupNow() {
  const btn = document.getElementById('btnCreateBackup');
  btn.disabled = true; btn.textContent = 'Creating…';
  const result = await window.electronAPI.backupCreate();
  btn.disabled = false; btn.textContent = '+ Create Backup Now';
  if (result.ok) { toast('Backup created!', 'success'); await refreshBackupList(); }
  else toast('Backup failed: ' + (result.error || 'unknown error'));
}

async function restoreBackup(filename) {
  const confirmed = await window.electronAPI.showConfirm('Restore Backup', `Restore inventory from this backup?\n\nYour current inventory will be saved as a pre-restore backup first.`);
  if (!confirmed) return;
  const result = await window.electronAPI.backupRestore(filename);
  if (result.ok) { inventory = result.data || []; renderAll(); closeModal('backupModal'); toast('Inventory restored from backup!', 'success'); }
  else toast('Restore failed: ' + (result.error || 'unknown error'));
}

async function deleteBackup(filename) {
  const confirmed = await window.electronAPI.showConfirm('Delete Backup', `Permanently delete this backup file?\n${filename}`);
  if (!confirmed) return;
  const ok = await window.electronAPI.backupDelete(filename);
  if (ok) { toast('Backup deleted.'); await refreshBackupList(); }
}

async function saveInventory() { await window.electronAPI.saveInventory(inventory); }

function extractPrice(card) {
  const tcg = card.tcgplayer?.prices;
  if (!tcg) return { market: 0, low: 0, high: 0, mid: 0 };
  const key = 'holofoil' in tcg ? 'holofoil' : 'normal' in tcg ? 'normal' : Object.keys(tcg)[0];
  const p   = tcg[key] || {};
  return { market: p.market || p.mid || 0, low: p.low || 0, high: p.high || 0, mid: p.mid || 0 };
}

function checkedValues(selector) {
  return [...document.querySelectorAll(selector)].filter(i => i.checked).map(i => i.value);
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

init();
