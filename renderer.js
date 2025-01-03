window.electron.getDownloadFolder().then((folderPath) => {
    if (folderPath) {
        document.getElementById('chooseFolderBtn').textContent = `Save to ...${folderPath.slice(-10)}`;
    }
});

document.getElementById("chooseFolderBtn").addEventListener("click", async () => {
    const folderPath = await window.electron.setDownloadFolder();
    if (folderPath) {
        document.getElementById('chooseFolderBtn').textContent = `Save to ...${folderPath.slice(-10)}`;
    } else {
        alert("Nuh uh, select a folder! You didn't select one.");
    }
});

document.getElementById("downloadBtn").addEventListener("click", async () => {
    const folderPath = await window.electron.getDownloadFolder();
    url = document.getElementById("URLInput").value;
    if(document.getElementById("theAudioSwitch").checked){
        window.electron.downloadStart(url, folderPath, true);
    }else{
        window.electron.downloadStart(url, folderPath, false);
    }
});

window.electron.status((event, stat) => {
    if (stat) {
        document.getElementById('processingIndicator').textContent = stat;
    }
});