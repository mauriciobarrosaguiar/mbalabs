# DroneGestor — nova senha na edição de funcionários

## Jornada

Clique em um funcionário em Funcionários e acessos. Abaixo da edição dos dados aparece **Nova senha**, **Confirmar nova senha** e o botão separado **Alterar senha**. Campos vazios preservam a senha. Salvar alterações dos dados continua sem alterar credenciais. Campos de senha são limpos após a tentativa e ao trocar o funcionário.

## Autorização e efeitos

A ação PATCH senha reutiliza os controles de administrador ativo, empresa e contrato vigentes. ID do Auth é obtido do cadastro autorizado no servidor, nunca do cliente. Exige vínculo do funcionário na empresa/app da sessão e confirmação idêntica, entre8 e200 caracteres. Nenhum papel ou status é modificado.

Administrador empresarial pode redefinir funcionários comuns com acesso somente ao DroneGestor. Conta com permissão ativa em outro app exige alteração pelo próprio titular; assim o administrador deste app não assume contas de outros aplicativos. Senha de outro administrador empresarial e de administrador geral não pode ser alterada por este fluxo. O administrador empresarial pode alterar a própria senha; ela é compartilhada com seu login MBA Labs, conforme aviso da tela.

Usa Auth Admin updateUserById somente no servidor. Não envia notificações nem grava senha em logs, URL ou armazenamento do navegador. Auditoria registra somente IDs de autor/alvo e ação. Falha de auditoria inicial aborta antes do Auth. Falha do Auth recebe mensagem sanitizada. Se a senha mudou e a auditoria final falhou, a resposta confirma mudança com pendência de conferência, evitando falso erro e repetição indevida. Não há tentativa de restaurar senha anterior nem garantia de invalidação imediata de todos os tokens existentes.

## Validação e limites

89 testes DroneGestor aprovados, incluindo confirmação, comprimento, autorização, escopo, proteção administrativa, contas compartilhadas, auditoria e ausência de segredo nos retornos/logs. TypeScript, lint dos arquivos alterados e build aprovados. Evidências em docs/evidence/dronegestor/senha-funcionarios-20261121/.

Reteste produtivo irá conferir presença dos campos e preservação com ambos vazios. Não redefinir credenciais reais durante teste automatizado; usuário realiza entrada/confirmacão/submissão da senha diretamente no navegador. Testes do Auth usam fixture, não comprovam troca real em produção.

Nenhuma migration, política RLS, senha real ou recurso pago foi alterado nesta implementação. A pendência core_logs permanece conforme relatórios anteriores.

## Reteste após publicação

PR #202 incorporada; main db3f455e159dc95711672aacbe17d4aabb8dacc1, deploy dpl_6Ba7wJR94mKqJuUYc6iFEddxJV1u READY com domínio www.mbalabs.com.br.

Conta empresarial Pulveriza 63 abriu o funcionário fictício HOMOLOGAÇÃO P63 - Gestor operacional. A página exibiu Nova senha, Confirmar nova senha e Alterar senha abaixo da edição dos dados. Clique com ambos os campos vazios retornou “Nenhuma nova senha informada. A senha atual foi mantida.” Captura nova-senha-publicada.jpg registra os campos em produção.

Nenhuma senha foi digitada ou redefinida. O teste da troca efetiva permanece dependente da entrada e submissão pelo usuário. Não se declara validação integral do Auth em produção.
