(function () {
  "use strict";

  const STORAGE_KEY = "bikecomanda:v1";
  const USER_ID = "u_admin";

  function ensureSession() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!data.session || !data.session.userId) {
        data.session = {
          userId: USER_ID,
          source: "mba-labs",
          created_at: new Date().toISOString()
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      // Keep the app usable even when localStorage is blocked.
    }
  }

  ensureSession();
})();
