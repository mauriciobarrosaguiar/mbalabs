# DroneGestor — administração do sistema e funcionários por empresa

## Resultado

Implementação em branch, sem publicação ou mudança de banco. Depende das correções da PR #198. Usa os cadastros e tabelas existentes da MBA Labs; não cria projeto Supabase, schema ou recurso pago.

Consulta de leitura confirmou que a conta do titular já é `super_admin`, `tipo_global=super_admin`, com status `ativo`. Nenhuma permissão real foi alterada.

## Jornada

1. O gestor do sistema entra no DroneGestor em **Configurações → Administração do sistema**.
2. Cadastra a empresa pelo formulário central existente da MBA Labs, evitando outro cadastro de empresa.
3. Na lista de empresas, usa **Liberar / configurar aplicativos**, seleciona DroneGestor e define situação/validade.
4. Na própria administração do DroneGestor, preenche o formulário **Administrador da empresa**: empresa, nome, e-mail, telefone e senha inicial. O formulário usa o fluxo administrativo existente e fixa usuário global comum e perfil de app `admin_empresa`; não oferece Super Admin.
5. O administrador da empresa acessa **Gestão → Funcionários e acessos**, também disponível em **Minha equipe → Cadastrar funcionários**.
6. Cadastra funcionários com perfil operacional e acesso restrito à própria empresa. Pilotos e aplicadores recebem também cadastro operacional para serem atribuídos às OS.

## Perfis

| Acesso | Cadastra empresas e libera aplicativos | Cadastra funcionários | Escopo |
|---|---|---|---|
| Super Admin MBA Labs | Sim | Para sua empresa vinculada; primeiro administrador pelo painel do sistema | Todas as empresas no painel geral |
| Administrador da empresa no DroneGestor | Não | Sim | Somente sua empresa |
| Gestor operacional | Não | Não | Operações autorizadas da empresa |
| Responsável técnico | Não | Não | Rotinas técnicas autorizadas |
| Piloto / Aplicador CAAR | Não | Não | Operações e permissões de piloto |
| Visualizador | Não | Não | Permissões de consulta do app |

O administrador da empresa não pode criar Super Admin nem outro administrador empresarial pelo formulário de funcionários. O primeiro administrador e os acessos administrativos adicionais continuam sob responsabilidade do gestor do sistema.

## Implementação

- `/apps/dronegestor/administracao`: página autenticada exclusiva de administrador geral ativo; consulta até 500 empresas, mostra o vínculo com o DroneGestor e encaminha ao cadastro central/contratos. Inclui formulário de primeiro administrador reutilizando a action administrativa existente.
- `/apps/dronegestor/funcionarios`: página exclusiva de administrador empresarial ou geral, com cadastro e listagem de funcionários. Não implementa edição/bloqueio genéricos de funcionários nesta entrega.
- `/api/dronegestor/empresa/usuarios`: GET/POST com validação server-side. Empresa e app derivam da sessão; campos de empresa, app e privilégios globais no corpo são recusados. Valida empresa ativa, aplicativo ativo, vínculo ativo/teste e vencimento antes de consultar ou criar funcionários.
- Perfis admitidos no cadastro: gestor operacional, responsável técnico, piloto, aplicador CAAR e visualizador.
- Criação de Auth/perfil global comum/permissão reaproveita o helper de pilotos e sua compensação de falhas. Vínculo existente no DroneGestor gera conflito em vez de sobrescrever o papel. Conta de outra empresa, inativa ou administrativa não é vinculada pelo formulário.
- Registro de auditoria guarda IDs, perfil e autoria; não guarda senha. Pilotos/aplicadores também recebem registro operacional com permissões conservadoras. Falha na gravação aciona a compensação da conta/permissão.
- Senha inicial via POST autenticado, não armazenada no navegador, código, URL ou log. O campo é limpo ao concluir a tentativa. Conta existente de mesma empresa preserva senha; nenhum e-mail/notificação é disparado pelo novo fluxo. O envio da senha inicial ao funcionário continua sendo responsabilidade do administrador.
- Rotas antigas de criação, alteração de autorizações e inativação de pilotos também passam a exigir administrador empresarial/geral. Gestor operacional e RT preservam suas rotinas operacionais, sem conceder acessos de funcionários.
- E-mails são escapados nas consultas ILIKE para que `%` e `_` não sejam interpretados como curingas.
- Navegação oculta os atalhos para perfis não autorizados; o servidor autoriza páginas e APIs independentemente da ocultação visual.

## Validação e limites

- 56 testes automatizados DroneGestor aprovados. Novos testes verificam acesso não autenticado/inativo, RT/piloto/gestor sem delegação, ausência de empresa/liberação/contrato, contrato vencido, empresa bloqueada, injeção de tenant/app/privilégio, escopo de listagem, piloto atribuível, auditoria sem senha, compensação e proteção de administradores existentes.
- TypeScript, lint dos arquivos alterados e build: consultar saídas em `docs/evidence/dronegestor/administracao-empresas-20261121/`.
- Testes usam fixtures/mocks e não comprovam RLS real. Nenhuma conta ou empresa foi criada em produção nesta rodada.
- As novas telas não foram publicadas nem homologadas com sessão real. Testes visuais e responsividade das novas telas continuam pendentes.
- O bloqueio conhecido das políticas `core_logs` permanece: os controles de API não corrigem políticas amplas no acesso direto ao Supabase. Não considerar esta entrega uma homologação de segurança completa.
- O formulário de primeiro administrador utiliza a action central existente; sua criação real e o onboarding integral empresa → administrador → funcionário precisam ser homologados após autorização, usando somente dados fictícios.
- Compensações entre Auth, perfil, permissão e logs não são uma transação distribuída; falha de infraestrutura durante a compensação exige conferência/reconciliação. Não excluir registros reais para resolver cadastros incompletos.

## Publicação

Manter em rascunho. Sem merge, deploy, migrations, concessões reais de acesso ou criação de recursos pagos. A branch `fix/*` tem publicação automática desativada pela configuração existente.
