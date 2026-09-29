import { describe, expect, it } from "vitest";
import { quotationDeadlineToIso } from "@/modules/cotacoes/lib/deadline";
import { formatDate, formatDateTime } from "@/modules/cotacoes/lib/formatters";

describe("datas do MBA Cotações no Brasil", () => {
  it("trata data limite como fim do dia no Tocantins", () => {
    expect(quotationDeadlineToIso("2026-09-24")).toBe("2026-09-25T02:59:59.999Z");
  });

  it("não desloca uma data sem horário para o dia anterior", () => {
    expect(formatDate("2026-09-24")).toBe("24/09/2026");
  });

  it("exibe o instante armazenado no horário brasileiro", () => {
    expect(formatDateTime("2026-09-25T02:59:59.999Z")).toContain("24/09/2026");
  });
});
