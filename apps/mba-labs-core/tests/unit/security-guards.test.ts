import { describe, expect, it } from "vitest";
import { createPurchaseOrderPublicToken } from "@/modules/cotacoes/lib/security/public-tokens";
import {
  normalizeWhatsappPhone,
  resolveWhatsappDeliveryTarget,
} from "@/modules/cotacoes/lib/whatsapp/test-safety";

describe("tokens públicos", () => {
  it("gera tokens não previsíveis com 256 bits aleatórios", () => {
    const first = createPurchaseOrderPublicToken({ moduleType: "pharmacy" });
    const second = createPurchaseOrderPublicToken({ moduleType: "pharmacy" });

    expect(first).toMatch(/^pedido-pharmacy-[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });
});

describe("modo seguro do WhatsApp", () => {
  it("normaliza número brasileiro", () => {
    expect(normalizeWhatsappPhone("(63) 99999-0000")).toBe("5563999990000");
  });

  it("bloqueia QA sem allowlist", () => {
    expect(() => resolveWhatsappDeliveryTarget("5563999990000", {
      WHATSAPP_TEST_MODE: "true",
    })).toThrow("WHATSAPP_TEST_ALLOWLIST");
  });

  it("bloqueia destino fora da allowlist", () => {
    expect(() => resolveWhatsappDeliveryTarget("5563999990000", {
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_ALLOWLIST: "5563999991111",
    })).toThrow("fora da allowlist");
  });

  it("redireciona todos os envios QA ao destino autorizado e usa mock", () => {
    expect(resolveWhatsappDeliveryTarget("5563999990000", {
      WHATSAPP_TEST_MODE: "true",
      WHATSAPP_TEST_MOCK: "true",
      WHATSAPP_TEST_ALLOWLIST: "5563999991111",
      WHATSAPP_TEST_DESTINATION: "(63) 99999-1111",
    })).toEqual({
      phone: "5563999991111",
      mock: true,
      messagePrefix: "[MBA COTAÇÕES QA] ",
    });
  });
});
