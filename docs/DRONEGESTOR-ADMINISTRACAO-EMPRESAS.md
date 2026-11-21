# DroneGestor — administração interna e funcionários

## Jornada atual

O gestor geral ativo usa **Configurações → Administração do sistema** em `/apps/dronegestor/administracao`. Nesta mesma tela seleciona ou cadastra a empresa, configura exclusivamente seu acesso ao DroneGestor e cadastra o administrador empresarial. Os administradores já vinculados aparecem para evitar recadastro. Os formulários retornam JSON e mensagens locais; não encaminham para `/admin/usuarios` nem para a administração geral MBA Labs.

O administrador empresarial usa **Gestão → Funcionários e acessos**, em `/apps/dronegestor/funcionarios`, para cadastrar gestor operacional, responsável técnico, piloto, aplicador CAAR ou visualizador da própria empresa. Não pode conceder administração geral ou empresarial. Pilotos/aplicadores também recebem registro operacional.

## Controles

- Página e API `/api/dronegestor/administracao` exigem administrador geral ativo. App é resolvido pelo servidor; dados enviados não podem trocar aplicativo, papel global ou destino de navegação.
- Cadastro empresarial reutiliza `core_empresas`. Edição preserva status global e não altera vínculos de outros aplicativos. A tela informa que os dados cadastrais são compartilhados com MBA Labs.
- A liberação modifica somente o vínculo DroneGestor e seu espelho em assinaturas, preservando plano existente. Falha no espelho tenta restaurar o vínculo anterior. Não contrata recursos nem gera cobrança.
- Criação de administrador exige empresa ativa e contrato DroneGestor ativo/teste não vencido. Papel `admin_empresa` depende de contexto confiável exclusivo do servidor. Usuário global permanece `usuario`.
- Endpoint empresarial deriva empresa da sessão e não aceita papel administrativo. Contas de outra empresa, inativas ou administrativas não são reaproveitadas.
- Senhas iniciais não entram em URL, logs ou armazenamento do navegador. Campo é limpo após tentativa. Conta existente preserva senha. Não há notificação automática.
- Auditoria de conta contém IDs e perfil. Falha de auditoria desfaz vínculo/conta criada. Compensações não são transação distribuída: falhas de infraestrutura exigem reconciliação.

## Validação e limites

71 testes automatizados aprovados, incluindo autorização, isolamento por empresa/app, injeção de privilégios, JSON sem redirect, compensações, administradores existentes e renderização dos links internos. TypeScript e build aprovados; lint sem erros, com três avisos legados. Evidências: `docs/evidence/dronegestor/administracao-interna-20261121/`.

Sessão real do administrador Pulveriza 63 confirmou funcionários da própria empresa e bloqueio das páginas de administração geral. O novo fluxo do proprietário ainda requer validação real com seu perfil geral; mocks e renderização não comprovam gravação produtiva integral.

Nenhuma migration ou política produtiva foi alterada. A lacuna conhecida de RLS de `core_logs` permanece pendente. Não há comprovação integral dos perfis piloto/RT nem das seis resoluções solicitadas.
