// Registers the service worker (sw.js) and reloads once a new version takes
// over, so the installed PWA updates on the next visit.
(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      // Look for an update on every load.
      if (reg.update) reg.update().catch(function () {});
    }).catch(function (err) {
      console.warn("service worker registration failed:", err);
    });
  });

  // When an updated worker activates, reload once to use the new assets.
  var reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
})();
