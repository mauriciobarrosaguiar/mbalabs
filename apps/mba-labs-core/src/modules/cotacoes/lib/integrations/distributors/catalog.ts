import type { DistributorDefinition } from "./types";

export const initialDistributorCatalog: DistributorDefinition[] = [
  {
    key: "panpharma-go",
    name: "Panpharma",
    unitName: "GO",
    state: "GO",
    status: "homologation",
    preferredConnectionMode: "edi_van",
    customerCodeRequired: true,
    supportsAutomaticQuote: false,
    supportsAutomaticOrder: false,
    notes: "Primeira integração a homologar. Consulta e envio real permanecem bloqueados até validação do canal técnico.",
  },
  {
    key: "nazaria-imperatriz-ma",
    name: "Nazária",
    unitName: "Imperatriz/MA",
    city: "Imperatriz",
    state: "MA",
    status: "not_configured",
    preferredConnectionMode: "to_define",
    customerCodeRequired: true,
    supportsAutomaticQuote: false,
    supportsAutomaticOrder: false,
    notes: "Validar canal homologado para consulta de estoque/preço e transmissão de pedido.",
  },
  {
    key: "total-to",
    name: "Total",
    unitName: "TO",
    state: "TO",
    status: "not_configured",
    preferredConnectionMode: "to_define",
    customerCodeRequired: true,
    supportsAutomaticQuote: false,
    supportsAutomaticOrder: false,
    notes: "Validar API, EDI, comunicador ou integração com o B2B antes de habilitar automação.",
  },
  {
    key: "profarma-df",
    name: "Profarma",
    unitName: "DF",
    state: "DF",
    status: "not_configured",
    preferredConnectionMode: "to_define",
    customerCodeRequired: true,
    supportsAutomaticQuote: false,
    supportsAutomaticOrder: false,
    notes: "Confirmar o método de integração atualmente homologado para clientes do DF.",
  },
];

export function getDistributorDefinition(key: string) {
  return initialDistributorCatalog.find((distributor) => distributor.key === key);
}
