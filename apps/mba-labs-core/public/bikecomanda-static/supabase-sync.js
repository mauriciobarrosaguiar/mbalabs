(function () {
  "use strict";

  const API_URL = "/api/bikecomanda/state";
  const STATUS_ID = "bikecomanda-sync-status";
  const STYLE_ID = "bikecomanda-sync-style";
  const SAVE_DELAY = 700;

  let hydrated = false;
  let saving = false;
  let pendingSave = false;
  let saveTimer = null;
  let lastSaved = "";

  const originalSave = typeof save === "function" ? save : function () {};

  save = function saveToSupabaseOnly() {
    if (!hydrated) return;
    scheduleSave();
  };

  boot();

  async function boot() {
    injectStyles();
    setSyncStatus("Sincronizando com Supabase...", "loading");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível carregar os dados do Supabase.");
      }

      window.BikeComandaPortalUser = payload.portalUser;

      const localBeforeSync = cloneDb(db);
      const remoteData = payload.hasData && payload.data ? payload.data : null;
      const nextData = remoteData ? remoteData : buildFirstState(localBeforeSync, payload.portalUser);

      db = applyPortalContext(nextData, payload.portalUser);
      hydrated = true;
      lastSaved = stable(db);

      clearLocalCache();
      render();

      if (!remoteData) {
        await persistNow();
        setSyncStatus("Dados migrados para o Supabase.", "ok");
      } else {
        setSyncStatus(`Dados no Supabase salvos em ${formatSyncDate(payload.updatedAt)}.`, "ok");
      }
    } catch (error) {
      hydrated = false;
      originalSave();
      setSyncStatus(
        `Falha ao sincronizar Supabase: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
        "error",
      );
    }
  }

  function scheduleSave(delay = SAVE_DELAY) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, delay);
    setSyncStatus("Alteração pendente para salvar no Supabase...", "loading");
  }

  async function persistNow() {
    if (!hydrated) return;
    if (saving) {
      pendingSave = true;
      return;
    }

    const portalUser = window.BikeComandaPortalUser;
    if (!portalUser) return;

    db = applyPortalContext(db, portalUser);
    const serialized = stable(db);

    if (serialized === lastSaved) {
      setSyncStatus("Tudo salvo no Supabase.", "ok");
      return;
    }

    saving = true;
    pendingSave = false;
    setSyncStatus("Salvando no Supabase...", "loading");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ data: db }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível salvar no Supabase.");
      }

      lastSaved = serialized;
      clearLocalCache();
      setSyncStatus("Tudo salvo no Supabase.", "ok");
    } catch (error) {
      setSyncStatus(
        `Erro ao salvar no Supabase: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
        "error",
      );
    } finally {
      saving = false;
      if (pendingSave) scheduleSave(80);
    }
  }

  function buildFirstState(localData, portalUser) {
    const shouldUseBlank = looksLikeDemoSeed(localData);
    const base = shouldUseBlank && typeof seedDb === "function" ? seedDb() : localData;
    const data = cloneDb(base || {});
    const now = new Date().toISOString();

    if (shouldUseBlank) {
      data.clientes = [];
      data.bicicletas = [];
      data.mecanicos = [];
      data.produtos = [];
      data.comandas = [];
      data.comanda_servicos = [];
      data.comanda_produtos = [];
      data.pagamentos = [];
      data.comissoes = [];
      data.historico_comandas = [];
    }

    data.configuracoes_loja = [
      {
        id: "cfg_1",
        nome_loja: portalUser?.empresa_nome || data.configuracoes_loja?.[0]?.nome_loja || "BikeComanda",
        whatsapp_loja: data.configuracoes_loja?.[0]?.whatsapp_loja || "",
        endereco_loja: data.configuracoes_loja?.[0]?.endereco_loja || "",
        limite_desconto_atendente: Number(data.configuracoes_loja?.[0]?.limite_desconto_atendente ?? 10),
        comissao_sobre_valor_com_desconto: Boolean(data.configuracoes_loja?.[0]?.comissao_sobre_valor_com_desconto),
        empresa_id: portalUser?.empresa_id || null,
        created_at: data.configuracoes_loja?.[0]?.created_at || now,
        updated_at: now,
      },
    ];

    return data;
  }

  function applyPortalContext(input, portalUser) {
    const data = cloneDb(input || {});
    const now = new Date().toISOString();
    const collections = [
      "clientes",
      "bicicletas",
      "mecanicos",
      "servicos",
      "produtos",
      "comandas",
      "comanda_servicos",
      "comanda_produtos",
      "pagamentos",
      "comissoes",
      "historico_comandas",
    ];

    for (const collection of collections) {
      if (!Array.isArray(data[collection])) data[collection] = [];
      data[collection] = data[collection].map((item) =>
        item && typeof item === "object" ? { ...item, empresa_id: portalUser?.empresa_id || null } : item,
      );
    }

    data.usuarios = [
      {
        id: portalUser.id,
        nome: portalUser.nome,
        email: portalUser.email,
        perfil: portalUser.perfil,
        ativo: true,
        senha_hash: "",
        source: "mba-labs",
        empresa_id: portalUser.empresa_id || null,
        created_at: portalUser.created_at || now,
      },
    ];
    data.session = { userId: portalUser.id, source: "mba-labs", synced_at: now };

    const cfg = data.configuracoes_loja?.[0] || {};
    data.configuracoes_loja = [
      {
        id: cfg.id || "cfg_1",
        nome_loja: cfg.nome_loja || portalUser.empresa_nome || "BikeComanda",
        whatsapp_loja: cfg.whatsapp_loja || "",
        endereco_loja: cfg.endereco_loja || "",
        limite_desconto_atendente: Number(cfg.limite_desconto_atendente ?? 10),
        comissao_sobre_valor_com_desconto: Boolean(cfg.comissao_sobre_valor_com_desconto),
        empresa_id: portalUser.empresa_id || null,
        created_at: cfg.created_at || now,
        updated_at: now,
      },
    ];

    data.product_ready = {
      ...(data.product_ready || {}),
      persistence: "supabase",
      state_table: "bike_app_state",
      empresa_id: portalUser.empresa_id || null,
      updated_at: now,
    };

    return data;
  }

  function looksLikeDemoSeed(data) {
    if (!data || typeof data !== "object") return true;
    const hasDemoClient = Array.isArray(data.clientes) && data.clientes.some((item) => item.id === "cli_joao" || item.nome === "João Pereira");
    const hasDemoOrder = Array.isArray(data.comandas) && data.comandas.some((item) => item.id === "cmd_1");
    const hasOnlyDemoOrders = !Array.isArray(data.comandas) || data.comandas.length <= 1;
    return hasDemoClient && hasDemoOrder && hasOnlyDemoOrders;
  }

  function clearLocalCache() {
    try {
      if (typeof STORAGE_KEY !== "undefined") localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sem ação: Supabase segue sendo a fonte principal.
    }
  }

  function cloneDb(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function stable(value) {
    return JSON.stringify(value || {});
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .sync-status{position:fixed;right:14px;bottom:14px;z-index:9999;border:1px solid #dbe7e1;border-radius:999px;background:#fff;color:#22332d;padding:8px 12px;font:600 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;box-shadow:0 12px 30px rgba(15,30,25,.14);max-width:min(420px, calc(100vw - 28px))}
      .sync-status.loading{border-color:#fde68a;background:#fffbeb;color:#713f12}.sync-status.ok{border-color:#bbf7d0;background:#f0fdf4;color:#14532d}.sync-status.error{border-color:#fecaca;background:#fef2f2;color:#7f1d1d}
      @media(max-width:700px){.sync-status{left:12px;right:12px;bottom:10px;text-align:center;border-radius:14px}}
    `;
    document.head.appendChild(style);
  }

  function setSyncStatus(text, type) {
    let node = document.getElementById(STATUS_ID);
    if (!node) {
      node = document.createElement("div");
      node.id = STATUS_ID;
      document.body.appendChild(node);
    }
    node.className = `sync-status ${type || ""}`.trim();
    node.textContent = text;

    if (type === "ok") {
      clearTimeout(node._hideTimer);
      node._hideTimer = setTimeout(() => {
        if (node) node.style.display = "none";
      }, 2800);
      node.style.display = "block";
    } else {
      node.style.display = "block";
    }
  }

  function formatSyncDate(value) {
    if (!value) return "agora";
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    } catch {
      return "agora";
    }
  }
})();
