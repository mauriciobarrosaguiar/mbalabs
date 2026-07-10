import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RouteThemeController } from "@/components/RouteThemeController";
import "./globals.css";
import "./mba-blue-theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

const routeThemeScript = `
(function () {
  var systemPrefixes = [
    "/apps",
    "/cotacoes",
    "/lavagestor",
    "/bikecomanda",
    "/lexgestor",
    "/portal-associativo"
  ];
  var pathname = window.location.pathname;
  var isSystemRoute = systemPrefixes.some(function (prefix) {
    return pathname === prefix || pathname.indexOf(prefix + "/") === 0;
  });
  var isPlatformRoute = pathname !== "/" && !isSystemRoute;
  var root = document.documentElement;

  if (isPlatformRoute) {
    root.dataset.mbaPlatform = "true";
    root.dataset.mbaTheme = "dark";
    root.style.colorScheme = "dark";
  } else {
    delete root.dataset.mbaPlatform;
    delete root.dataset.mbaTheme;
    root.style.removeProperty("color-scheme");
  }
})();
`;

const encodingFixScript = `
(function () {
  var windows1252 = {
    "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135,
    "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142,
    "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
    "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159
  };

  var spellingCorrections = [
    [/\\bPreco\\b/g, "Preço"], [/\\bpreco\\b/g, "preço"],
    [/\\bAcoes\\b/g, "Ações"], [/\\bacoes\\b/g, "ações"],
    [/\\bNao\\b/g, "Não"], [/\\bnao\\b/g, "não"],
    [/\\bUsuario\\b/g, "Usuário"], [/\\bUsuarios\\b/g, "Usuários"],
    [/\\busuario\\b/g, "usuário"], [/\\busuarios\\b/g, "usuários"],
    [/\\bVeiculo\\b/g, "Veículo"], [/\\bVeiculos\\b/g, "Veículos"],
    [/\\bveiculo\\b/g, "veículo"], [/\\bveiculos\\b/g, "veículos"],
    [/\\bServico\\b/g, "Serviço"], [/\\bServicos\\b/g, "Serviços"],
    [/\\bservico\\b/g, "serviço"], [/\\bservicos\\b/g, "serviços"],
    [/\\bDescricao\\b/g, "Descrição"], [/\\bdescricao\\b/g, "descrição"],
    [/\\bConfiguracao\\b/g, "Configuração"], [/\\bConfiguracoes\\b/g, "Configurações"],
    [/\\bconfiguracao\\b/g, "configuração"], [/\\bconfiguracoes\\b/g, "configurações"],
    [/\\bRelatorio\\b/g, "Relatório"], [/\\bRelatorios\\b/g, "Relatórios"],
    [/\\brelatorio\\b/g, "relatório"], [/\\brelatorios\\b/g, "relatórios"],
    [/\\bCotacao\\b/g, "Cotação"], [/\\bCotacoes\\b/g, "Cotações"],
    [/\\bcotacao\\b/g, "cotação"], [/\\bcotacoes\\b/g, "cotações"],
    [/\\bComissao\\b/g, "Comissão"], [/\\bComissoes\\b/g, "Comissões"],
    [/\\bcomissao\\b/g, "comissão"], [/\\bcomissoes\\b/g, "comissões"],
    [/\\bSaida\\b/g, "Saída"], [/\\bSaidas\\b/g, "Saídas"],
    [/\\bsaida\\b/g, "saída"], [/\\bsaidas\\b/g, "saídas"],
    [/\\bTitulo\\b/g, "Título"], [/\\btitulo\\b/g, "título"],
    [/\\bBeneficios\\b/g, "Benefícios"], [/\\bbeneficios\\b/g, "benefícios"],
    [/\\bPublico\\b/g, "Público"], [/\\bpublico\\b/g, "público"],
    [/\\bPagina\\b/g, "Página"], [/\\bpagina\\b/g, "página"],
    [/\\bRodape\\b/g, "Rodapé"], [/\\brodape\\b/g, "rodapé"],
    [/\\bOperacao\\b/g, "Operação"], [/\\boperacao\\b/g, "operação"],
    [/\\bInformacoes\\b/g, "Informações"], [/\\binformacoes\\b/g, "informações"],
    [/\\bFarmacias\\b/g, "Farmácias"], [/\\bfarmacias\\b/g, "farmácias"],
    [/\\bPossivel\\b/g, "Possível"], [/\\bpossivel\\b/g, "possível"]
  ];

  function score(value) {
    var matches = value.match(/Ã|Â|â|ð|�|Æ|ƒ|€™|™|œ|ž/g);
    return matches ? matches.length : 0;
  }

  function decodeOnce(value) {
    var bytes = [];
    var characters = Array.from(value);

    for (var index = 0; index < characters.length; index += 1) {
      var character = characters[index];
      var code = character.charCodeAt(0);

      if (code <= 255) {
        bytes.push(code);
      } else if (Object.prototype.hasOwnProperty.call(windows1252, character)) {
        bytes.push(windows1252[character]);
      } else {
        return value;
      }
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    } catch (error) {
      return value;
    }
  }

  function fixText(value) {
    if (!value) return value;

    var output = value;
    for (var attempt = 0; attempt < 4; attempt += 1) {
      var decoded = decodeOnce(output);
      if (decoded === output || score(decoded) >= score(output)) break;
      output = decoded;
    }

    spellingCorrections.forEach(function (correction) {
      output = output.replace(correction[0], correction[1]);
    });

    return output;
  }

  function fixNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      var fixedText = fixText(node.nodeValue || "");
      if (fixedText !== node.nodeValue) node.nodeValue = fixedText;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    var element = node;
    ["placeholder", "title", "aria-label", "alt"].forEach(function (attribute) {
      if (!element.hasAttribute || !element.hasAttribute(attribute)) return;
      var currentValue = element.getAttribute(attribute) || "";
      var fixedValue = fixText(currentValue);
      if (fixedValue !== currentValue) element.setAttribute(attribute, fixedValue);
    });

    if (element.childNodes) element.childNodes.forEach(fixNode);
  }

  function boot() {
    fixNode(document.body);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(fixNode);
        if (mutation.type === "characterData") fixNode(mutation.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`;

export const metadata: Metadata = {
  title: "MBA Labs",
  description: "Sistemas simples para gestão inteligente de negócios."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: routeThemeScript }} />
        <script dangerouslySetInnerHTML={{ __html: encodingFixScript }} />
        <RouteThemeController />
        {children}
      </body>
    </html>
  );
}
