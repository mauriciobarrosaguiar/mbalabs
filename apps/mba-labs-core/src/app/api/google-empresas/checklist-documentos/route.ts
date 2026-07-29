import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const sections = [
  {
    title: "1. Dados da empresa",
    items: [
      "Nome que deve aparecer no Google.",
      "Razão social e CNPJ.",
      "Categoria principal e categorias secundárias.",
      "Data de abertura da empresa.",
      "Descrição curta dos produtos e serviços oferecidos."
    ]
  },
  {
    title: "2. Contatos públicos",
    items: [
      "Telefone comercial atualizado.",
      "Número de WhatsApp da empresa.",
      "E-mail do responsável pelo cadastro.",
      "Site e redes sociais, quando existirem."
    ]
  },
  {
    title: "3. Endereço e área atendida",
    items: [
      "Endereço completo: rua, número, complemento, bairro, cidade, estado e CEP.",
      "Comprovante do endereço comercial recente.",
      "Foto da fachada mostrando o nome ou a placa da empresa.",
      "Localização exata no mapa ou ponto de referência.",
      "Para empresas que atendem no local do cliente: lista das cidades, bairros ou regiões atendidas."
    ]
  },
  {
    title: "4. Horários de funcionamento",
    items: [
      "Horário de abertura e fechamento de segunda a domingo.",
      "Dias em que a empresa não funciona.",
      "Horários especiais ou intervalos, quando houver."
    ]
  },
  {
    title: "5. Fotos e identidade visual",
    items: [
      "Logotipo em boa qualidade.",
      "Imagem de capa, quando disponível.",
      "Fotos externas e internas do estabelecimento.",
      "Fotos dos produtos, serviços, equipe ou equipamentos.",
      "Evitar imagens com telefone, promoções ou excesso de texto sobreposto."
    ]
  },
  {
    title: "6. Autorização e verificação",
    items: [
      "Nome completo e CPF do responsável autorizado pela empresa.",
      "Acesso ao e-mail e ao telefone informados durante o cadastro.",
      "Disponibilidade do responsável para autorizar o acesso à conta Google.",
      "Caso o Google solicite vídeo: gravar em uma única sequência a rua, a fachada, a entrada, a área interna, os equipamentos e sinais de que a empresa está em funcionamento.",
      "Documento comercial ou comprovante adicional, somente quando for solicitado durante a verificação."
    ]
  }
];

export async function GET() {
  const document = await PDFDocument.create();
  document.setTitle("Checklist de documentos - Google Empresas");
  document.setAuthor("MBA Labs");
  document.setSubject("Documentos e informações para cadastro de empresa no Google");

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawHeader(page, bold, regular);

  for (const section of sections) {
    const sectionHeight = 34 + section.items.reduce((total, item) => total + estimateTextHeight(item, regular, 10.5, TEXT_WIDTH - 24) + 11, 0);
    if (y - sectionHeight < 70) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawCompactHeader(page, bold);
    }

    page.drawText(section.title, {
      x: MARGIN,
      y,
      size: 14,
      font: bold,
      color: rgb(0.31, 0.21, 0.72)
    });
    y -= 24;

    for (const item of section.items) {
      page.drawText("[ ]", {
        x: MARGIN,
        y,
        size: 10.5,
        font: bold,
        color: rgb(0.12, 0.15, 0.24)
      });

      const lines = wrapText(item, regular, 10.5, TEXT_WIDTH - 30);
      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN + 28,
          y,
          size: 10.5,
          font: regular,
          color: rgb(0.17, 0.2, 0.29)
        });
        y -= 14;
      }
      y -= 6;
    }

    y -= 8;
  }

  if (y < 118) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = drawCompactHeader(page, bold);
  }

  page.drawRectangle({
    x: MARGIN,
    y: y - 63,
    width: TEXT_WIDTH,
    height: 63,
    color: rgb(0.95, 0.95, 0.99),
    borderColor: rgb(0.82, 0.79, 0.95),
    borderWidth: 1
  });
  page.drawText("Observação importante", {
    x: MARGIN + 16,
    y: y - 21,
    size: 11,
    font: bold,
    color: rgb(0.31, 0.21, 0.72)
  });
  drawWrappedText(
    page,
    "Os métodos e os documentos de verificação são definidos pelo Google para cada empresa. Esta lista reúne o material normalmente necessário para preparar o cadastro e reduzir atrasos.",
    MARGIN + 16,
    y - 39,
    TEXT_WIDTH - 32,
    regular,
    9.5,
    rgb(0.22, 0.24, 0.33),
    12
  );

  addFooters(document, regular);

  const bytes = await document.save();
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="checklist-documentos-google-empresas.pdf"',
      "Cache-Control": "private, max-age=3600"
    }
  });
}

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 184,
    width: PAGE_WIDTH,
    height: 184,
    color: rgb(0.035, 0.04, 0.1)
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 86,
    width: 42,
    height: 42,
    color: rgb(0.52, 0.24, 0.91)
  });
  page.drawText("MBA Labs", {
    x: MARGIN + 56,
    y: PAGE_HEIGHT - 72,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1)
  });
  page.drawText("GOOGLE EMPRESAS", {
    x: MARGIN + 56,
    y: PAGE_HEIGHT - 89,
    size: 8.5,
    font: bold,
    color: rgb(0.72, 0.69, 0.86)
  });
  page.drawText("Checklist de documentos", {
    x: MARGIN,
    y: PAGE_HEIGHT - 130,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1)
  });
  page.drawText("Informações que o cliente deve enviar para o cadastro da empresa no Google.", {
    x: MARGIN,
    y: PAGE_HEIGHT - 151,
    size: 10.5,
    font: regular,
    color: rgb(0.76, 0.79, 0.88)
  });

  return PAGE_HEIGHT - 220;
}

function drawCompactHeader(page: PDFPage, bold: PDFFont) {
  page.drawText("MBA Labs - Google Empresas", {
    x: MARGIN,
    y: PAGE_HEIGHT - 50,
    size: 12,
    font: bold,
    color: rgb(0.31, 0.21, 0.72)
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 62 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 62 },
    thickness: 1,
    color: rgb(0.86, 0.86, 0.92)
  });
  return PAGE_HEIGHT - 92;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function estimateTextHeight(text: string, font: PDFFont, size: number, maxWidth: number) {
  return wrapText(text, font, size, maxWidth).length * 14;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineHeight: number
) {
  for (const line of wrapText(text, font, size, maxWidth)) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
}

function addFooters(document: PDFDocument, font: PDFFont) {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    page.drawText(`MBA Labs | Página ${index + 1} de ${pages.length}`, {
      x: MARGIN,
      y: 28,
      size: 8,
      font,
      color: rgb(0.48, 0.5, 0.58)
    });
  });
}
