# Homologação documental e geradores MAPA - 22/11/2026

## Escopo autorizado

O usuário esclareceu que o destino do relatório mensal é MAPA. Solicitou documentos fictícios com campos semelhantes aos reais e um cenário de aplicação para ensaio. Não houve remessa a órgão público, voo, comando de aeronave, aprovação oficial, migração ou alteração RLS. Não foi criado outro projeto ou recurso pago.

## Ações no sistema publicado

Sessão Pulveriza63, somente empresa E2E TESTE - DroneGestor QA, OS-20261121-71DF6:

- Anexados10 PDFs adicionais: ficha SISANT, amostra SARPAS, avaliação de risco, receituário estrutural, mapa sintético, exame, seguro, registro MAPA, ficha mensal e diário de aplicação simulada. Todos marcados SIMULAÇÃO / SEM VALIDADE OFICIAL, sem brasão, assinatura, protocolo ou certificação real.
- Categoria de cada arquivo corresponde ao tipo cadastrado no sistema. Anexo de amostra SARPAS não alterou status para autorizado. Presença de arquivo não comprova regularidade.
- Ficha mensal revisada: duas cargas de12min com pausa de6min somam24min efetivos no período08:00–08:30. Arquivo HOMOLOGACAO_12_Relatorio_MAPA_REV2.pdf substitui conceitualmente a ficha inicial (mantida para rastreabilidade e limpeza posterior).
- Perfil operacional da empresa fictícia preenchido com nome HOMOLOGAÇÃO, registro TESTE-SEM-REGISTRO-OFICIAL, processo SIMULACAO-SEM-PROCESSO-SEI, RT fictício, e-mail example.invalid e nota explícita de simulação. CPF/CNPJ e telefone permanecem vazios. Esses campos não comprovam registro ou habilitação.
- Anexados XLSX e PDF gerados pelo código real em ensaio isolado em memória. Com os3 arquivos da rodada anterior,10 novos,1 revisão e2 saídas, a OS tem16 arquivos de homologação para revisão/limpeza.
- Download da planilha pelo botão do sistema confirmado byte a byte: SHA256 95cb2b2778ddeacdf050331dea562f1d0e2c3ab43a93e28b2f0dfa2b98a19677.

## Cenário e diferença entre os testes

Área1,5ha, duas cargas0,75ha/7,5L, total15L, produto fictício100mL/ha, total150mL,24min efetivos. O diário é documento hipotético, não registro real de campo.

Os handlers reais de XLSX e PDF rodaram com autenticação, armazenamento e consultas substituídos por fixtures somente em memória, sem conexão com Supabase. A aprovação e conclusão existem apenas nessa fixture local. Nenhum evento operacao_finalizada foi gravado em produção e a OS continua em preparação. A planilha base do teste é SINTÉTICA e rotulada em todas as abas de mês. Não é o modelo oficial do MAPA, não foi cadastrada como modelo oficial e não comprova compatibilidade com o original.

A geração em memória aprovou preenchimento, abas/fórmula, separação de empresas/competências e bloqueios por autenticação, papel, ausência de modelo, perfil, aprovação, duração e ano. O pacote PDF inclui dados/pendências da simulação e recebe aviso em todas as páginas. Não comprova homologação da conclusão ou upload com sessão do piloto. Os anexos publicados foram enviados pelo administrador empresarial.

## Defeito encontrado e correção

O PDF usava o fuso padrão do servidor ao formatar datas. No servidor UTC, 11:00Z aparecia11h, embora corresponda08h em Palmas. A formatação passou a usar America/Araguaina, consistente com a competência MAPA. Testes verificam estabilidade sob UTC e America/Los_Angeles. Correção preparada na branch, NÃO PUBLICADA. Nenhuma função operacional ou política foi alterada.

## Validação

10 testes novos aprovados (8 de handlers/simulações e2 de data). ESLint dos arquivos alterados sem erros/avisos. Build Next.js aprovado, incluindo TypeScript. Não repetidos os testes funcionais já aprovados sem relação com esta mudança. Falha inicial do teste PDF era limitação do runner strip-only com propriedade de parâmetro TypeScript; o loader de teste passou a transpilar esse handler com a dependência TypeScript já existente, sem alterar seu comportamento.

## Bloqueios e próximos testes

A página publicada Relatórios MAPA mostrou0 operações aprovadas, modelo oficial ausente e botão Baixar XLSX oficial desabilitado. O modelo original2026, versão01-01-2026, deve ser obtido na fonte MAPA e cadastrado sem substituir por fixture. A fonte oficial consultada orienta remessa por processo SEI e disponibiliza o modelo2026 no Drive institucional:
https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/relatorios-mensais/relatorios-mensais

Faltam validação1:1 do original, fluxo de geração pela página publicada com operação concluída e conferência, ciclo de upload em sessão própria do piloto, encerramento parcial/total e testes de remessa manual sem submissão real. API oficial permanece fora do ensaio e desabilitada. A prévia PDF embutida continua bloqueada pelo Chromium deste navegador, como já registrado.

## Limpeza

Os16 anexos da OS são fictícios, incluindo ficha mensal inicial superada pela REV2. Preservar evidências agora e remover depois pelo fluxo autorizado. Não excluir documentos reais. Restaurar o perfil fictício anterior se solicitado (era vazio). Não usar esta empresa ou arquivos para envio oficial.


## Continuação com modelo recebido

O bloqueio de modelo ausente foi superado após receber o XLSX do usuário. Cadastro/download produtivo e novo ensaio estão em [DRONEGESTOR-HOMOLOGACAO-MAPA-ORIGINAL-20261122.md](DRONEGESTOR-HOMOLOGACAO-MAPA-ORIGINAL-20261122.md). Corrigida duplicação de validações na PR204, ainda sem publicação.
