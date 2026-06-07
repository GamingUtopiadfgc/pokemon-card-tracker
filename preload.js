const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadInventory:   ()            => ipcRenderer.invoke('load-inventory'),
  saveInventory:   (inventory)   => ipcRenderer.invoke('save-inventory', inventory),
  exportCSV:       (inventory)   => ipcRenderer.invoke('export-csv', inventory),
  importJSON:      ()            => ipcRenderer.invoke('import-json'),
  showConfirm:     (title, msg)  => ipcRenderer.invoke('show-confirm', { title, message: msg }),

  // Backups
  backupCreate:    ()            => ipcRenderer.invoke('backup-create'),
  backupList:      ()            => ipcRenderer.invoke('backup-list'),
  backupRestore:   (filename)    => ipcRenderer.invoke('backup-restore', filename),
  backupDelete:    (filename)    => ipcRenderer.invoke('backup-delete', filename),
  backupOpenFolder:()            => ipcRenderer.invoke('backup-open-folder'),

  // Settings
  getAppVersion:       ()        => ipcRenderer.invoke('get-app-version'),
  checkForUpdates:     ()        => ipcRenderer.invoke('check-for-updates'),
  openDataFolder:      ()        => ipcRenderer.invoke('open-data-folder'),
  downloadAndInstall:  (url)     => ipcRenderer.invoke('download-and-install', url),
  onDownloadProgress:  (cb)      => ipcRenderer.on('download-progress', (_e, data) => cb(data))
});
