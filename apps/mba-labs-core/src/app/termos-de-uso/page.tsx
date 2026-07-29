import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso | MBA Labs",
  description: "Termos de Uso da plataforma MBA Labs e das integrações disponibilizadas aos usuários."
};

const sections = [
  {
    title: "1. Aceitação",
    paragraphs: [
      "Ao acessar ou utilizar a plataforma MBA Labs, o usuário declara que leu e concorda com estes Termos. Caso não concorde, não deve utilizar os sistemas ou autorizar integrações."
    ]
  },
  {
    title: "2. Finalidade da plataforma",
    paragraphs: [
      "A MBA Labs disponibiliza sistemas de gestão e automação para empresas e profissionais. Alguns módulos permitem integrar serviços de terceiros, como o Google Business Profile, sempre mediante autorização do titular ou responsável legítimo pela conta."
    ]
  },
  {
    title: "3. Responsabilidades do usuário",
    items: [
      "Fornecer informações verdadeiras, atualizadas e relacionadas a uma empresa real.",
      "Utilizar somente contas e Perfis da Empresa que tenha autorização para administrar.",
      "Manter suas credenciais de acesso protegidas e comunicar qualquer uso indevido.",
      "Não criar perfis falsos, duplicados, enganosos ou contrários às políticas do Google e à legislação aplicável.",
      "Obter consentimentos necessários de clientes, funcionários e demais titulares envolvidos.",
      "Revisar os dados antes de solicitar a criação, atualização ou verificação de um Perfil da Empresa."
    ]
  },
  {
    title: "4. Integração com o Google",
    paragraphs: [
      "A autorização é realizada diretamente na Conta Google do usuário por OAuth 2.0. A MBA Labs não solicita nem armazena a senha Google.",
      "Os métodos de verificação, prazos, aprovações, suspensões, categorias e demais decisões sobre um Perfil da Empresa são definidos pelo Google. A MBA Labs não garante que um perfil será criado, aprovado, verificado, publicado ou mantido ativo."
    ]
  },
  {
    title: "5. Disponibilidade e alterações",
    paragraphs: [
      "Buscamos manter os sistemas disponíveis e seguros, mas podem ocorrer interrupções por manutenção, falhas de terceiros, mudanças em APIs ou eventos fora do nosso controle.",
      "Funcionalidades podem ser ajustadas para atender requisitos técnicos, de segurança, legais ou das plataformas integradas."
    ]
  },
  {
    title: "6. Uso proibido",
    items: [
      "Tentar acessar dados, contas ou sistemas sem autorização.",
      "Usar a plataforma para fraude, spam, coleta indevida de dados ou violação de direitos.",
      "Contornar verificações, limites, bloqueios ou políticas do Google ou da MBA Labs.",
      "Copiar, revender ou disponibilizar acesso técnico não autorizado às integrações e credenciais da plataforma.",
      "Inserir conteúdo ilícito, enganoso, ofensivo ou que viole propriedade intelectual."
    ]
  },
  {
    title: "7. Suspensão e encerramento",
    paragraphs: [
      "O acesso poderá ser suspenso ou encerrado em caso de violação destes Termos, risco de segurança, ordem legal, inadimplência contratual ou uso que possa prejudicar terceiros, a MBA Labs ou serviços integrados.",
      "O usuário pode solicitar o encerramento do acesso e a revogação das integrações pelos canais de contato da MBA Labs e também diretamente nas configurações da Conta Google."
    ]
  },
  {
    title: "8. Propriedade intelectual",
    paragraphs: [
      "A plataforma, seus componentes, marcas, textos, layouts e códigos pertencem à MBA Labs ou aos respectivos licenciadores. O uso do sistema não transfere direitos de propriedade intelectual ao usuário."
    ]
  },
  {
    title: "9. Limitação de responsabilidade",
    paragraphs: [
      "Na extensão permitida pela legislação, a MBA Labs não responde por decisões tomadas por serviços de terceiros, perda decorrente de informações incorretas fornecidas pelo usuário, indisponibilidade externa ou uso da plataforma em desacordo com estes Termos.",
      "Nada nestes Termos exclui direitos que não possam ser afastados pela legislação brasileira."
    ]
  },
  {
    title: "10. Legislação e alterações",
    paragraphs: [
      "Estes Termos são regidos pela legislação brasileira. A versão vigente estará publicada nesta página e poderá ser atualizada para refletir mudanças legais, técnicas ou operacionais."
    ]
  }
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Documentos legais"
      title="Termos de Uso"
      description="Regras aplicáveis ao acesso e à utilização dos sistemas, integrações e serviços disponibilizados pela MBA Labs."
      updatedAt="29 de julho de 2026"
      sections={sections}
    />
  );
}
