import { app, BrowserWindow, Menu, nativeImage } from "electron";
import path from "node:path";
import { registerIpc } from "./ipc";
import { startScheduler } from "./scheduler";
import { store } from "./store";

let mainWindow: BrowserWindow | null = null;

function appIcon() {
  // __dirname is out/main in both dev and packaged builds
  const img = nativeImage.createFromPath(
    path.join(__dirname, "../../build/icons/icon.png"),
  );
  return img.isEmpty() ? undefined : img;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: "#f6f8fa",
    title: "FileFlex",
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    store.init();
    registerIpc(() => mainWindow);
    createWindow();
    startScheduler();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
