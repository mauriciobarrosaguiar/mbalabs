export type SelectOption = { value: string; label: string };

export const UF_OPTIONS: SelectOption[] = [
  { value: "AC", label: "AC - Acre" },
  { value: "AL", label: "AL - Alagoas" },
  { value: "AP", label: "AP - Amapá" },
  { value: "AM", label: "AM - Amazonas" },
  { value: "BA", label: "BA - Bahia" },
  { value: "CE", label: "CE - Ceará" },
  { value: "DF", label: "DF - Distrito Federal" },
  { value: "ES", label: "ES - Espírito Santo" },
  { value: "GO", label: "GO - Goiás" },
  { value: "MA", label: "MA - Maranhão" },
  { value: "MT", label: "MT - Mato Grosso" },
  { value: "MS", label: "MS - Mato Grosso do Sul" },
  { value: "MG", label: "MG - Minas Gerais" },
  { value: "PA", label: "PA - Pará" },
  { value: "PB", label: "PB - Paraíba" },
  { value: "PR", label: "PR - Paraná" },
  { value: "PE", label: "PE - Pernambuco" },
  { value: "PI", label: "PI - Piauí" },
  { value: "RJ", label: "RJ - Rio de Janeiro" },
  { value: "RN", label: "RN - Rio Grande do Norte" },
  { value: "RS", label: "RS - Rio Grande do Sul" },
  { value: "RO", label: "RO - Rondônia" },
  { value: "RR", label: "RR - Roraima" },
  { value: "SC", label: "SC - Santa Catarina" },
  { value: "SP", label: "SP - São Paulo" },
  { value: "SE", label: "SE - Sergipe" },
  { value: "TO", label: "TO - Tocantins" }
];

const CIDADES_BASE = [
  "Abaetetuba",
  "Aguiarnópolis",
  "Aliança do Tocantins",
  "Almas",
  "Alvorada",
  "Ananás",
  "Aparecida do Rio Negro",
  "Araguaçu",
  "Araguaína",
  "Araguatins",
  "Arapoema",
  "Arraias",
  "Augustinópolis",
  "Axixá do Tocantins",
  "Babaçulândia",
  "Barra do Ouro",
  "Barrolândia",
  "Belém",
  "Belo Horizonte",
  "Boa Vista",
  "Bom Jesus do Tocantins",
  "Brasília",
  "Brejinho de Nazaré",
  "Buriti do Tocantins",
  "Cachoeirinha",
  "Campo Grande",
  "Campos Lindos",
  "Cariri do Tocantins",
  "Caseara",
  "Colinas do Tocantins",
  "Colméia",
  "Combinado",
  "Cuiabá",
  "Curitiba",
  "Darcinópolis",
  "Dianópolis",
  "Divinópolis do Tocantins",
  "Dois Irmãos do Tocantins",
  "Dueré",
  "Esperantina",
  "Fátima",
  "Figueirópolis",
  "Florianópolis",
  "Formoso do Araguaia",
  "Fortaleza",
  "Goiânia",
  "Goiatins",
  "Guaraí",
  "Gurupi",
  "Ipueiras",
  "Itacajá",
  "Itaguatins",
  "Itapiratins",
  "Itaporã do Tocantins",
  "Jaú do Tocantins",
  "João Pessoa",
  "Lagoa da Confusão",
  "Lagoa do Tocantins",
  "Lajeado",
  "Lizarda",
  "Macapá",
  "Maceió",
  "Manaus",
  "Marianópolis do Tocantins",
  "Mateiros",
  "Maurilândia do Tocantins",
  "Miracema do Tocantins",
  "Miranorte",
  "Monte do Carmo",
  "Natal",
  "Natividade",
  "Nova Olinda",
  "Palmas",
  "Paraíso do Tocantins",
  "Paranã",
  "Pedro Afonso",
  "Peixe",
  "Pequizeiro",
  "Pindorama do Tocantins",
  "Pium",
  "Ponte Alta do Tocantins",
  "Porto Alegre",
  "Porto Nacional",
  "Porto Velho",
  "Praia Norte",
  "Presidente Kennedy",
  "Recife",
  "Rio Branco",
  "Rio de Janeiro",
  "Salvador",
  "Santa Fé do Araguaia",
  "Santa Maria do Tocantins",
  "São Félix do Tocantins",
  "São Luís",
  "São Miguel do Tocantins",
  "São Paulo",
  "Sítio Novo do Tocantins",
  "Taguatinga",
  "Taipas do Tocantins",
  "Talisma",
  "Teresina",
  "Tocantínia",
  "Tocantinópolis",
  "Vitória",
  "Wanderlândia",
  "Xambioá"
];

export function getUfOptions(currentUf?: string | null): SelectOption[] {
  const options = new Map(UF_OPTIONS.map((option) => [option.value, option]));
  const normalized = String(currentUf ?? "").trim().toUpperCase();
  if (normalized && !options.has(normalized)) {
    options.set(normalized, { value: normalized, label: normalized });
  }
  return Array.from(options.values());
}

export function getCidadeOptions(...currentCities: Array<string | null | undefined>): SelectOption[] {
  const options = new Map<string, SelectOption>();

  CIDADES_BASE.forEach((city) => {
    options.set(city.toLocaleLowerCase("pt-BR"), { value: city, label: city });
  });

  currentCities
    .map((city) => String(city ?? "").trim())
    .filter(Boolean)
    .forEach((city) => {
      const key = city.toLocaleLowerCase("pt-BR");
      if (!options.has(key)) {
        options.set(key, { value: city, label: city });
      }
    });

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
