const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { Store } = require('./store');

const SOUND = '/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga';
const ICON = path.join(__dirname, 'assets', 'icon.png');

// Windows needs this for notifications to show the app's name and work when installed
app.setAppUserModelId('com.example.reminder-notes');

let win = null;
let tray = null;
let store = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit(); // already running: the first instance will show its window
} else {
  app.on('second-instance', showWindow);
}

function createWindow() {
  win = new BrowserWindow({
    width: 560,
    height: 780,
    minWidth: 460,
    minHeight: 560,
    show: !process.argv.includes('--hidden'), // --hidden = start in tray (autostart)
    title: 'Reminder Notes',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep timers accurate when hidden
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open links in the real browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Closing the window hides it to the tray so alarms keep working
  win.on('close', (event) => {
    if (!quitting && tray) {
      event.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  const size = process.platform === 'win32' ? 16 : 22; // Windows tray icons are 16x16
  const image = nativeImage.createFromPath(ICON).resize({ width: size, height: size });
  tray = new Tray(image);
  tray.setToolTip('Reminder Notes');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open', click: showWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ])
  );
  tray.on('click', showWindow);
}

function ring(alarm) {
  const n = new Notification({
    title: alarm.title,
    body: alarm.body,
    urgency: alarm.kind === 'pre' ? 'normal' : 'critical',
    icon: ICON,
  });
  n.on('click', showWindow);
  n.show();
  // Linux has no default notification sound, so play one. Windows plays its own.
  if (process.platform === 'linux') {
    spawn('paplay', [SOUND], { stdio: 'ignore' }).on('error', () => shell.beep());
  }
}

function pushUpdate() {
  if (win && !win.isDestroyed()) win.webContents.send('store:updated', store.data);
}

function tickAlarms() {
  const fired = store.checkAlarms();
  if (!fired.length) return;
  fired.forEach(ring);
  pushUpdate();
}

// Every action returns { ok, error?, data } so the UI can show errors and re-draw
const action = (fn) => (_event, ...args) => {
  const result = fn(...args) || { ok: true };
  return { ...result, data: store.data };
};

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  store = new Store(path.join(app.getPath('userData'), 'data.json'));

  ipcMain.handle('store:get', () => store.data);
  ipcMain.handle('store:add', action((list, item) => store.add(list, item)));
  ipcMain.handle('store:toggle', action((list, id) => store.toggle(list, id)));
  ipcMain.handle('store:remove', action((list, id) => store.remove(list, id)));
  ipcMain.handle('store:update', action((list, id, patch) => store.update(list, id, patch)));
  ipcMain.handle('store:stepAdd', action((list, id, text) => store.addStep(list, id, text)));
  ipcMain.handle('store:stepToggle', action((list, id, stepId) => store.toggleStep(list, id, stepId)));
  ipcMain.handle('store:stepRemove', action((list, id, stepId) => store.removeStep(list, id, stepId)));
  ipcMain.handle('store:extend', action((list, id, minutes) => store.extend(list, id, minutes)));
  ipcMain.handle('store:reschedule', action((list, id, times) => store.reschedule(list, id, times)));
  ipcMain.handle('store:updateStep', action((list, id, stepId, text) => store.updateStep(list, id, stepId, text)));
  ipcMain.handle('store:sort', action((mode) => store.setSort(mode)));
  ipcMain.handle('app:info', () => ({
    name: 'Reminder Notes',
    version: app.getVersion(),
    dataFile: store.file,
    electron: process.versions.electron,
  }));
  ipcMain.handle('app:showData', () => { shell.showItemInFolder(store.file); });
  ipcMain.handle('store:notes', (_event, text) => { store.setNotes(text); });

  createWindow();
  createTray();
  setInterval(tickAlarms, 5000);
  setTimeout(tickAlarms, 1000);
});

app.on('before-quit', () => { quitting = true; });
// Stay alive in the tray when all windows are hidden
app.on('window-all-closed', () => {});
