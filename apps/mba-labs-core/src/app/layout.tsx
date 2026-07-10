import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("mba-platform-theme");
    var theme = saved === "light" || saved === "dark" ? saved : "dark";
    document.documentElement.dataset.mbaTheme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.mbaTheme = "dark";
  }
})();
`;

const encodingFixScript = `
(function () {
  var replacements = [
    ["AÃƒâ€¡Ãƒâ€¢ES", "AÇÕES"],
    ["AÃ‡Ã•ES", "AÇÕES"],
    ["AÃ§Ãµes", "Ações"],
    ["aÃ§Ãµes", "ações"],
    ["VeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­culo", "Veículo"],
    ["veÃ­culo", "veículo"],
    ["VeÃ­culo", "Veículo"],
    ["preÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§o", "preço"],
    ["preÃ§o", "preço"],
    ["PreÃ§o", "Preço"],
    ["comissÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o", "comissão"],
    ["comissÃ£o", "comissão"],
    ["ComissÃ£o", "Comissão"],
    ["nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o", "não"],
    ["NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o", "Não"],
    ["nÃ£o", "não"],
    ["NÃ£o", "Não"],
    ["VocÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª", "Você"],
    ["VocÃª", "Você"],
    ["vocÃª", "você"],
    ["peÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a", "peça"],
    ["peÃ§a", "peça"],
    ["permissÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o", "permissão"],
    ["permissÃ£o", "permissão"],
    ["ConfiguraÃ§Ãµes", "Configurações"],
    ["configuraÃ§Ãµes", "configurações"],
    ["UsuÃ¡rios", "Usuários"],
    ["usuÃ¡rios", "usuários"],
    ["botÃ£o", "botão"],
    ["BotÃ£o", "Botão"],
    ["Ã¡rea", "área"],
    ["Ã�rea", "Área"],
    ["Ãrea", "Área"],
    ["benefÃ­cios", "benefícios"],
    ["BenefÃ­cios", "Benefícios"],
    ["conteÃºdo", "conteúdo"],
    ["ConteÃºdo", "Conteúdo"],
    ["pÃºblico", "público"],
    ["PÃºblico", "Público"],
    ["pÃ¡gina", "página"],
    ["PÃ¡gina", "Página"],
    ["rodapÃ©", "rodapé"],
    ["RodapÃ©", "Rodapé"],
    ["descriÃ§Ã£o", "descrição"],
    ["DescriÃ§Ã£o", "Descrição"],
    ["gestÃ£o", "gestão"],
    ["GestÃ£o", "Gestão"],
    ["operaÃ§Ã£o", "operação"],
    ["OperaÃ§Ã£o", "Operação"],
    ["informaÃ§Ãµes", "informações"],
    ["InformaÃ§Ãµes", "Informações"],
    ["serviÃ§os", "serviços"],
    ["ServiÃ§os", "Serviços"],
    ["relatÃ³rios", "relatórios"],
    ["RelatÃ³rios", "Relatórios"],
    ["cotaÃ§Ãµes", "cotações"],
    ["CotaÃ§Ãµes", "Cotações"],
    ["farmÃ¡cias", "farmácias"],
    ["FarmÃ¡cias", "Farmácias"],
    ["saÃ­das", "saídas"],
    ["SaÃ­das", "Saídas"],
    ["estÃ¡", "está"],
    ["EstÃ¡", "Está"],
    ["atÃ©", "até"],
    ["AtÃ©", "Até"],
    ["possÃ­vel", "possível"],
    ["PossÃ­vel", "Possível"]
  ];

  function fixText(value) {
    if (!value || value.indexOf("Ã") === -1) return value;
    var output = value;
    replacements.forEach(function (item) {
      output = output.split(item[0]).join(item[1]);
    });
    return output;
  }

  function fixNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      var fixed = fixText(node.nodeValue || "");
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    var element = node;
    ["placeholder", "title", "aria-label", "alt"].forEach(function (attr) {
      if (element.hasAttribute && element.hasAttribute(attr)) {
        var value = element.getAttribute(attr) || "";
        var fixed = fixText(value);
        if (fixed !== value) element.setAttribute(attr, fixed);
      }
    });
    if (element.childNodes) {
      element.childNodes.forEach(fixNode);
    }
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: encodingFixScript }} />
        {children}
      </body>
    </html>
  );
}
