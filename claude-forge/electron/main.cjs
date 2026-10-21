const { app, BrowserWindow } = require("electron");
const path = require("node:path");
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 950, minWidth: 900, minHeight: 650,
    backgroundColor: "#090a10",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, "..", "public", "index.html"));
}
app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
