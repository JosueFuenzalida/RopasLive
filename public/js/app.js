import { initDB } from "./db.js";
import { initRouter } from "./router.js";
import { scheduleSync } from "./sync.js";
import { initUI, toast } from "./ui.js";

window.appState = {
  currentLive: null,
  currentCategory: null,
  currentClient: null
};

async function bootstrap() {
  await initDB();
  initUI();
  initRouter();
  scheduleSync();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  toast("Lista para vender", "success");
}

bootstrap().catch((error) => {
  console.error(error);
  toast("No se pudo iniciar la app", "error");
});
