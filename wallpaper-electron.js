const { app, BrowserWindow } = require('electron');
const path = require('path');

let wallpaperWindow;

function createWallpaperWindow() {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    wallpaperWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        frame: false,
        transparent: false,
        alwaysOnTop: false,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: true,
        fullscreen: false,
        type: 'desktop', // 设置为桌面窗口类型
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    wallpaperWindow.loadFile('wallpaper.html');
    
    // 设置窗口层级最低（在桌面图标下方）
    wallpaperWindow.setAlwaysOnTop(false, 'desktop');
    
    // 禁用窗口焦点
    wallpaperWindow.setFocusable(false);

    wallpaperWindow.on('closed', () => {
        wallpaperWindow = null;
    });

    // 开发时可以打开开发者工具
    // wallpaperWindow.webContents.openDevTools();
}

app.whenReady().then(createWallpaperWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWallpaperWindow();
    }
});
