const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isAlwaysOnTop = true;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 700,
        minWidth: 350,
        minHeight: 500,
        frame: true,
        transparent: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('index.html');

    // 创建菜单
    const menu = Menu.buildFromTemplate([
        {
            label: '窗口',
            submenu: [
                {
                    label: '置顶',
                    type: 'checkbox',
                    checked: true,
                    click: (menuItem) => {
                        isAlwaysOnTop = menuItem.checked;
                        mainWindow.setAlwaysOnTop(isAlwaysOnTop);
                    }
                },
                {
                    label: '透明模式',
                    type: 'checkbox',
                    checked: false,
                    click: (menuItem) => {
                        mainWindow.setOpacity(menuItem.checked ? 0.85 : 1);
                    }
                },
                { type: 'separator' },
                {
                    label: '最小化',
                    click: () => {
                        mainWindow.minimize();
                    }
                },
                {
                    label: '退出',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '开发者工具',
                    click: () => {
                        mainWindow.webContents.openDevTools();
                    }
                }
            ]
        }
    ]);

    Menu.setApplicationMenu(menu);

    // 创建系统托盘
    createTray();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 最小化到托盘
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    // 创建托盘图标（使用简单的文本图标）
    tray = new Tray(path.join(__dirname, 'icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: '置顶',
            type: 'checkbox',
            checked: true,
            click: (menuItem) => {
                isAlwaysOnTop = menuItem.checked;
                mainWindow.setAlwaysOnTop(isAlwaysOnTop);
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('待办事项');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    app.isQuiting = true;
});
