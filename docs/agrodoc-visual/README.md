# MBA AgroDoc — implementação visual e homologação

**Estado: rascunho; não aprovado para produção nem como reprodução 1:1 concluída.**

A implementação evolui o DroneGestor em `apps/mba-labs-core`, partindo de `de3608c2` da PR #193. Autenticação, APIs, isolamento por empresa, storage, fórmulas operacionais e preenchimento XLSX existentes foram preservados. Não há migração ou gravação de registros de negócio nesta entrega.

## Rotas e componentes

Todas as rotas abaixo permanecem dentro de `/apps/dronegestor` e exigem o acesso MBA Labs existente.

| Seção | Rota | Implementação principal |
|---|---|---|
| Visão geral / piloto mobile | `/apps/dronegestor` | `DroneHomeDashboard.tsx` |
| Diagnóstico | `/apps/dronegestor/diagnostico` | `diagnostico/AgroDocDiagnostic.tsx` |
| Operações | `/apps/dronegestor/gestao` | `AgroDocOperations.tsx`; formulários existentes sob demanda |
| Conferência | `/apps/dronegestor/conferencia` | `conferencia/AgroDocReviewCenter.tsx` |
| Relatórios MAPA | `/apps/dronegestor/relatorio-mensal` | `relatorio-mensal/AgroDocReports.tsx` |
| Documentos | `/apps/dronegestor/documentos` | `documentos/AgroDocDocuments.tsx` |
| Cadastros | `/apps/dronegestor/cadastros` | `cadastros/AgroDocRegistry.tsx` |
| Configurações | `/apps/dronegestor/configuracoes` | `configuracoes/AgroDocSettings.tsx`, `AgroDocOperationalSettings.tsx` |

Design compartilhado: `DroneAppShell.tsx` (sidebar, header, conta e navegação mobile), `AgroDocUi.tsx` (hero, cards, KPIs, tabela, status e fluxo), `AgroDocDroneIcon.tsx`, `agrodoc.css` e recortes exclusivamente fotográficos em `public/agrodoc`. A calculadora pública conserva sua exceção de layout. A navegação inferior do novo shell não aparece no fluxo de campo, que possui controles próprios.

## Comparações visuais

Referência fornecida à esquerda; implementação capturada à direita. São comparações manuais, **não um teste de igualdade de pixels aprovado**.

As oito capturas desktop usam uma área de renderização isolada de **1448 × 1086**; celular **390 × 844**, com inspeções adicionais em **360 × 800** e **1024 × 768**. Os componentes são os mesmos da aplicação. O cenário de captura tem dados vazios e uma operação explicitamente identificada como **QA — não persistida**, sem documentos, licenças ou aprovações inventadas. A montagem de QA foi temporária e foi retirada das rotas entregues. Portanto estas capturas não comprovam autenticação, persistência ou dados produtivos. A seleção da sidebar não é representada nessa montagem isolada.

| Página | Comparativo | Captura |
|---|---|---|
| Visão geral | [Comparar](comparativos/01-visao-geral.jpg) | [1448 × 1086](capturas/01-visao-geral.jpg) |
| Diagnóstico | [Comparar](comparativos/02-diagnostico.jpg) | [1448 × 1086](capturas/02-diagnostico.jpg) |
| Operações | [Comparar](comparativos/03-operacoes.jpg) | [1448 × 1086](capturas/03-operacoes.jpg) |
| Conferência | [Comparar](comparativos/04-conferencia.jpg) | [1448 × 1086](capturas/04-conferencia.jpg) |
| Relatórios | [Comparar](comparativos/05-relatorios.jpg) | [1448 × 1086](capturas/05-relatorios.jpg) |
| Documentos | [Comparar](comparativos/06-documentos.jpg) | [1448 × 1086](capturas/06-documentos.jpg) |
| Cadastros | [Comparar](comparativos/07-cadastros.jpg) | [1448 × 1086](capturas/07-cadastros.jpg) |
| Configurações | [Comparar](comparativos/08-configuracoes.jpg) | [1448 × 1086](capturas/08-configuracoes.jpg) |
| Piloto mobile | [Comparar](comparativos/09-mobile-390.jpg) | [390 × 844](capturas/09-mobile-390.jpg) |

[Celular 360 × 800](capturas/responsive-360.jpg) · [Tablet 1024 × 768](capturas/responsive-1024.jpg).

Na primeira inspeção, o diagnóstico excedia a altura da referência: nomes, larguras e densidade da tabela foram ajustados. Também foram ajustados o cabeçalho mobile, os ícones agrícolas e a representação em âmbar de operações ainda não aprovadas no gráfico MAPA. O menu mobile foi aberto e fechado no navegador.

## Validação executada

- `npm run typecheck`: passou nos workspaces que possuem o comando.
- `npm run build:core`: passou, incluindo a suíte pré-build de Cotações (136 testes).
- `npm run test:agrodoc --workspace=mba-labs-core`: **15 testes passaram** (8 existentes de contas de piloto e 7 novos de conferência).
- Novos testes executam a rota real de conferência com dependências de sessão/banco substituídas por fixtures: sem sessão, piloto bloqueado, escopo por empresa, registro inexistente, autoria/timestamp, multiproduto, horas inválidas e motivo obrigatório de correção.
- `npm run test:agrodoc:visual --workspace=mba-labs-core`: **12 testes ignorados**, por ausência de URL e sessão autenticada de homologação. Isso não é aprovação de E2E.
- Capturas e inspeções do navegador descritas acima são revisão visual isolada, separada dos testes E2E autenticados.

Para executar os testes visuais no preview com uma sessão autorizada:

```bash
AGRODOC_BASE_URL=https://URL-DO-PREVIEW \
AGRODOC_STORAGE_STATE=/CAMINHO-PRIVADO/gestor.json \
npm run test:agrodoc:visual --workspace=mba-labs-core
```

O arquivo de sessão contém credenciais e deve ficar fora do Git. Não há rota de bypass de autenticação nesta entrega. Relatórios, traces e sessões locais estão ignorados pelo Git.

## Diferenças funcionais e pendências de aceite

1. **Fidelidade ainda não homologada:** distribuição geral, paleta, sidebar, cards, fluxo e identidade mobile implementados, mas banner, tipografia, ícones, alturas e estados preenchidos ainda diferem das imagens. Não foi demonstrada igualdade 1:1.
2. **Dados reais e E2E:** precisam de sessão de homologação com empresa, gestor/RT e piloto. Ainda é necessário testar criação/atribuição de OS, anexos, correção, aprovação e retorno ao piloto através da interface real.
3. **Planilha oficial:** o motor e as validações da PR #193 não foram alterados. Ainda falta cadastrar o XLSX original em homologação, exportar e comparar abas, fórmulas, validações, totais e bloqueios com dados reais. A prévia da tela mostra dados conferidos; não é renderização fiel de todas as células do XLSX.
4. **Cadastros:** usam equipamentos, pilotos, fazendas e clientes existentes. ANATEL e validade não constam no cadastro atual de equipamento e aparecem como indisponíveis/para conferência. Não se deduz regularidade pelo simples preenchimento do prefixo. RT é editado no perfil operacional. Importação de cadastros não foi implementada nem apresentada como botão funcional.
5. **Documentos:** a API atual exige uma OS; a central consulta a operação selecionada, não todos os arquivos da empresa simultaneamente. Limite real: 10 MB; PDF/JPG/PNG/WebP/XLSX. O compartilhamento copia a rota interna que exige login e autorização, sem transformar anexos em arquivos públicos. Volume de armazenamento não é mensurado. O checklist SARPAS legado se refere à operação ativa, explicitada no controle.
6. **Integrações e notificações:** órgãos oficiais aparecem como acompanhamento manual. Não existem conexões ANAC/DECEA/MAPA simuladas. Alertas por e-mail/push não foram implementados; os avisos disponíveis são consultados nas telas. Os controles operacionais existentes têm leitura/gravação pela API atual e só podem ser alterados por perfil autorizado.
7. **Indicadores:** o gráfico da visão geral considera o histórico disponível em até 500 registros, explicitado na tela. O KPI de OS encerradas usa o status atual e o mês da data prevista da OS, explicitado na interface; não é o indicador de voos finalizados do histórico. A visão de piloto mantém dados próprios e não consulta o painel gerencial proibido ao seu perfil.
8. **Responsividade autenticada:** as três resoluções foram inspecionadas no cenário isolado; falta percorrer todos os formulários preenchidos, com zoom, teclado e permissões reais. A suíte Playwright preparada precisa ser executada nessa sessão.

**Não fazer merge ou promover para produção antes de resolver os itens de homologação e revisar as diferenças visuais.**
