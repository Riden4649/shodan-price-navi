(() => {
  "use strict";

  const badge = document.querySelector("#connectivityBadge");

  function updateConnectivity() {
    if (!badge) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    badge.textContent = navigator.onLine
      ? (standalone ? "APP / ONLINE" : "PWA / ONLINE")
      : "APP / OFFLINE";
    badge.classList.toggle("offline", !navigator.onLine);
  }

  updateConnectivity();
  window.addEventListener("online", updateConnectivity);
  window.addEventListener("offline", updateConnectivity);

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(error => {
        console.warn("Service Worker registration failed:", error);
      });
    });
  }
})();
