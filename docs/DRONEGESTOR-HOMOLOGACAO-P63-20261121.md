# Homologação produtiva — administrador Pulveriza 63

Data: 21/11/2026. Sessão autenticada com entrada segura pelo usuário. Empresa exibida: E2E TESTE - DroneGestor QA. Nenhuma credencial foi incluída neste repositório.

## Execução real

| Página / ação | Resultado observado |
|---|---|
| Dashboard | Conta Pulveriza 63 autenticada |
| Funcionários e acessos | Cinco usuários da empresa de teste listados |
| Administração do sistema | Conta empresarial redirecionada ao DroneGestor, acesso negado |
| `/admin/usuarios` | Conta empresarial redirecionada ao DroneGestor, sem lista geral |
| Clientes | Cadastro HOMOLOGAÇÃO salvo |
| Fazendas | Cadastro HOMOLOGAÇÃO salvo, Palmas/TO |
| Talhões | Cadastro HOMOLOGAÇÃO salvo, 1,5 ha, Milho |
| Ordens de serviço | OS fictícia salva e apareceu no seletor sem recarregar |
| Preparar missão em Equipe | Exigiu atribuição prévia de piloto |
| Atribuição de piloto | OS fictícia atribuída ao E2E Piloto João |
| Pilotos | Dois pilotos de teste ativos; responsável da OS confirmado |
| Documentos de OS de outra empresa de teste | API recusou com “OS não encontrada ou inativa.” |

## Problemas e correções

1. Cadastro do primeiro administrador usava action central que redirecionava para `/admin/usuarios`. Substituído por interface/API internas, validações server-side e resposta JSON. Todos os passos de empresa/acesso/administrador ficam no DroneGestor.
2. Atribuição de piloto persistia, mas tabela principal e cartão da OS mantinham “Piloto não definido”. Componentes de gestão agora emitem/escutam atualização compartilhada. Reteste produtivo aprovado após deploy: reatribuição da OS fictícia ao E2E Piloto Pedro atualizou tabela e cartão sem recarregar.

71 testes automatizados aprovados e build aprovado. Testes usam fixtures e não substituem validação RLS real. Captura `piloto-atribuido-antes-correcao.jpg` registra a atribuição antes do ajuste de sincronização.

## Registros fictícios para remoção ao encerrar a homologação

Não remover usuários/pilotos preexistentes nem registros reais. Remover somente os registros abaixo, respeitando dependências e anexos:

| Tipo | Nome / identificação | ID |
|---|---|---|
| Cliente | HOMOLOGAÇÃO P63 20261121 - CLIENTE | 79e2414e-6f34-4dc3-af38-f573c69256d5 |
| Fazenda | HOMOLOGAÇÃO P63 20261121 - FAZENDA | 1092135b-ada3-4208-bc6c-dba4f2e0cc46 |
| Talhão | HOMOLOGAÇÃO P63 20261121 - TALHÃO | c03ff83f-a6e4-4dd4-9b6c-5103feb9d01b |
| OS | OS-20261121-71DF6 — HOMOLOGAÇÃO - SEM APLICAÇÃO REAL | 71df64e7-3148-451d-9eb6-d3001393a3f4 |

## Pendências

- RLS `core_logs`: isolamento por empresa não comprova restrição entre perfis da mesma empresa. Alteração de políticas depende de apresentação de riscos/recuperação e autorização específica.
- Oito fases completas, encerramento parcial/total e permissões de piloto/RT: precisam de sessões próprias e operação fictícia completa. Encerramento parcial continua pendente conforme relatório anterior.
- Seis larguras 360/390/768/1024/1440/1920 não foram executadas nesta sessão: navegador não oferece resize e DevTools está bloqueado por política. Capturas atuais não comprovam essas larguras.
- Onboarding do proprietário dentro da nova tela precisa de sessão geral; a conta empresarial corretamente não pode acessá-la.
- Google Drive e SARPAS não foram integrados/acionados nesta rodada. Nenhum pedido oficial, relatório público, notificação real ou comando de aeronave foi enviado.
- Nenhuma migration, permissão produtiva, perfil operacional Solo/Equipe ou cadastro real foi alterado nesta rodada.

## Complemento após publicação da PR #200

Deploy `dpl_E4fFHSogDptdesvR4rB8ysHL5KHc`, commit main `04d859cff1c49018b2564e55c2a72ee0f7e3cec0`, estado READY e domínio www.mbalabs.com.br confirmado. API de administração geral negou a conta empresarial com mensagem exclusiva do gestor do sistema.

- MBA Calda: misturador200L, taxa10L/ha, tanque20L e área1,5ha resultaram em15L de calda e150mL para produto fictício100mL/ha. A mistura cheia correspondeu a20ha e10tanques.
- Vazão:10L/ha ×18km/h ×5m ÷600 =1,5L/min, confirmado.
- Rendimento:9ha,18km/h,5m,100% eficiência e zero paradas resultaram em9ha/h,1h e5cargas de20L.
- Custos:9ha ×R$100, variávelR$40/ha e fixoR$90 resultaram em receitaR$900, custoR$450, resultadoR$450, margem50% e equilíbrio1,5ha.
- Drone **HOMOLOGAÇÃO P63 20261121 - DRONE** cadastrado, série **HOMOLOGACAO-P63-20261121**, identificação **HOMOLOGACAO-SEM-REGISTRO-REAL**. Acrescentar à limpeza; não representa aeronave real.
- Modo campo: selecionou equipamento e preencheu registro, atomizador, tanque, volume, faixa, velocidade e altura automaticamente. Cálculo da missão fictícia retornou15L/150mL/1,5L/min. Fase3 recusou continuar sem confirmação técnica; não foi declarada conferência real de receita/bula ou executada aplicação.
- Capturas adicionais: calculadora-custos.jpg, drone-ficticio.jpg, bloqueio-seguranca.jpg e piloto-sincronizado.jpg.

A criação de novos funcionários não foi submetida nesta sessão. O cadastro/listagem e papéis foram inspecionados, mas novas contas exigem validação específica. A homologação geral permanece parcial pelos bloqueios descritos acima.
