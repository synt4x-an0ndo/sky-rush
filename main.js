// Electron main process — opens SkyForce 3D in a native desktop window.
const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 540,
    height: 900,
    minWidth: 420,
    minHeight: 700,
    backgroundColor: "#0a0e1a",
    title: "SkyForce 3D",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, "www", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
