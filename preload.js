const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    setDownloadFolder: () => ipcRenderer.invoke('set-download-folder'),
    getDownloadFolder: () => ipcRenderer.invoke('get-download-folder'),
    status: (stat) => ipcRenderer.on('status', stat),
    downloadStart: (url, dlpath, onlyAudio) => ipcRenderer.invoke('download', url, dlpath, onlyAudio)
});