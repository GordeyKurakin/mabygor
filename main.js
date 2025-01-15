const os = require('os');
const {app, BrowserWindow, Menu, dialog, ipcMain} = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ytdl = require('@distube/ytdl-core')
const url = require('url');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
let window;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

app.on('ready', () => {
    let settingsPath = path.join(__dirname, "userSettings", "userSettings.json");
    let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    if(settings.downloadFolder == ""){
        settings.downloadFolder = path.join(os.homedir(),"Downloads");
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
    
    window = new BrowserWindow({
        width: 500,
        height: 400,
        titleBarStyle: 'hiddenInset',
        backgroundColor: "092e26",
        show: false,
        resizable: false,
        icon: __dirname + '/assets/icon.ico',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })
    //window.webContents.openDevTools()
    window.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))
    window.once('ready-to-show', () => {
        window.show()
    })
    Menu.setApplicationMenu(null);
})  

async function getFolder(win) {
    const answer = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'Select folder to save to',
        buttonLabel: 'Select folder'
    });
    if(!answer.canceled && answer.filePaths.length > 0){
        return answer.filePaths[0];
    }
    return null;
}

ipcMain.handle('status', async event => {
    return
});

ipcMain.handle('set-download-folder', async event => {
    const folderPath = await(getFolder(window));
    if(folderPath){
        settingsPath = path.join(__dirname, "userSettings", "userSettings.json");
        let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        settings.downloadFolder = folderPath;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
    return folderPath;
});

ipcMain.handle('get-download-folder', async event => {
    settingsPath = path.join(__dirname, "userSettings", "userSettings.json");
    let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const folderPath = settings.downloadFolder;
    return folderPath;
});

ipcMain.handle('download', async (event, videoUrl, folderPath, onlyAudio) => {
    try {
        if (!ytdl.validateURL(videoUrl)) {
            event.sender.send('status', 'ERROR: Wrong URL');
            throw new Error('Invalid YouTube URL');
        }
        
        const info = await ytdl.getInfo(videoUrl);
        const videoTitle = info.videoDetails.title.replace(/[<>:"/\\|?*]/g, '');
        const filePath = path.join(folderPath, `${videoTitle}.mp4`);
        const videoPath = path.join(folderPath, `${videoTitle}_video.mp4`);
        const audioPath = path.join(folderPath, `${videoTitle}_audio.m4a`);
        event.sender.send('status', 'Audio download started...');
        console.log("download start");
        await new Promise((resolve, reject) => {
            exec(`yt-dlp -f bestaudio[ext=m4a] -o "${audioPath}" ${videoUrl}`, (error, stdout, stderr) => {
                if(error){
                    console.log(error.message);
                    console.error(stderr);
                    reject(error);
                }else{
                    console.log(`Audio download completed: ${audioPath}`);
                    event.sender.send('status', 'Audio downloaded...');
                    resolve();
                }
            });
        });
        if(!onlyAudio){
            event.sender.send('status', 'Video download started...');
            await new Promise((resolve, reject) => {
                exec(`yt-dlp -f bestvideo[ext=mp4] -o "${videoPath}" ${videoUrl}`, (error, stdout, stderr) => {
                    if(error){
                        console.log(error.message);
                        console.error(stderr);
                        reject(error);
                    }else{
                        console.log(`Video download completed: ${videoPath}`);
                        event.sender.send('status', 'Video downloaded...');
                        resolve();
                    }
                });
            });

            event.sender.send('status', 'Audio/Video merging started...');
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(videoPath)
                    .input(audioPath)
                    .audioCodec('aac')
                    .videoCodec('copy')
                    .outputOptions('-movflags faststart')
                    .on('end', () => {
                        console.log('Merge completed:', filePath);
                        event.sender.send('status', 'Audio and video merged...')
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Error during merge:', err.message);
                        reject();
                    })
                    .save(filePath);
            });
            fs.unlinkSync(videoPath);
            fs.unlinkSync(audioPath);
        }
        event.sender.send('status', 'Success!')
        return { success: true, filePath };
    } catch(error){
        console.error("L download failed: ", error);
        return { success: false, error: error.message }
    }
    
});
