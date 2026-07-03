(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-client-autocomplete-style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .client-form-search-field { position: relative; }
      .client-form-suggestions {
        display: none;
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 6px);
        z-index: 90;
        max-height: 260px;
        overflow-y: auto;
        border: 1px solid rgba(15, 138, 95, 0.16);
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 18px 42px rgba(12, 30, 24, 0.14);
        padding: 6px;
      }
      .client-form-suggestions.is-open { display: grid; gap: 8px; }
      .client-form-suggestion {
        width: 100%;
        border: 0;
        border-radius: 12px;
        background: #f7fbf9;
        padding: 12px;
        text-align: left;
        color: #18342b;
        cursor: pointer;
      }
      .client-form-suggestion strong { display: block; font-size: 15px; }
      .client-form-suggestion span { display: block; margin-top: 2px; color: #64746e; font-size: 12px; }
      .client-form-empty {
        padding: 11px;
        border: 1px dashed rgba(15, 138, 95, 0.22);
        border-radius: 14px;
        background: #fbfefd;
        color: #65736e;
        text-align: center;
        font-size: 13px;
        line-height: 1.35;
      }
      .client-editing-note {
        display: none;
        margin-top: 8px;
        padding: 9px 10px;
        border-radius: 12px;
        background: #e9f8f1;
        color: var(--primary-strong);
        font-size: 12px;
        font-weight: 800;
      }
      .client-editing-note.is-visible { display: block; }

      @media (max-width: 900px) {
        .client-form-suggestions {
          position: static;
          margin-top: 8px;
          max-height: none;
          overflow: visible;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function findClient(id) {
    return db?.clientes?.find((client) => client.id === id) || null;
  }

  function enhanceClientForm() {
    injectStyle();
    const form = document.querySelector('form[data-form="cliente"]');
    if (!form) return;

    const nameInput = form.querySelector('input[name="nome"]');
    if (!nameInput) return;

    const field = nameInput.closest(".field") || nameInput.parentElement;
    if (!field) return;

    field.classList.add("client-form-search-field");
    nameInput.setAttribute("autocomplete", "off");
    nameInput.setAttribute("data-client-form-search", "true");

    if (!field.querySelector(".client-form-suggestions")) {
      const box = document.createElement("div");
      box.className = "client-form-suggestions";
      field.appendChild(box);
    }

    if (!field.querySelector(".client-editing-note")) {
      const note = document.createElement("div");
      note.className = "client-editing-note";
      note.textContent = "Cliente encontrado. Os dados foram carregados para edição.";
      field.appendChild(note);
    }
  }

  function suggestionsFor(value) {
    const q = normalize(value);
    if (!q) return [];
    return (db?.clientes || [])
      .filter((client) => normalize(client.nome).includes(q) || normalize(client.whatsapp).includes(q))
      .slice(0, 8);
  }

  function renderSuggestions(input) {
    const field = input.closest(".client-form-search-field");
    const box = field?.querySelector(".client-form-suggestions");
    const form = input.closest('form[data-form="cliente"]');
    if (!box || !form) return;

    const idInput = form.querySelector('input[name="id"]');
    const currentId = idInput?.value || "";
    const q = normalize(input.value);

    if (!q) {
      box.classList.remove("is-open");
      box.innerHTML = "";
      return;
    }

    const matches = suggestionsFor(input.value).filter((client) => client.id !== currentId);
    if (!matches.length) {
      box.classList.add("is-open");
      box.innerHTML = `<div class="client-form-empty">Nenhum cliente encontrado. Continue preenchendo para cadastrar um novo.</div>`;
      return;
    }

    box.classList.add("is-open");
    box.innerHTML = matches
      .map(
        (client) => `
          <button class="client-form-suggestion" type="button" data-client-form-pick="${esc(client.id)}">
            <strong>${esc(client.nome)}</strong>
            <span>${esc(client.whatsapp || "Sem WhatsApp")}</span>
          </button>
        `,
      )
      .join("");
  }

  function fillClientForm(client) {
    const form = document.querySelector('form[data-form="cliente"]');
    if (!form || !client) return;

    const set = (name, value) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      input.value = value || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    set("id", client.id);
    set("nome", client.nome);
    set("whatsapp", client.whatsapp);
    set("cpf", client.cpf);
    set("endereco", client.endereco);
    set("observacoes", client.observacoes);

    const box = form.querySelector(".client-form-suggestions");
    if (box) {
      box.classList.remove("is-open");
      box.innerHTML = "";
    }

    const note = form.querySelector(".client-editing-note");
    note?.classList.add("is-visible");

    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "Salvar alterações";

    const whatsapp = form.querySelector('input[name="whatsapp"]');
    if (whatsapp) whatsapp.focus();
  }

  function patchRender() {
    if (window.__bikeClientAutocompletePatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedClientAutocompleteRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(enhanceClientForm, 0);
      return result;
    };
    window.__bikeClientAutocompletePatched = true;
  }

  document.addEventListener("input", function (event) {
    const input = event.target.closest("[data-client-form-search]");
    if (!input) return;
    renderSuggestions(input);
  });

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-client-form-pick]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const client = findClient(button.dataset.clientFormPick);
    fillClientForm(client);
  }, true);

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('form[data-form="cliente"]')) {
      document.querySelectorAll(".client-form-suggestions").forEach((box) => {
        box.classList.remove("is-open");
        box.innerHTML = "";
      });
    }
  });

  injectStyle();
  patchRender();
  setTimeout(enhanceClientForm, 0);
  document.addEventListener("DOMContentLoaded", function () {
    injectStyle();
    patchRender();
    enhanceClientForm();
  });
})();
