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
2. Atribuição de piloto persistia, mas tabela principal e cartão da OS mantinham “Piloto não definido”. Componentes de gestão agora emitem/escutam atualização compartilhada. Reteste produtivo após deploy deve verificar ambos sem recarregar.

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
