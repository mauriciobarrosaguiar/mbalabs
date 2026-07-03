(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-no-local-login-style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .login-page { display: none !important; }
      .bike-portal-loading {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: linear-gradient(135deg, #0f8a5f 0%, #086b51 100%);
        color: #ffffff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .bike-portal-loading-card {
        width: min(440px, 100%);
        border: 1px solid rgba(255,255,255,.24);
        border-radius: 24px;
        padding: 24px;
        background: rgba(255,255,255,.12);
        box-shadow: 0 24px 70px rgba(0,0,0,.18);
        backdrop-filter: blur(14px);
      }
      .bike-portal-loading-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 900;
        font-size: 24px;
      }
      .bike-portal-loading-brand span {
        display: inline-grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,.7);
      }
      .bike-portal-loading h1 {
        margin: 28px 0 10px;
        font-size: clamp(30px, 8vw, 42px);
        line-height: 1.02;
      }
      .bike-portal-loading p {
        margin: 0;
        color: rgba(255,255,255,.78);
        font-size: 16px;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  function renderPortalLoading() {
    injectStyle();
    const root = document.querySelector("#app");
    if (!root) return;
    root.innerHTML = `
      <main class="bike-portal-loading">
        <section class="bike-portal-loading-card">
          <div class="bike-portal-loading-brand"><span>BC</span> BikeComanda</div>
          <h1>Carregando sua oficina</h1>
          <p>Buscando os dados da empresa no MBA Labs e sincronizando com o Supabase.</p>
        </section>
      </main>
    `;
  }

  injectStyle();
  renderPortalLoading();

  if (typeof renderLogin === "function") {
    renderLogin = renderPortalLoading;
  }

  if (typeof submitLogin === "function") {
    submitLogin = function () {
      renderPortalLoading();
    };
  }
})();
