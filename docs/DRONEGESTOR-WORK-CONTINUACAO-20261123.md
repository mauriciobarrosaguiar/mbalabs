# Continuação Work — PR #206 — 23/11/2026

## Estado confirmado na retomada
- HEAD remoto: `2925b6afdebde6e306148ea44ec2fa7777856ada`. Sem commits posteriores no início desta rodada; cinco commits depois de `928e9a79`.
- PR aberta, em rascunho, 95 commits / 152 arquivos alterados. Não houve merge.
- CI do HEAD anterior: [DroneGestor #82](https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/45194615024) e [Core #900](https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/45194613592): success.
- Domínio oficial confirmado na Vercel: `dpl_Cv2zCwnakapLQEykXs5BCxkYJTna`, READY, production, SHA `928e9a79c08d7fa45fa39f310f6e5508c1521a17`.
- As variáveis Supabase gerais da Vercel atendem simultaneamente preview/production/development. A única exceção de branch encontrada é `qa/mba-cotacoes-homologacao`, que não é a branch desta PR. Portanto a prévia desta PR **não é isolada**. Nenhuma escrita de homologação remota realizada.

## Correções efetivas desta rodada
1. **Checklist SARPAS promovia rascunho a resultado:** `DroneDocumentsCenter` utilizava `status` e `numero` editáveis antes de salvar. Agora calcula a situação exclusivamente do registro confirmado pelo servidor. Falha de POST mantém pendência; editar formulário não modifica a conferência persistida. Quatro testes executam estado e handlers reais do componente com HTTP isolado.
2. **Histórico sem checkpoint recebia plano atual:** a segunda fusão incondicional em `operacao-os` contornava a proteção por status do helper. Removida. OS iniciada/suspensa/encerrada sem snapshot não ganha histórico técnico inventado. Checkpoints com `operationStarted`, `startedAt` ou estado operacional histórico prevalecem mesmo com status da OS desatualizado. Nove regressões adicionais via handler GET real, sem gravações.
3. **Clareza documental/mobile:** referência SARPAS é descrita como declaração do operador; anexo e seleção manual não representam validação DECEA nem liberação. Fazenda/talhão e nome do arquivo podem quebrar linha na central. Homologação visual autenticada ainda pendente.
4. **Teste original MAPA estava desatualizado:** fixture não informava `status: ativo`, provocando 401 ao fornecer o original. Corrigida apenas a sessão de teste; controles de produção mantidos.

## Validação executada
- `test:agrodoc`, com o arquivo original solicitado: **258 aprovados, zero falhas, zero ignorados**. Sem o arquivo opcional, 257 aprovados e um ignorado.
- Original efetivamente localizado: `3. PLANILHA RELATÓRIO MENSAL v. 01-01-2026.xlsx`, 3.976.950 bytes, fornecido pelo titular. Exportador real executado com backend isolado. Verificação ZIP/XML preserva partes, fórmulas, validações e recursos das abas; nenhuma gravação Supabase. Saída marcada como homologação no operador.
- TypeScript aprovado. Build completo final aprovado. CI remoto será registrado no complemento desta entrega.
- Lint dos cinco arquivos envolvidos: sem erros ou avisos após limpeza.
- Evidências textuais em [evidencias/dronegestor-20261123-work-fase3](evidencias/dronegestor-20261123-work-fase3).
- Login remoto observado: redirecionamento para `/login?next=%2Fapps%2Fdronegestor`. Nenhuma conta autenticada nesta rodada. Não repetir download básico já registrado pelo titular.

## Segurança atual — confirmação somente leitura
Consulta em `pg_policies` do projeto MBA Labs confirmou somente `core_logs_select` e `core_logs_insert`, permissivas, para `authenticated`, condicionadas a administrador ou empresa. As quatro políticas restritivas propostas continuam ausentes. Migration preparada na PR, **não aplicada**.

O ensaio RLS PGlite passou com a suíte, mas não comprova segurança da Data API produtiva nem sessões reais por perfil. Não usar produção comercial enquanto este bloqueador não for resolvido e testado. Nenhuma política foi desabilitada.

## Matriz das oito fases oficiais
Numeração extraída de `DroneSimpleFlowUX.tsx`, sem renumeração.

| Fase | Nome oficial | Evidência válida | Limite atual |
|---|---|---|---|
| 1 | Ordem de serviço | OS Pedro e dados já apresentados nas evidências anteriores | Não é aprovação integral de todos os vínculos e formulários |
| 2 | Planejamento | Cálculos anteriores preservados; regressões de plano aprovadas | Novo percurso publicado com sessão específica pendente |
| 3 | Documentação e autorizações | GET/planos/snapshots/rascunho SARPAS aprovados automaticamente | Reteste visual da correção, links expirados e perfis reais pendentes |
| 4 | Segurança em campo | Guardas automatizadas da suíte | Sem clima, GPS, inspeção ou autorizações reais inventados |
| 5 | Equipamento e calibração | Regressões existentes preservadas | Validação física e fluxo autenticado pendentes |
| 6 | Preparo da calda | Cálculos e regressões existentes preservados | Fluxo autenticado completo pendente |
| 7 | Liberação e aplicação | Parcial 12 → 17 → 20 ha, invariantes, replay e sincronização cobertos pela suíte | Offline e troca entre aparelhos independentes não homologados pela interface |
| 8 | Pós-operação | PDF e XLSX isolados; original MAPA passou nesta rodada | MAPA pós-complementação e fechamento completos pela interface pendentes |

## Checklist para liberação
- [x] Recuperar HEAD/CI/arquivos alterados/deploy oficial antes de editar.
- [x] Preservar alterações anteriores e não tocar banco/dados produtivos.
- [x] Corrigir e testar defeitos adicionais da Fase 3.
- [x] Testar GET com planejamento de preparação e snapshots históricos.
- [x] Rascunho SARPAS não conclui conferência; seleção manual identificada como declaração.
- [x] Executar suíte incluindo encerramento parcial e invariantes existentes.
- [x] Localizar original MAPA e executar teste antes ignorado.
- [x] Reconfirmar ausência das políticas RLS propostas por consulta de metadados.
- [ ] Autenticar **Piloto E2E Pedro** na prévia exata para leitura da OS `OS-20261123-45737`.
- [ ] Retestar central Fase 3 e acesso direto à API com sessão do piloto, sem escrita.
- [ ] Confirmar acesso/download/expiração/erro de anexos em sessões específicas de gestor, RT, outra empresa, sem permissão e expirada.
- [ ] Disponibilizar ambiente com banco e armazenamento comprovadamente isolados antes de criar cenários de 20 ha.
- [ ] Parcial/complementação, offline antes/durante/após confirmação e troca de dois dispositivos reais: homologação por interface.
- [ ] Seis resoluções reais: 360×800, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080; encontradas nos testes existentes, não executadas nesta rodada.
- [ ] Drive por empresa/OS, quotas reais, expiração e falhas: homologação autenticada isolada.
- [ ] MAPA com complementações e revisão do gestor/RT pela interface.
- [ ] Plano de backup, validação e autorização específica para migration RLS; depois validar Data API com perfis próprios.
- [ ] Autorizar separadamente um deploy produtivo específico; merge permanece não autorizado.

## Percentuais e critérios
A suíte executada com original teve **100% de aprovação (258/258)**. Isso mede testes automatizados, não requisitos comerciais ou voos reais.
Não existe base verificável para estimar um percentual global de requisitos a partir de amostras e evidências antigas. **0/8 fases estão integralmente homologadas de ponta a ponta nesta rodada**; isso não apaga aprovações parciais anteriores. Publicação, autenticação, isolamento e evidências operacionais pendentes impedem declarar 100%.

## Próximas intervenções indispensáveis
1. Login da conta **Piloto E2E Pedro** no navegador Work, sem informar senha no chat. Depois seguir somente leitura na prévia conectada à produção.
2. Definir isolamento verificável antes das escritas de homologação. Não contratar infraestrutura paga nem reutilizar dados reais automaticamente.
3. Autorizações específicas continuam necessárias para migration produtiva, merge e publicação; nenhuma delas foi executada nesta rodada.
