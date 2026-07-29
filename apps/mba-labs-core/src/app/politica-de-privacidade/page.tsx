import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade | MBA Labs",
  description: "Política de Privacidade da plataforma MBA Labs e de suas integrações com serviços de terceiros."
};

const sections = [
  {
    title: "1. Quem somos",
    paragraphs: [
      "A MBA Labs desenvolve e opera sistemas de gestão acessíveis pelo domínio mbalabs.com.br. Esta Política explica como tratamos dados pessoais e empresariais utilizados na plataforma, inclusive quando um usuário autoriza integrações com serviços de terceiros, como o Google Business Profile."
    ]
  },
  {
    title: "2. Dados que podemos tratar",
    items: [
      "Dados de identificação e contato, como nome, e-mail, telefone e empresa vinculada.",
      "Dados cadastrais da empresa, como nome comercial, CNPJ, endereço, horários, categoria, site e canais de atendimento.",
      "Informações técnicas de acesso, registros de operações, data, horário e eventos de segurança.",
      "Identificadores da Conta Google e das contas ou localizações do Google Business Profile autorizadas pelo próprio usuário.",
      "Tokens OAuth necessários para manter a integração ativa. Esses tokens são armazenados de forma criptografada e não incluem a senha da Conta Google.",
      "Dados e conteúdos fornecidos voluntariamente pelo usuário durante o uso dos sistemas da MBA Labs."
    ]
  },
  {
    title: "3. Como utilizamos os dados",
    items: [
      "Autenticar usuários e controlar permissões de acesso.",
      "Executar as funcionalidades contratadas ou solicitadas dentro dos sistemas MBA Labs.",
      "Pesquisar, criar, atualizar e acompanhar Perfis da Empresa no Google somente após autorização expressa do responsável.",
      "Evitar duplicidades, registrar o histórico de operações e apoiar a resolução de erros.",
      "Proteger a plataforma contra fraude, uso indevido e incidentes de segurança.",
      "Cumprir obrigações legais, regulatórias e contratuais aplicáveis."
    ]
  },
  {
    title: "4. Uso de dados obtidos pelas APIs do Google",
    paragraphs: [
      "O uso e a transferência de informações recebidas das APIs do Google seguem a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.",
      "A MBA Labs solicita apenas os escopos necessários ao funcionamento do painel. O usuário autoriza diretamente no ambiente do Google e pode revogar o acesso a qualquer momento nas configurações de segurança da própria Conta Google.",
      "Não vendemos dados obtidos pelas APIs do Google, não utilizamos esses dados para publicidade comportamental e não os compartilhamos com terceiros para finalidades incompatíveis com a autorização concedida."
    ]
  },
  {
    title: "5. Compartilhamento",
    paragraphs: [
      "Podemos utilizar prestadores de infraestrutura e tecnologia estritamente necessários à operação da plataforma, como serviços de hospedagem, banco de dados, autenticação e envio de comunicações. Esses fornecedores tratam dados conforme suas próprias políticas e contratos aplicáveis.",
      "Também poderemos compartilhar informações quando isso for necessário para cumprir uma obrigação legal, ordem de autoridade competente, proteger direitos ou investigar uso indevido da plataforma."
    ]
  },
  {
    title: "6. Armazenamento e segurança",
    paragraphs: [
      "Adotamos controles técnicos e organizacionais compatíveis com a natureza dos dados tratados, incluindo controle de acesso, registros de auditoria e criptografia de tokens OAuth em repouso.",
      "Nenhum sistema é totalmente imune a riscos. Em caso de incidente relevante, adotaremos as medidas cabíveis e as comunicações exigidas pela legislação aplicável."
    ]
  },
  {
    title: "7. Retenção e exclusão",
    paragraphs: [
      "Mantemos os dados pelo período necessário para prestar o serviço, cumprir obrigações legais, preservar registros de segurança e exercer direitos. Quando a integração Google é revogada ou encerrada, os tokens de acesso podem ser invalidados ou removidos, observados os prazos técnicos e legais aplicáveis.",
      "O titular pode solicitar acesso, correção, portabilidade, oposição ou exclusão de dados, quando cabível, pelo canal de contato informado nesta página."
    ]
  },
  {
    title: "8. Cookies e tecnologias semelhantes",
    paragraphs: [
      "Podemos usar cookies essenciais para manter sessões autenticadas, preferências e segurança. A plataforma não depende de cookies de publicidade para executar o painel Google Empresas."
    ]
  },
  {
    title: "9. Atualizações desta política",
    paragraphs: [
      "Esta Política poderá ser atualizada para refletir mudanças legais, técnicas ou operacionais. A versão vigente estará sempre publicada nesta página com a data da última atualização."
    ]
  }
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Documentos legais"
      title="Política de Privacidade"
      description="Como a MBA Labs coleta, utiliza, protege e permite o controle dos dados tratados em seus sistemas e integrações."
      updatedAt="29 de julho de 2026"
      sections={sections}
    />
  );
}
