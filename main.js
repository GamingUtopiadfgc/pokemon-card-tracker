const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let inventoryPath;
let backupDir;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Pokémon Card Inventory Tracker',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  inventoryPath = path.join(app.getPath('userData'), 'poke-inventory.json');
  backupDir     = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  autoBackupOnLaunch();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('load-inventory', () => {
  try {
    if (fs.existsSync(inventoryPath)) {
      return JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));
    }
    return [];
  } catch {
    return [];
  }
});

ipcMain.handle('save-inventory', (_event, inventory) => {
  try {
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('export-csv', async (_event, inventory) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Inventory as CSV',
    defaultPath: 'pokemon-inventory.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (!filePath) return false;

  const headers = ['Name', 'Set', 'Number', 'Rarity', 'Types', 'Condition', 'Quantity', 'Market Price', 'Total Value', 'Notes'];
  const rows = inventory.map(item => [
    item.name,
    item.set?.name || '',
    item.number || '',
    item.rarity || '',
    (item.types || []).join('/'),
    item.condition || 'NM',
    item.quantity || 1,
    item.price?.market ? item.price.market.toFixed(2) : '',
    ((item.price?.market || 0) * (item.quantity || 1)).toFixed(2),
    item.notes || ''
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  fs.writeFileSync(filePath, csv, 'utf-8');
  return true;
});

ipcMain.handle('import-json', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Inventory (JSON)',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!filePaths?.length) return null;
  try {
    return JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
  } catch {
    return null;
  }
});

ipcMain.handle('show-confirm', async (_event, { title, message }) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title,
    message,
    buttons: ['Cancel', 'Yes'],
    defaultId: 0,
    cancelId: 0
  });
  return response === 1;
});

// --- Backup Helpers ---

function autoBackupOnLaunch() {
  try {
    if (!fs.existsSync(inventoryPath)) return;
    const today = new Date().toISOString().slice(0, 10);
    const files = fs.readdirSync(backupDir);
    const hasToday = files.some(f => f.startsWith(`backup-${today}`));
    if (!hasToday) createBackupFile('auto');
  } catch (e) {
    console.error('[AutoBackup]', e);
  }
}

function createBackupFile(label = 'manual') {
  if (!fs.existsSync(inventoryPath)) return null;
  const ts       = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${ts}-${label}.json`;
  const dest     = path.join(backupDir, filename);
  fs.copyFileSync(inventoryPath, dest);
  pruneBackups(20);
  return filename;
}

function pruneBackups(keep = 20) {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  while (files.length > keep) {
    fs.unlinkSync(path.join(backupDir, files.shift()));
  }
}

function listBackups() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(filename => {
      const fp   = path.join(backupDir, filename);
      const stat = fs.statSync(fp);
      let   count = 0;
      try { count = JSON.parse(fs.readFileSync(fp, 'utf-8')).length; } catch {}
      return { filename, size: stat.size, mtime: stat.mtime.toISOString(), count };
    });
}

// --- Backup IPC ---

ipcMain.handle('backup-create', () => {
  try {
    const filename = createBackupFile('manual');
    return { ok: true, filename };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('backup-list', () => {
  try { return listBackups(); }
  catch { return []; }
});

ipcMain.handle('backup-restore', async (_event, filename) => {
  const src = path.join(backupDir, filename);
  if (!fs.existsSync(src)) return { ok: false, error: 'Backup file not found.' };
  try {
    // Save current state as a pre-restore backup first
    if (fs.existsSync(inventoryPath)) createBackupFile('pre-restore');
    const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
    fs.writeFileSync(inventoryPath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('backup-delete', async (_event, filename) => {
  const fp = path.join(backupDir, filename);
  try {
    fs.unlinkSync(fp);
    return true;
  } catch { return false; }
});

ipcMain.handle('backup-open-folder', () => {
  const { shell } = require('electron');
  shell.openPath(backupDir);
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('open-data-folder', () => {
  const { shell } = require('electron');
  shell.openPath(app.getPath('userData'));
});

ipcMain.handle('check-for-updates', () => {
  return new Promise(resolve => {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/GamingUtopiadfgc/pokemon-card-tracker/releases/latest',
      headers: { 'User-Agent': 'poke-card-inventory-tracker' }
    };
    const req = https.get(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data   = JSON.parse(body);
          const latest  = (data.tag_name || '').replace(/^v/i, '');
          const current = app.getVersion();
          resolve({ ok: true, current, latest, url: data.html_url || '' });
        } catch {
          resolve({ ok: false, error: 'Could not parse GitHub response.' });
        }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, error: 'Request timed out.' }); });
  });
});

